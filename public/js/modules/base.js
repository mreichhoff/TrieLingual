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
    'French': { targetLang: 'fr-FR', urlPath: 'french' },
    'Portuguese': { targetLang: 'pt-BR', urlPath: 'portuguese' },
    'Italian': { targetLang: 'it-IT', urlPath: 'italian' },
    'German': { targetLang: 'de-DE', urlPath: 'german' },
    'Spanish': { targetLang: 'es-ES', urlPath: 'spanish' },
    'Norwegian': { targetLang: 'nb-NO', urlPath: 'norwegian' }
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

let createActionMenu = function (holder, text, aList, examples) {
    // Create three-dot menu container
    let menuContainer = document.createElement('div');
    menuContainer.className = 'action-menu-container';

    // Create menu toggle button
    let menuButton = document.createElement('button');
    menuButton.type = 'button';
    menuButton.className = 'icon-button menu-toggle';
    menuButton.setAttribute('aria-label', 'More options');
    menuButton.setAttribute('aria-expanded', 'false');
    menuButton.title = 'More options';
    menuButton.innerHTML = `
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <circle cx="12" cy="5" r="2" fill="currentColor"/>
            <circle cx="12" cy="12" r="2" fill="currentColor"/>
            <circle cx="12" cy="19" r="2" fill="currentColor"/>
        </svg>
    `;

    // Create dropdown menu
    let dropdown = document.createElement('div');
    dropdown.className = 'action-menu-dropdown';

    // Listen menu item
    let listenItem = document.createElement('button');
    listenItem.type = 'button';
    listenItem.className = 'action-menu-item';
    listenItem.innerHTML = `
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M5 9v6h4l5 5V4L9 9H5z"></path>
            <path d="M16.5 8.5a4.5 4.5 0 010 7" stroke="none" fill="currentColor"></path>
        </svg>
        <span>Listen</span>
    `;
    listenItem.addEventListener('click', function (e) {
        e.stopPropagation();
        runTextToSpeech(text, aList);
        dropdown.classList.remove('open');
        menuButton.setAttribute('aria-expanded', 'false');
    });
    dropdown.appendChild(listenItem);

    // Save to list menu item
    let allSaved = examples && examples.length && examples.every(x => inStudyList(x.t));
    let saveItem = document.createElement('button');
    saveItem.type = 'button';
    saveItem.className = 'action-menu-item';
    saveItem.innerHTML = `
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <!-- Bookmark base -->
            <path d="M6 2h9a2 2 0 012 2v14l-5-2-5 2V4a2 2 0 012-2z" fill="currentColor" fill-opacity="0.75"></path>
            ${allSaved
            ? '<path d="M9 12l2 2 4-4" stroke="#22c55e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>'
            : '<circle cx="18" cy="8" r="5" fill="#eaf2ff" opacity="0.85"/><path d="M18 5v6" stroke="#60a5fa" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M15 8h6" stroke="#60a5fa" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>'}
        </svg>
        <span>${allSaved ? 'Saved' : 'Add to list'}</span>
    `;
    saveItem.addEventListener('click', function (e) {
        e.stopPropagation();
        if (examples && examples.length) {
            addCards(examples);
            saveItem.innerHTML = `
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                    <path d="M6 2h9a2 2 0 012 2v14l-5-2-5 2V4a2 2 0 012-2z" fill="currentColor" fill-opacity="0.75"></path>
                    <path d="M9 12l2 2 4-4" stroke="#22c55e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
                </svg>
                <span>Saved</span>
            `;
        }
        dropdown.classList.remove('open');
        menuButton.setAttribute('aria-expanded', 'false');
    });
    dropdown.appendChild(saveItem);

    // Toggle menu on button click
    menuButton.addEventListener('click', function (e) {
        e.stopPropagation();
        const isOpen = dropdown.classList.toggle('open');
        menuButton.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });

    // Close menu when clicking outside
    document.addEventListener('click', function (e) {
        if (!menuContainer.contains(e.target)) {
            dropdown.classList.remove('open');
            menuButton.setAttribute('aria-expanded', 'false');
        }
    });

    menuContainer.appendChild(menuButton);
    menuContainer.appendChild(dropdown);
    holder.appendChild(menuContainer);
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
        createActionMenu(targetHolder, exampleText, aList, [examples[i]]);
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
    wordHolder.classList.add('word-header');
    for (let i = 0; i < words.length; i++) {
        let wordAnchor = document.createElement('a');
        wordAnchor.innerText = `${words[i]} `;
        wordHolder.appendChild(wordAnchor);
    }
    createActionMenu(wordHolder, words, [], examples);
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

    // Update URL to reflect the current language and word for deep-linking
    if (words && words.length > 0) {
        const langOption = Object.values(languageOptions).find(opt => opt.targetLang === targetLang);
        if (langOption && langOption.urlPath) {
            const word = words[0]; // Use the first word in the ngram
            const newUrl = `/${langOption.urlPath}/${encodeURIComponent(word)}`;
            if (document.location.pathname !== newUrl) {
                history.pushState({}, '', newUrl);
            }
        }
    }
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
    setupExamples(evt.target.data('path'));
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
    }
    return result;
};

let initialize = function () {
    //TODO: make specialized tries
    for (const [key, value] of Object.entries(languageOptions)) {
        if (value.targetLang === targetLang) {
            languageSelector.value = key;
            break;
        }
    }
    // If word is in URL, display it with examples; otherwise just load the graph for a random default
    if (window.urlPath && window.urlPath.word) {
        const word = window.urlPath.word;
        let result = updateGraph(word);
        if (result) {
            result.then(() => {
                setupExamples([word]);
            });
        } else {
            setupExamples([word]);
        }
    } else {
        updateGraph(defaultWords[targetLang][Math.floor(Math.random() * defaultWords[targetLang].length)]);
    }

    // Handle browser back/forward navigation
    window.addEventListener('popstate', function () {
        const updated = parseUrlPath();
        if (updated.lang && updated.lang === targetLang && updated.word) {
            // Same language, just update the word/examples
            let result = updateGraph(updated.word);
            if (result) {
                result.then(() => {
                    setupExamples([updated.word]);
                });
            } else {
                setupExamples([updated.word]);
            }
        } else if (updated.lang && updated.lang !== targetLang) {
            // Language changed; reload the page to pick up new language data
            location.reload();
        } else if (!updated.word && !updated.lang) {
            // back to root; show landing page
            location.reload();
        }
    });
};

// Parse URL path function (duplicated from data-load.js for use in popstate handler)
function parseUrlPath() {
    const slugToLang = {
        'french': 'fr-FR',
        'portuguese': 'pt-BR',
        'italian': 'it-IT',
        'german': 'de-DE',
        'spanish': 'es-ES',
        'norwegian': 'nb-NO'
    };
    const pathname = window.location.pathname || '';
    const parts = pathname.split('/').filter(p => p.length);
    const result = { lang: null, word: null };

    if (parts.length >= 1) {
        const slug = parts[0].toLowerCase();
        if (slugToLang[slug]) {
            result.lang = slugToLang[slug];
        }
    }

    if (parts.length >= 2) {
        result.word = decodeURIComponent(parts[1]);
    }

    return result;
}

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
                        updated = true;
                        updateGraph(cleanWord);
                    }
                    //enable seamless switching, but don't update if we're already showing examples for character
                    if (!noExampleChange && (!currentNgram || (currentNgram.length !== 1 || currentNgram[0] !== word))) {
                        setupExamples([cleanWord]);
                    }
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
        updateGraph(value);
        setupExamples([value]);
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
    const value = languageSelector.value;
    document.location.href = `/${languageOptions[value].urlPath}`;
}
languageSelector.addEventListener('change', switchLanguage);

export { initialize, makeSentenceNavigable, getActiveGraph, joinTokens };