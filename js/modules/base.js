import { faqTypes, showFaq } from "./faq.js";
import { updateVisited, getVisited, addCards, getCardCount, inStudyList, initialize as dataInit } from "./data-layer.js";
import { initializeGraph, updateColorScheme } from "./graph.js";
import { graphChanged, preferencesChanged } from "./recommendations.js";

window.definitions = window.definitions || {};
//TODO break this down further
//refactor badly needed...hacks on top of hacks at this point
let maxExamples = 3;
let currentExamples = {};
//the root of the trie being displayed
let currentRoot = null;
//the ngram for which we're showing examples
let currentNgram = null;
let undoChain = [];
let tabs = {
    explore: 'explore',
    study: 'study'
};

let subtries = {};

let activeTab = tabs.explore;

let freqLegend = ['Top500', 'Top1k', 'Top2k', 'Top4k', 'Top7k', 'Top10k'];
let punctuation = {
    'fr-FR': new Set([".", ",", '\'', '’']),
    'pt-BR': new Set([".", ",", ":", "!", "?"]),
    'it-IT': new Set([".", ",", '\'', '’']),
    'de-DE': new Set([".", ",", '\'', '’']),
    'es-ES': new Set([".", ",", ":", "!", "?"]),
    'nb-NO': new Set([".", ",", ":", "!", "?"])
};
const defaultWords = {
    'fr-FR': ['bras', 'numéro', 'participer'],
    'pt-BR': ['braço', 'mercado', 'importância'],
    'it-IT': ['braccio', 'lavoro', 'intervento'],
    'de-DE': ['arm', 'arbeit', 'beteiligung'],
    'es-ES': ['brazo', 'trabajo', 'participar'],
    'nb-NO': ['væpnet', 'jobb', 'delta']
};
let languageOptions = {
    'French': 'fr-FR',
    'Portuguese': 'pt-BR',
    'Italian': 'it-IT',
    'German': 'de-DE',
    'Spanish': 'es-ES',
    'Norwegian': 'nb-NO'
};

//TODO: make specialized tries per language
let graphOptions = {
    top10k: {
        display: 'Top 10k words', prefix: 'top-10k-', legend: freqLegend
    }
};
let activeGraph = graphOptions.top10k;
let getActiveGraph = function () {
    return activeGraph;
}

//top-level section container
const mainContainer = document.getElementById('container');

const exploreTab = document.getElementById('show-explore');
const studyTab = document.getElementById('show-study');

const mainHeader = document.getElementById('main-header');

//study items...these may not belong in this file
const studyContainer = document.getElementById('study-container');

//explore tab items
const examplesList = document.getElementById('examples');
const exampleContainer = document.getElementById('example-container');
//explore tab navigation controls
const searchBox = document.getElementById('search-box');
const searchForm = document.getElementById('search-form');
const previousButton = document.getElementById('previousButton');
//recommendations
const recommendationsDifficultySelector = document.getElementById('recommendations-difficulty');

//menu items
const languageSelector = document.getElementById('language-selector');
const menuButton = document.getElementById('menu-button');
const menuContainer = document.getElementById('menu-container');
const menuExitButton = document.getElementById('menu-exit-button');

let getTts = function () {
    //use the first-encountered target voice for now
    return speechSynthesis.getVoices().find(voice => voice.lang === targetLang);
};
let tts = getTts();
//TTS voice option loading appears to differ in degree of asynchronicity by browser...being defensive
speechSynthesis.onvoiceschanged = function () {
    if (!tts) {
        tts = getTts();
    }
};

let runTextToSpeech = function (text, anchors) {
    tts = tts || getTts();
    //TTS voice option loading appears to differ in degree of asynchronicity by browser...being defensive
    if (tts) {
        let utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = targetLang;
        utterance.voice = tts;
        utterance.addEventListener('boundary', function (event) {
            //TODO: highlighting
        });
        utterance.addEventListener('end', function () {
            anchors.forEach(word => {
                word.style.fontWeight = 'normal';
            });
        });
        speechSynthesis.speak(utterance);
    }
};

let addTextToSpeech = function (holder, text, aList) {
    let textToSpeechButton = document.createElement('span');
    textToSpeechButton.className = 'text-button listen';
    textToSpeechButton.textContent = 'Listen';
    textToSpeechButton.addEventListener('click', runTextToSpeech.bind(this, text, aList), false);
    holder.appendChild(textToSpeechButton);
};
let addSaveToListButton = function (holder, examples) {
    let buttonTexts = ['In your study list!', 'Add to study list'];
    let saveToListButton = document.createElement('span');
    saveToListButton.className = 'text-button';
    saveToListButton.textContent = examples.every(x => inStudyList(x.t)) ? buttonTexts[0] : buttonTexts[1];
    saveToListButton.addEventListener('click', function () {
        addCards(examples);
        saveToListButton.textContent = buttonTexts[0];
    });
    holder.appendChild(saveToListButton);
};
let persistState = function () {
    let localUndoChain = undoChain.length > 5 ? undoChain.slice(0, 5) : undoChain;
    localStorage.setItem('state', JSON.stringify({
        root: currentRoot,
        ngram: currentNgram,
        undoChain: localUndoChain,
        activeTab: activeTab,
        targetLang: targetLang,
        currentGraph: activeGraph.display,
        graphPrefix: activeGraph.prefix
    }));
};
let setupDefinitions = function (words, definitionHolder, shown) {
    if (!words) {
        return;
    }
    let definitionList = [];
    words.forEach(word => {
        definitionList.push(definitions[word] || []);
    });
    //TODO make this sane
    for (let i = 0; i < definitionList.length; i++) {
        let currentWord = definitionList[i];
        if (!currentWord.length) {
            continue;
        }
        for (let j = 0; j < currentWord.length; j++) {
            let currentItem = currentWord[j];
            if (!currentItem.length) {
                break;
            }
            for (let k = 0; k < currentItem.length; k++) {
                if (!currentItem[k].length) {
                    continue;
                }
                let definitionItem = document.createElement('li');
                definitionItem.className = `${words[i]}-definition`;
                if (!shown) {
                    definitionItem.style.display = 'none';
                }
                if (currentItem[k].length >= 2) {
                    definitionItem.innerText = `${currentItem[k][0]}: ${currentItem[k].slice(1).join(', ')}`;
                } else {
                    definitionItem.innerText = currentItem[k][0];
                }
                definitionHolder.appendChild(definitionItem);
            }
        }
    }
};
let findExamples = function (ngram) {
    if (ngram.length === 1) {
        let examples = [];
        //TODO consider indexing up front
        //can also reuse inner loop...consider inverting
        let targetWord = ngram[0].toLowerCase();
        for (let i = 0; i < sentences.length; i++) {
            if (sentences[i].t.map(x => x.toLowerCase()).includes(targetWord)) {
                if (sentences[i].b) {
                    examples.push(sentences[i]);
                    if (examples.length === maxExamples) {
                        break;
                    }
                }
            }
        }
        return examples;
    } else {
        let curr = subtries[ngram[0]];
        for (let i = 1; i < ngram.length; i++) {
            if (!curr) {
                return [];
            }
            curr = curr[ngram[i]];
        }
        if (!curr.__e) {
            return [];
        }
        return curr.__e.map(x => {
            return { t: x[0], b: x[1] };
        });
    }
};
let isPunctuation = function (token) {
    return punctuation[targetLang].has(token);
};
let joinTokens = function (tokens) {
    let result = '';
    tokens.forEach((x, index) => {
        if (index > 0 && !isPunctuation(x)) {
            result += ' ';
        }
        result += x;
    });
    return result;
};
let setupExampleElements = function (examples, exampleList) {
    for (let i = 0; i < examples.length; i++) {
        let exampleHolder = document.createElement('li');
        let targetHolder = document.createElement('p');
        let exampleText = joinTokens(examples[i].t);
        let aList = makeSentenceNavigable(examples[i].t, targetHolder, true);
        targetHolder.className = 'target-example example-line';
        addTextToSpeech(targetHolder, exampleText, aList);
        exampleHolder.appendChild(targetHolder);
        if (examples[i].transcription) {
            let transcriptionHolder = document.createElement('p');
            transcriptionHolder.textContent = examples[i].transcription;
            transcriptionHolder.className = 'transcription-example example-line';
            exampleHolder.appendChild(transcriptionHolder);
        }
        let baseHolder = document.createElement('p');
        baseHolder.textContent = examples[i].b;
        baseHolder.className = 'base-example example-line';
        exampleHolder.appendChild(baseHolder);
        exampleList.appendChild(exampleHolder);
    }
};
let setupExamples = function (words) {
    currentExamples = {};
    //TODO this mixes markup modification and example finding
    //refactor needed
    while (examplesList.firstChild) {
        examplesList.firstChild.remove();
    }
    if (!words) {
        return;
    }
    let examples = findExamples(words);
    currentExamples[words] = [];

    let item = document.createElement('li');
    let wordHolder = document.createElement('h2');
    for (let i = 0; i < words.length; i++) {
        let wordAnchor = document.createElement('a');
        wordAnchor.innerText = `${words[i]} `;
        wordHolder.appendChild(wordAnchor);
    }
    item.appendChild(wordHolder);
    addTextToSpeech(wordHolder, words, []);
    addSaveToListButton(wordHolder, examples);
    item.appendChild(wordHolder);

    let contextHolder = document.createElement('p');
    //TODO not so thrilled with 'context' as the name here
    contextHolder.className = 'context';
    contextHolder.innerText += "Previously: ";
    [...words].forEach(x => {
        contextHolder.innerText += `${x} seen ${getVisited()[x] || 0} times; in ${getCardCount(x)} flash cards. `;
    });
    let contextFaqLink = document.createElement('a');
    contextFaqLink.className = 'faq-link';
    contextFaqLink.textContent = "Learn more.";
    contextFaqLink.addEventListener('click', function () {
        showFaq(faqTypes.context);
    });
    contextHolder.appendChild(contextFaqLink);
    item.appendChild(contextHolder);

    if (words.length === 1) {
        let definitionHolder = document.createElement('ul');
        definitionHolder.className = 'definition';
        setupDefinitions(words, definitionHolder, words.length === 1);
        item.appendChild(definitionHolder);
    }

    //setup current examples for potential future export
    currentExamples[words].push(...examples);

    let exampleList = document.createElement('ul');
    item.appendChild(exampleList);
    setupExampleElements(examples, exampleList);

    examplesList.append(item);

    currentNgram = words;
};
let updateUndoChain = function () {
    //push clones onto the stack
    undoChain.push({ root: currentRoot, ngram: (currentNgram ? [...currentNgram] : currentNgram) });
};

//TODO can this be combined with the definition rendering part?
let getCardsFromDefinitions = function (words, definitionList) {
    let results = [];
    if (!definitionList) {
        return;
    }
    //TODO make this sane
    for (let i = 0; i < definitionList.length; i++) {
        let currentWord = definitionList[i];
        if (!currentWord.length) {
            continue;
        }
        for (let j = 0; j < currentWord.length; j++) {
            let currentItem = currentWord[j];
            if (!currentItem.length) {
                break;
            }
            for (let k = 0; k < currentItem.length; k++) {
                if (!currentItem[k].length) {
                    continue;
                }
                let card = {};
                card.t = [words[i]];
                if (currentItem[k].length >= 2) {
                    card.b = `${currentItem[k][0]}: ${currentItem[k].slice(1).join(', ')}`;
                } else {
                    card.b = currentItem[k][0];
                }
                if (card.b && card.t) {
                    results.push(card);
                }
            }
        }
    }
    return results;
};

let nodeTapHandler = function (evt) {
    updateUndoChain();
    setupExamples(evt.target.data('path'));
    persistState();
    exploreTab.click();
    mainHeader.scrollIntoView();
    updateVisited(evt.target.data('path'));
};
let edgeTapHandler = function () { };
let updateGraph = function (value) {
    document.getElementById('graph').remove();
    let nextGraph = document.createElement("div");
    nextGraph.id = 'graph';
    //TODO: makes assumption about markup order
    mainContainer.append(nextGraph);
    let result = null;
    if (value && trie[value]) {
        result = fetch(`./data/${targetLang}/subtries/${value}.json`)
            .then(response => response.json())
            .then(function (data) {
                subtries[value] = data;
            });
        initializeGraph(value, nextGraph, nodeTapHandler, edgeTapHandler);
        currentRoot = value;
        persistState();
    }
    return result;
};

let initialize = function () {
    let oldState = JSON.parse(localStorage.getItem('state'));
    //TODO: make specialized tries
    for (const [key, value] of Object.entries(languageOptions)) {
        if (value === targetLang) {
            languageSelector.value = key;
            break;
        }
    }
    if (oldState) {
        //note: would already have loaded objects as part of data-load.js
        let result = updateGraph(oldState.root);
        if (oldState.ngram) {
            if (result) {
                result.then(() => {
                    setupExamples(oldState.ngram);
                })
            } else {
                //TODO: is this actually what we want?
                setupExamples(oldState.ngram);
            }
        }
        undoChain = oldState.undoChain;
        if (oldState.activeTab === tabs.study) {
            //reallllllly need a toggle method
            //this does set up the current card, etc.
            studyTab.click();
        }
        persistState();
    } else {
        updateGraph(defaultWords[targetLang][Math.floor(Math.random() * defaultWords[targetLang].length)]);
    }
    matchMedia("(prefers-color-scheme: light)").addEventListener("change", updateColorScheme);
};

let makeSentenceNavigable = function (tokens, container, noExampleChange) {
    let sentenceContainer = document.createElement('span');
    sentenceContainer.className = "sentence-container";

    let anchorList = [];
    for (let i = 0; i < tokens.length; i++) {
        (function (word) {
            let a = document.createElement('a');
            //TODO combine with join
            let separator = ' ';
            if (i < tokens.length - 1 && isPunctuation(tokens[i + 1])) {
                separator = '';
            }
            a.textContent = word + separator;
            a.addEventListener('click', function () {
                let cleanWord = word.toLowerCase();
                if (trie[cleanWord]) {
                    let updated = false;
                    if (currentRoot && currentRoot !== word) {
                        updateUndoChain();
                        updated = true;
                        updateGraph(cleanWord);
                    }
                    //enable seamless switching, but don't update if we're already showing examples for character
                    if (!noExampleChange && (!currentNgram || (currentNgram.length !== 1 || currentNgram[0] !== word))) {
                        if (!updated) {
                            updateUndoChain();
                        }
                        setupExamples([cleanWord]);
                    }
                    persistState();
                }
            });
            anchorList.push(a);
            sentenceContainer.appendChild(a);
        }(tokens[i]));
    }
    container.appendChild(sentenceContainer);
    return anchorList;
};

searchForm.addEventListener('submit', function (event) {
    event.preventDefault();
    let value = searchBox.value.toLocaleLowerCase();
    if (value && trie[value]) {
        updateUndoChain();
        updateGraph(value);
        setupExamples([value]);
        persistState();
        updateVisited([value]);
    }
});

previousButton.addEventListener('click', function () {
    if (!undoChain.length) {
        return;
    }
    let next = undoChain.pop();
    updateGraph(next.root);
    if (next.ngram) {
        setupExamples(next.ngram);
    }
    persistState();
});
exploreTab.addEventListener('click', function () {
    exampleContainer.removeAttribute('style');
    studyContainer.style.display = 'none';
    //TODO could likely do all of this with CSS
    exploreTab.classList.add('active');
    studyTab.classList.remove('active');
    activeTab = tabs.explore;
    persistState();
});

studyTab.addEventListener('click', function () {
    exampleContainer.style.display = 'none';
    studyContainer.removeAttribute('style');
    studyTab.classList.add('active');
    exploreTab.classList.remove('active');
    activeTab = tabs.study;
    persistState();
});

recommendationsDifficultySelector.addEventListener('change', function () {
    let val = recommendationsDifficultySelector.value;
    preferencesChanged(val);
});

menuButton.addEventListener('click', function () {
    mainContainer.style.display = 'none';
    menuContainer.removeAttribute('style');
});
menuExitButton.addEventListener('click', function () {
    menuContainer.style.display = 'none';
    mainContainer.removeAttribute('style');
});

let switchLanguage = function () {
    let value = languageSelector.value;
    let selectedLanguage = languageOptions[value];
    if (targetLang !== selectedLanguage) {
        window.targetLang = selectedLanguage;
        //fetch regardless...allow service worker and/or browser cache to optimize
        fetch(`./data/${targetLang}/trie.json`)
            .then(response => response.json())
            .then(function (data) {
                window.trie = data;
                graphChanged();
                updateGraph();
                setupExamples();
            });
        fetch(`./data/${targetLang}/sentences.json`)
            .then(response => response.json())
            .then(function (data) {
                window.sentences = data;
            });
        fetch(`./data/${targetLang}/definitions.json`)
            .then(response => response.json())
            .then(function (data) {
                window.definitions = data;
            });
        dataInit();
        exploreTab.click();
        // fetch(`./data/${targetLang}/inverted-trie.json`)
        //     .then(response => response.json())
        //     .then(function (data) {
        //         window.invertedTrie = data;
        //     });
        persistState();
    }
}
languageSelector.addEventListener('change', switchLanguage);

export { initialize, makeSentenceNavigable, addTextToSpeech, getActiveGraph, joinTokens };