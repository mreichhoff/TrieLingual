import { addCards, getCardCount, inStudyList, initialize as dataInit } from "./data-layer.js";
import { initializeGraph, updateColorScheme } from "./graph.js";

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

let subtries = {};

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
const mainContainer = document.getElementById('main-container');


const mainHeader = document.getElementById('main-header');

//study items...these may not belong in this file
const studyContainer = document.getElementById('study-container');

const examplesList = document.getElementById('examples');
const searchBox = document.getElementById('search-box');
const searchForm = document.getElementById('search-form');

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
    // create accessible icon button for TTS
    let btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'icon-button listen';
    btn.setAttribute('aria-label', 'Listen');
    btn.title = 'Listen';
    btn.innerHTML = `
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M5 9v6h4l5 5V4L9 9H5z"></path>
            <path d="M16.5 8.5a4.5 4.5 0 010 7" stroke="none" fill="currentColor"></path>
        </svg>
    `;
    btn.addEventListener('click', runTextToSpeech.bind(this, text, aList), false);
    holder.appendChild(btn);
};
let addSaveToListButton = function (holder, examples) {
    // create compact icon button to add examples to study list (bookmark/plus)
    let btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'icon-button save';
    // determine initial state: are all examples already in study list?
    let allSaved = examples.length && examples.every(x => inStudyList(x.t));
    btn.setAttribute('aria-pressed', allSaved ? 'true' : 'false');
    btn.title = allSaved ? 'In your study list' : 'Add to study list';
    btn.setAttribute('aria-label', btn.title);
    const svgAdd = `
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M6 2h9a2 2 0 012 2v14l-5-2-5 2V4a2 2 0 012-2z"></path>
            <path d="M18 6v4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M16 8h4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>`;
    const svgSaved = `
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M6 2h9a2 2 0 012 2v14l-5-2-5 2V4a2 2 0 012-2z"></path>
            <path d="M9 12l2 2 4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
        </svg>`;
    btn.innerHTML = allSaved ? svgSaved : svgAdd;
    btn.addEventListener('click', function () {
        addCards(examples);
        // update visual state to saved
        btn.setAttribute('aria-pressed', 'true');
        btn.title = 'In your study list';
        btn.setAttribute('aria-label', btn.title);
        btn.innerHTML = svgSaved;
    });
    holder.appendChild(btn);
};
let persistState = function () {
    let localUndoChain = undoChain.length > 5 ? undoChain.slice(0, 5) : undoChain;
    localStorage.setItem('state', JSON.stringify({
        root: currentRoot,
        ngram: currentNgram,
        undoChain: localUndoChain,
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

    if (words.length === 1) {
        let definitionHeading = document.createElement('h3');
        definitionHeading.className = 'section-heading';
        definitionHeading.innerText = 'Definitions';
        item.appendChild(definitionHeading);

        let definitionHolder = document.createElement('ul');
        definitionHolder.className = 'definition';
        setupDefinitions(words, definitionHolder, words.length === 1);
        item.appendChild(definitionHolder);
    }

    //setup current examples for potential future export
    currentExamples[words].push(...examples);

    let examplesHeading = document.createElement('h3');
    examplesHeading.className = 'section-heading';
    examplesHeading.innerText = 'Examples';
    item.appendChild(examplesHeading);

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
};
let edgeTapHandler = function () { };
let updateGraph = function (value) {
    const oldGraph = document.getElementById('graph');
    if (oldGraph) {
        oldGraph.remove();
    }
    let nextGraph = document.createElement("div");
    nextGraph.id = 'graph';
    // Insert the new graph into the #graph-area before the legend so it sits above it.
    const graphArea = document.getElementById('graph-area');
    const graphLegend = document.getElementById('graph-legend');
    graphArea.insertBefore(nextGraph, graphLegend);

    let result = null;
    if (value && trie[value]) {
        result = fetch(`/data/${targetLang}/subtries/${value}.json`)
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
    }
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
        fetch(`/data/${targetLang}/trie.json`)
            .then(response => response.json())
            .then(function (data) {
                window.trie = data;
                graphChanged();
                updateGraph();
                setupExamples();
            });
        fetch(`/data/${targetLang}/sentences.json`)
            .then(response => response.json())
            .then(function (data) {
                window.sentences = data;
            });
        fetch(`/data/${targetLang}/definitions.json`)
            .then(response => response.json())
            .then(function (data) {
                window.definitions = data;
            });
        dataInit();
        // fetch(`/data/${targetLang}/inverted-trie.json`)
        //     .then(response => response.json())
        //     .then(function (data) {
        //         window.invertedTrie = data;
        //     });
        persistState();
    }
}
languageSelector.addEventListener('change', switchLanguage);

export { initialize, makeSentenceNavigable, addTextToSpeech, getActiveGraph, joinTokens };