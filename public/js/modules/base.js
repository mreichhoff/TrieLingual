import { addCards, getCardCount, inStudyList, initialize as dataInit } from "./data-layer.js";
import { initializeGraph } from "./graph.js";
import { getAuthenticatedUser, callGenerateSentences, callAnalyzeCollocation, callExplainEnglishText, callExplainText } from "./firebase.js"

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

// Render a single-word block (header + definitions + examples) appended to a container
let renderWordInline = function (container, word) {
    if (!container || !word || !trie[word]) return;
    let examples = findExamples([word]);

    let item = document.createElement('li');
    // Add divider if there are already items
    if (container.children.length > 0) {
        item.style.borderTop = '2px solid rgba(255, 255, 255, 0.15)';
        item.style.marginTop = '24px';
        item.style.paddingTop = '24px';
    }
    let wordHolder = document.createElement('h2');
    wordHolder.classList.add('word-header');
    let wordAnchor = document.createElement('a');
    wordAnchor.innerText = `${word} `;
    wordAnchor.style.cursor = 'pointer';
    wordAnchor.addEventListener('click', function () {
        updateGraph(word);
    });
    wordHolder.appendChild(wordAnchor);
    // Attach menu to header (uses existing actions for single word)
    createActionMenu(item, wordHolder, [word], [], examples);
    item.appendChild(wordHolder);

    let definitionHeading = document.createElement('h3');
    definitionHeading.className = 'section-heading';
    definitionHeading.innerText = 'Definitions';
    item.appendChild(definitionHeading);
    let definitionHolder = document.createElement('ul');
    definitionHolder.className = 'definition';
    setupDefinitions([word], definitionHolder, true);
    item.appendChild(definitionHolder);

    let examplesHeading = document.createElement('h3');
    examplesHeading.className = 'section-heading';
    examplesHeading.innerText = 'Examples';
    item.appendChild(examplesHeading);
    let exampleList = document.createElement('ul');
    item.appendChild(exampleList);
    setupExampleElements(examples, exampleList);

    container.appendChild(item);
};

// Helper to render AI-generated sentences under a container
let renderAISentences = function (container, sentences, headingText, blockClass) {
    if (!container || !Array.isArray(sentences) || !sentences.length) return;
    if (blockClass) {
        const old = container.querySelector('.' + blockClass);
        if (old) old.remove();
    }
    let block = document.createElement('li');
    block.className = blockClass || 'ai-sentences-block';
    let heading = document.createElement('h3');
    heading.className = 'section-heading';
    heading.textContent = headingText || 'More Examples (AI)';
    block.appendChild(heading);
    let list = document.createElement('ul');
    list.className = 'ai-sentences-list';
    sentences.forEach(s => {
        if (!s || !s.targetLanguageText || !s.englishTranslation) return;
        let li = document.createElement('li');
        let targetP = document.createElement('p');
        targetP.className = 'target-example example-line';
        const tokens = s.targetLanguageText.split(/\s+/).filter(x => x.length);
        const anchors = makeSentenceNavigable(tokens, targetP, true);
        // Attach compact action menu with listen/save only (no AI actions for full sentences)
        createActionMenu(list, targetP, s.targetLanguageText, anchors, [{ t: tokens, b: s.englishTranslation }]);
        li.appendChild(targetP);
        let baseP = document.createElement('p');
        baseP.className = 'base-example example-line';
        baseP.textContent = s.englishTranslation;
        li.appendChild(baseP);
        list.appendChild(li);
    });
    block.appendChild(list);
    container.appendChild(block);
};

// AI loading helpers
let showAiLoading = function (container, label) {
    if (!container) return;
    // remove any existing loading block
    const old = container.querySelector('.ai-loading-block');
    if (old) old.remove();
    const li = document.createElement('li');
    li.className = 'ai-loading-block';
    const wrap = document.createElement('div');
    wrap.className = 'ai-loading-wrapper';
    const spinner = document.createElement('div');
    spinner.className = 'ai-spinner';
    const text = document.createElement('span');
    text.className = 'ai-loading-text';
    text.textContent = label || 'Loading AI…';
    wrap.appendChild(spinner);
    wrap.appendChild(text);
    li.appendChild(wrap);
    container.appendChild(li);
    return li;
};
let clearAiLoading = function (container) {
    if (!container) return;
    const old = container.querySelector('.ai-loading-block');
    if (old) old.remove();
};

let createActionMenu = function (aiResponseContainer, holder, text, aList, examples) {
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

    // AI actions: show conditionally based on whether header is a single word or an n-gram
    try {
        const isArrayInput = Array.isArray(text);
        const isSingleWord = isArrayInput && text.length === 1;
        const isCollocation = isArrayInput && text.length > 1;

        // Save to list menu item - only for single words in word-header context
        if (isSingleWord) {
            const word = text[0];
            const wordDefinitions = (window.definitions && window.definitions[word]) ? window.definitions[word] : [];
            const definitionCards = getCardsFromDefinitions([word], [wordDefinitions]);
            const allSaved = definitionCards.length && definitionCards.every(x => inStudyList(x.t));

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
                if (definitionCards.length) {
                    addCards(definitionCards);
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
        } else if (!isArrayInput) {
            // For sentence examples (non-array text input), save sentence to list
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
        }

        if (isSingleWord) {
            let aiSentencesItem = document.createElement('button');
            aiSentencesItem.type = 'button';
            aiSentencesItem.className = 'action-menu-item';
            aiSentencesItem.innerHTML = `
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                    <defs>
                        <linearGradient id="ai-grad" x1="0" y1="0" x2="1" y2="1">
                            <stop offset="0%" stop-color="#60a5fa"/>
                            <stop offset="100%" stop-color="#a78bfa"/>
                        </linearGradient>
                    </defs>
                    <rect x="4" y="4" width="16" height="16" transform="rotate(45 12 12)" fill="url(#ai-grad)" rx="2" ry="2"/>
                </svg>
                <span>AI sentences</span>
            `;
            aiSentencesItem.addEventListener('click', async function (e) {
                e.stopPropagation();
                dropdown.classList.remove('open');
                menuButton.setAttribute('aria-expanded', 'false');
                aiResponseContainer.removeAttribute('style');
                try {
                    const word = text[0];
                    const rawDefs = (window.definitions && window.definitions[word]) ? window.definitions[word] : [];
                    // Convert senses to plain strings expected by generateSentencesInputSchema
                    const defs = Array.isArray(rawDefs)
                        ? rawDefs
                            .map(s => typeof s === 'string' ? s : (s && s.def ? s.def : null))
                            .filter(Boolean)
                        : [];
                    showAiLoading(aiResponseContainer, 'Generating sentences…');
                    const data = await callGenerateSentences({ word, targetLanguage: targetLang, count: 3, definitions: defs });
                    clearAiLoading(aiResponseContainer);
                    if (data && Array.isArray(data.sentences) && data.sentences.length) {
                        renderAISentences(aiResponseContainer, data.sentences, 'More Examples (AI)', 'ai-sentences-block');
                    }
                } catch (err) {
                    console.error('AI sentence generation failed', err);
                    alert('Sorry, could not generate sentences right now.');
                    clearAiLoading(aiResponseContainer);
                }
            });
            if (getAuthenticatedUser()) {
                dropdown.appendChild(aiSentencesItem);
            }
        }

        if (isCollocation) {
            let analyzeCollocationItem = document.createElement('button');
            analyzeCollocationItem.type = 'button';
            analyzeCollocationItem.className = 'action-menu-item';
            analyzeCollocationItem.innerHTML = `
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                    <defs>
                        <linearGradient id="ai-grad" x1="0" y1="0" x2="1" y2="1">
                            <stop offset="0%" stop-color="#60a5fa"/>
                            <stop offset="100%" stop-color="#a78bfa"/>
                        </linearGradient>
                    </defs>
                    <rect x="4" y="4" width="16" height="16" transform="rotate(45 12 12)" fill="url(#ai-grad)" rx="2" ry="2"/>
                </svg>
                <span>AI Analysis</span>
            `;
            analyzeCollocationItem.addEventListener('click', async function (e) {
                e.stopPropagation();
                dropdown.classList.remove('open');
                menuButton.setAttribute('aria-expanded', 'false');
                aiResponseContainer.removeAttribute('style');
                try {
                    const collocation = text.join(' ').toLowerCase();
                    showAiLoading(aiResponseContainer, 'Analyzing collocation…');
                    const data = await callAnalyzeCollocation({ collocation, targetLanguage: targetLang });
                    clearAiLoading(aiResponseContainer);
                    if (data) {
                        const old = aiResponseContainer.querySelector('.ai-collocation-block');
                        if (old) old.remove();
                        const block = document.createElement('li');
                        block.className = 'ai-collocation-block';
                        const heading = document.createElement('h3');
                        heading.className = 'section-heading';
                        heading.textContent = 'Collocation Analysis (AI)';
                        block.appendChild(heading);
                        if (data.englishTranslation) {
                            const tHead = document.createElement('h4');
                            tHead.textContent = 'English Translation';
                            block.appendChild(tHead);
                            const tP = document.createElement('p');
                            tP.className = 'base-example ai-translation';
                            tP.textContent = data.englishTranslation;
                            block.appendChild(tP);
                        }
                        const explanation = data.plainTextExplanation || data.explanation || data.summary;
                        if (explanation) {
                            const eHead = document.createElement('h4');
                            eHead.textContent = 'Explanation';
                            block.appendChild(eHead);
                            const eP = document.createElement('p');
                            eP.className = 'ai-explanation';
                            eP.textContent = explanation;
                            block.appendChild(eP);
                        }
                        if (Array.isArray(data.sentences) && data.sentences.length) {
                            renderAISentences(block, data.sentences, 'Sentences', 'ai-collocation-sentences-section');
                        }
                        aiResponseContainer.appendChild(block);
                    }
                } catch (err) {
                    console.error('AI collocation analysis failed', err);
                    alert('Sorry, could not analyze this collocation right now.');
                    clearAiLoading(aiResponseContainer);
                }
            });
            if (getAuthenticatedUser()) {
                dropdown.appendChild(analyzeCollocationItem);
            }
        }
    } catch (err) {
        // noop; AI actions optional
    }

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
    words.forEach(word => {
        let wordDefinitions = definitions[word];
        if (!wordDefinitions || !wordDefinitions.length) {
            return;
        }
        wordDefinitions.forEach(sense => {
            let definitionItem = document.createElement('li');
            definitionItem.className = `${word}-definition`;
            if (!shown) {
                definitionItem.style.display = 'none';
            }

            // Build definition with mixed text and links
            let container = document.createElement('span');

            // Add POS if available (styled badge before definition)
            if (sense.pos) {
                let posBadge = document.createElement('span');
                posBadge.className = 'pos-badge';
                posBadge.textContent = sense.pos;
                container.appendChild(posBadge);
            }

            // Add main definition
            if (sense.def) {
                let defText = document.createTextNode(sense.def);
                container.appendChild(defText);
            }

            // Add form_of lemmas as clickable links inside a badge (right of definition)
            if (sense.form_of && sense.form_of.length) {
                let formBadge = document.createElement('span');
                formBadge.className = 'form-badge';

                // Label inside badge
                formBadge.appendChild(document.createTextNode('form of: '));

                // Append lemma links inside the badge
                sense.form_of.forEach((lemma, index) => {
                    let lemmaLink = document.createElement('a');
                    lemmaLink.textContent = lemma;
                    lemmaLink.classList.add('active-link');
                    lemmaLink.addEventListener('click', function (e) {
                        e.preventDefault();
                        e.stopPropagation();
                        let cleanLemma = lemma.toLowerCase();
                        if (trie[cleanLemma]) {
                            updateGraph(cleanLemma);
                            setupExamples([cleanLemma]);
                        }
                    });
                    formBadge.appendChild(lemmaLink);

                    if (index < sense.form_of.length - 1) {
                        formBadge.appendChild(document.createTextNode(', '));
                    }
                });

                container.appendChild(formBadge);
            }

            definitionItem.appendChild(container);

            // Add morphological tags as styled badges on a separate row
            if (sense.tags && sense.tags.length) {
                let tagsContainer = document.createElement('div');
                tagsContainer.className = 'definition-tags';
                sense.tags.forEach(tag => {
                    let tagSpan = document.createElement('span');
                    tagSpan.className = 'tag-badge';
                    tagSpan.textContent = tag;
                    tagsContainer.appendChild(tagSpan);
                });
                definitionItem.appendChild(tagsContainer);
            }

            definitionHolder.appendChild(definitionItem);
        });
    });
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
        createActionMenu(exampleList, targetHolder, exampleText, aList, [examples[i]]);
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
    let aiContainer = document.createElement('div');
    aiContainer.style.display = 'none';
    for (let i = 0; i < words.length; i++) {
        let wordAnchor = document.createElement('a');
        wordAnchor.innerText = `${words[i]} `;
        wordHolder.appendChild(wordAnchor);
    }
    createActionMenu(aiContainer, wordHolder, words, [], examples);
    item.appendChild(wordHolder);
    item.appendChild(aiContainer);

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
        return results;
    }
    for (let i = 0; i < definitionList.length; i++) {
        let word = words[i];
        let wordDefinitions = definitionList[i];
        if (!wordDefinitions || !wordDefinitions.length) {
            continue;
        }
        wordDefinitions.forEach(sense => {
            if (!sense.def) {
                return;
            }
            let card = {
                t: [word],
                b: sense.def
            };
            // Optionally include POS and tags in the answer
            if (sense.pos || sense.tags) {
                let meta = [];
                if (sense.pos) meta.push(sense.pos);
                if (sense.tags) meta.push(sense.tags.join(', '));
                card.b = `${sense.def} (${meta.join('; ')})`;
            }
            results.push(card);
        });
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

searchForm.addEventListener('submit', async function (event) {
    event.preventDefault();
    let value = searchBox.value.toLocaleLowerCase();
    if (!value) return;
    const tokens = value.split(/\s+/).filter(Boolean);
    const known = tokens.filter(t => trie[t]);

    // Clear once before rendering
    while (examplesList.firstChild) {
        examplesList.firstChild.remove();
    }

    // If few known words and user is authenticated, treat as English and call explainEnglish
    if (known.length < Math.max(1, Math.ceil(tokens.length / 2)) && getAuthenticatedUser()) {
        try {
            showAiLoading(examplesList, 'Translating…');
            const data = await callExplainEnglishText({ text: value });
            clearAiLoading(examplesList);
            if (data && data.targetLanguageText) {
                // Render as a sentence card: target from AI, English from user input
                let item = document.createElement('li');
                let targetP = document.createElement('p');
                targetP.className = 'target-example example-line';
                const aiTokens = data.targetLanguageText.split(/\s+/).filter(x => x.length);
                const anchors = makeSentenceNavigable(aiTokens, targetP, false);
                createActionMenu(examplesList, targetP, data.targetLanguageText, anchors, [{ t: aiTokens, b: value }]);
                item.appendChild(targetP);
                let baseP = document.createElement('p');
                baseP.className = 'base-example example-line';
                baseP.textContent = value;
                item.appendChild(baseP);
                examplesList.appendChild(item);
            }
        } catch (err) {
            console.error('AI English explanation failed', err);
            alert('Sorry, could not translate this text right now.');
            clearAiLoading(examplesList);
        }
        return;
    }

    // If authenticated user with multi-word target language input, call explainText
    if (getAuthenticatedUser() && tokens.length > 2) {
        try {
            showAiLoading(examplesList, 'Analyzing…');
            const data = await callExplainText({ text: value });
            clearAiLoading(examplesList);
            if (data && data.englishText) {
                // Render as a sentence card: target from user input, English from AI
                let item = document.createElement('li');
                let targetP = document.createElement('p');
                targetP.className = 'target-example example-line';
                const anchors = makeSentenceNavigable(tokens, targetP, false);
                createActionMenu(examplesList, targetP, value, anchors, [{ t: tokens, b: data.englishText }]);
                item.appendChild(targetP);
                let baseP = document.createElement('p');
                baseP.className = 'base-example example-line';
                baseP.textContent = data.englishText;
                item.appendChild(baseP);
                examplesList.appendChild(item);
            }
        } catch (err) {
            console.error('AI text explanation failed', err);
            alert('Sorry, could not analyze this text right now.');
            clearAiLoading(examplesList);
        }
        return;
    }

    if (known.length === 0) return;
    // Update graph to the first known word for context
    updateGraph(known[0]);
    // Render each known token in order
    known.forEach(w => renderWordInline(examplesList, w));
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