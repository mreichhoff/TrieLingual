(function () {
    'use strict';

    //TODO may want to stop this and just have it stay shown, with faq over top via absolute position/z-index
    const mainContainer$3 = document.getElementById('container');
    //faq items
    const faqContainer = document.getElementById('faq-container');
    const faqSingleCharWarning = document.getElementById('faq-single-char-warning');
    const faqStudyMode = document.getElementById('faq-study-mode');
    const faqRecommendations = document.getElementById('faq-recommendations');
    const faqContext = document.getElementById('faq-context');
    const faqGeneral = document.getElementById('faq-general');
    const faqExitButton = document.getElementById('faq-exit-button');
    const showStudyFaq = document.getElementById('show-study-faq');
    const showGeneralFaq = document.getElementById('show-general-faq');

    //TODO should combine with faqTypes
    const faqTypesToElement = {
        singleCharWarning: faqSingleCharWarning,
        studyMode: faqStudyMode,
        context: faqContext,
        general: faqGeneral,
        recommendations: faqRecommendations
    };
    const faqTypes = {
        singleCharWarning: 'singleCharWarning',
        studyMode: 'studyMode',
        context: 'context',
        general: 'general',
        recommendations: 'recommendations'
    };

    let showFaq = function (faqType) {
        mainContainer$3.style.display = 'none';
        faqContainer.removeAttribute('style');
        faqTypesToElement[faqType].removeAttribute('style');
    };

    let initialize$4 = function () {
        faqExitButton.addEventListener('click', function () {
            faqContainer.style.display = 'none';
            mainContainer$3.removeAttribute('style');
            Object.values(faqTypesToElement).forEach(x => {
                x.style.display = 'none';
            });
        });
        showStudyFaq.addEventListener('click', function () {
            showFaq(faqTypes.studyMode);
        });
        showGeneralFaq.addEventListener('click', function () {
            showFaq(faqTypes.general);
        });
    };

    const dataTypes = {
        visited: 'visited',
        studyList: 'studyList',
        studyResults: 'studyResults'
    };
    let callbacks = {
        visited: [],
        studyList: [],
        studyResults: []
    };
    const studyResult = {
        CORRECT: 'correct',
        INCORRECT: 'incorrect'
    };
    let studyList = JSON.parse(localStorage.getItem('studyList') || '{}');
    let studyResults = JSON.parse(localStorage.getItem('studyResults') || '{"hourly":{},"daily":{}}');
    let visited = JSON.parse(localStorage.getItem('visited') || '{}');

    let getStudyResults = function () {
        return studyResults;
    };
    let getVisited = function () {
        return visited;
    };
    //note: nodes will be marked visited when the user searches for or taps a node in the graph
    //for now, avoiding marking nodes visited via clicking a hanzi in an example or card
    //because in those cases no examples are shown
    let updateVisited = function (nodes) {
        for (let i = 0; i < nodes.length; i++) {
            if (!visited[nodes[i]]) {
                visited[nodes[i]] = 0;
            }
            visited[nodes[i]]++;
        }
        localStorage.setItem('visited', JSON.stringify(visited));
        callbacks[dataTypes.visited].forEach(x => x(visited));
    };

    let registerCallback = function (dataType, callback) {
        callbacks[dataType].push(callback);
    };

    //keeping keys/localStudyList for parity with current hacked together firebase version
    let saveStudyList = function (keys, localStudyList) {
        localStorage.setItem('studyList', JSON.stringify(studyList));
    };
    let updateCard = function (result, key) {
        let now = new Date();
        if (result === studyResult.INCORRECT) {
            studyList[key].nextJump = 0.5;
            studyList[key].wrongCount++;
            studyList[key].due = now.valueOf();
        } else {
            let nextJump = studyList[key].nextJump || 0.5;
            studyList[key].nextJump = nextJump * 2;
            studyList[key].rightCount++;
            studyList[key].due = now.valueOf() + (nextJump * 24 * 60 * 60 * 1000);
        }
        saveStudyList();
    };
    let addCards = function (currentExamples, text) {
        let newCards = currentExamples[text].map((x, i) => ({ ...x, due: Date.now() + i }));
        let newKeys = [];
        for (let i = 0; i < newCards.length; i++) {
            let joined = newCards[i].t.join('');
            newKeys.push(joined);
            if (!studyList[joined] && newCards[i].b) {
                studyList[joined] = {
                    base: newCards[i].b,
                    due: newCards[i].due,
                    target: newCards[i].t,
                    wrongCount: 0,
                    rightCount: 0,
                    added: Date.now()
                };
            }
        }
        //TODO: remove these keys from /deleted/ to allow re-add
        //update it whenever it changes
        saveStudyList();
        callbacks[dataTypes.studyList].forEach(x => x(studyList));
    };

    let inStudyList = function (text) {
        return studyList[text];
    };

    let getCardCount = function (character) {
        let count = 0;
        //TODO: if performance becomes an issue, we can pre-compute this
        //as-is, it performs fine even with larger flashcard decks
        Object.keys(studyList || {}).forEach(x => {
            if (x.indexOf(character) >= 0) {
                count++;
            }
        });
        return count;
    };

    let getStudyList = function () {
        return studyList;
    };
    let findOtherCards = function (seeking, currentKey) {
        let cards = Object.keys(studyList);
        let candidates = cards.filter(x => x !== currentKey && x.includes(seeking)).sort((a, b) => studyList[b].rightCount - studyList[a].rightCount);
        return candidates;
    };

    let removeFromStudyList = function (key) {
        delete studyList[key];
        callbacks[dataTypes.studyList].forEach(x => x(studyList));
    };

    let getISODate = function (date) {
        function pad(number) {
            if (number < 10) {
                return '0' + number;
            }
            return number;
        }

        return (
            date.getFullYear() +
            '-' +
            pad(date.getMonth() + 1) +
            '-' +
            pad(date.getDate()));
    };

    let recordEvent = function (result) {
        let currentDate = new Date();
        let hour = currentDate.getHours();
        let day = getISODate(currentDate);
        if (!studyResults.hourly[hour]) {
            studyResults.hourly[hour] = {};
            studyResults.hourly[hour][studyResult.CORRECT] = 0;
            studyResults.hourly[hour][studyResult.INCORRECT] = 0;
        }
        //fix up potential response from backend that doesn't include one of correct or incorrect
        //i.e., check above sets it, then we get a response when reading from backend that has the given hour but
        //no correct or incorrect property, which can happen if you get X wrong/right in a row to start an hour
        //we can be confident we'll still have hourly and daily as those are written in the same operation
        //TODO check firebase docs
        if (!studyResults.hourly[hour][result]) {
            studyResults.hourly[hour][result] = 0;
        }
        studyResults.hourly[hour][result]++;
        if (!studyResults.daily[day]) {
            studyResults.daily[day] = {};
            studyResults.daily[day][studyResult.CORRECT] = 0;
            studyResults.daily[day][studyResult.INCORRECT] = 0;
        }
        //fix up potential response from backend that doesn't include one of correct or incorrect
        //i.e., check above sets it, then we get a response when reading from backend that has the given day but
        //no correct or incorrect property, which can happen if you get X wrong/right in a row to start a day
        if (!studyResults.daily[day][result]) {
            studyResults.daily[day][result] = 0;
        }
        studyResults.daily[day][result]++;
        localStorage.setItem('studyResults', JSON.stringify(studyResults));
    };

    let cy = null;
    let bfs = function (value, elements) {
        if (!value) {
            return;
        }
        let queue = [];
        queue.push({ word: value, path: [value], trie: trie[value] });
        while (queue.length > 0) {
            //apparently shift isn't O(1) in js, but this is max 18 elements, so screw it
            let curr = queue.shift();
            elements.nodes.push({
                data: {
                    id: curr.path.join(''),
                    word: curr.word,
                    depth: curr.path.length - 1,
                    path: curr.path,
                    level: trie[curr.word]['__l']
                }
            });
            for (const [key, value] of Object.entries(curr.trie)) {
                if (key === '__l') {
                    continue;
                }
                elements.edges.push({
                    data: {
                        id: ('_edge' + curr.path.join('') + key),
                        source: curr.path.join(''),
                        target: (curr.path.join('') + key)
                    }
                });
                queue.push({ word: key, path: [...curr.path, key], trie: curr.trie[key] });
            }
        }
    };
    //this file meant to hold all cytoscape-related code
    let levelColor = function (element) {
        let level = element.data('level');
        switch (level) {
            case 6:
                return '#68aaee';
            case 5:
                return '#de68ee';
            case 4:
                return '#6de200';
            case 3:
                return '#fff249';
            case 2:
                return '#ff9b35';
            case 1:
                return '#ff635f';
        }
    };
    let nodeWidth = function (element) {
        let word = element.data('word');
        if (word.length <= 6) {
            return '45px';
        } else if (word.length <= 8) {
            return '60px';
        } else {
            return '80px';
        }
    };

    let layout = function (root) {
        return {
            name: 'breadthfirst',
            root: root,
            padding: 6,
            spacingFactor: 0.85
        };
    };
    let getStylesheet = function () {
        //TODO make this injectable
        window.matchMedia("(prefers-color-scheme: light)").matches;
        return [
            {
                selector: 'node',
                style: {
                    'background-color': levelColor,
                    'label': 'data(word)',
                    'color': 'black',
                    'font-size': '12px',
                    'shape': 'round-rectangle',
                    'width': nodeWidth,
                    'text-valign': 'center',
                    'text-halign': 'center'
                }
            },
            {
                selector: 'edge',
                style: {
                    'target-arrow-shape': 'none',
                    'curve-style': 'straight'
                }
            }
        ];
    };
    let setupCytoscape = function (root, elements, graphContainer, nodeEventHandler, edgeEventHandler) {
        cy = cytoscape({
            container: graphContainer,
            elements: elements,
            layout: layout(root),
            style: getStylesheet(),
            maxZoom: 10,
            minZoom: 0.5
        });
        cy.on('tap', 'node', nodeEventHandler);
        cy.on('tap', 'edge', edgeEventHandler);
    };
    let initializeGraph = function (value, containerElement, nodeEventHandler, edgeEventHandler) {
        let result = { 'nodes': [], 'edges': [] };
        bfs(value, result);
        setupCytoscape(value, result, containerElement, nodeEventHandler, edgeEventHandler);
    };
    let isInGraph = function (node) {
        return cy && cy.getElementById(node).length;
    };
    let updateColorScheme = function () {
        if (!cy) {
            return;
        }
        cy.style(getStylesheet());
    };

    //TODO: like in other files, remove these dups
    const recommendationsContainer = document.getElementById('recommendations-container');
    const searchBox$1 = document.getElementById('search-box');
    let recommendationsWorker = null;

    let initialize$3 = function () {
        recommendationsWorker = new Worker('js/modules/recommendations-worker.js');
        recommendationsWorker.postMessage({
            type: 'graph',
            payload: window.trie
        });
        recommendationsWorker.postMessage({
            type: 'visited',
            payload: getVisited()
        });
        registerCallback(dataTypes.visited, function (visited) {
            recommendationsWorker.postMessage({
                type: 'visited',
                payload: visited
            });
        });
        recommendationsWorker.onmessage = function (e) {
            //this whole function could really use a refactor
            if (e.data.recommendations && e.data.recommendations.length) {
                recommendationsContainer.innerHTML = '';
                let recommendationMessage = document.createElement('span');
                recommendationMessage.style.display = 'none';
                recommendationMessage.innerText = "Recommended:";
                recommendationMessage.className = "recommendation-message";
                recommendationsContainer.appendChild(recommendationMessage);
                recommendationsContainer.removeAttribute('style');
                let usedRecommendation = false;
                for (let i = 0; i < e.data.recommendations.length; i++) {
                    //don't bother recommending items already being shown in the graph
                    if (isInGraph(e.data.recommendations[i])) {
                        continue;
                    }
                    recommendationMessage.removeAttribute('style');
                    let curr = document.createElement('a');
                    curr.innerText = e.data.recommendations[i];
                    curr.className = 'recommendation';
                    curr.addEventListener('click', function (event) {
                        //can I do this?
                        searchBox$1.value = event.target.innerText;
                        document.querySelector('#search-form input[type=submit]').click();
                        event.target.style.display = 'none';
                        let otherRecs = document.querySelectorAll('.recommendation');
                        let stillShown = false;
                        for (let i = 0; i < otherRecs.length; i++) {
                            if (!otherRecs[i].style.display || otherRecs[i].style.display !== 'none') {
                                stillShown = true;
                                break;
                            }
                        }
                        if (!stillShown) {
                            recommendationsContainer.style.display = 'none';
                        }
                    });
                    recommendationsContainer.appendChild(curr);
                    usedRecommendation = true;
                }
                let recommendationsFaqLink = document.createElement('a');
                recommendationsFaqLink.className = 'faq-link';
                recommendationsFaqLink.innerText = "Why?";
                recommendationsFaqLink.addEventListener('click', function () {
                    showFaq(faqTypes.recommendations);
                });
                if (usedRecommendation) {
                    recommendationsContainer.appendChild(recommendationsFaqLink);
                }
            } else {
                recommendationsContainer.style.display = 'none';
            }
        };
    };
    let graphChanged = function () {
        recommendationsWorker.postMessage({
            type: 'graph',
            payload: window.trie
        });
    };
    let preferencesChanged = function (val) {
        let minLevel = 1;
        let maxLevel = 6;
        if (val === 'easy') {
            maxLevel = 3;
        } else if (val === 'hard') {
            minLevel = 4;
        }
        recommendationsWorker.postMessage({
            type: 'levelPreferences',
            payload: {
                minLevel: minLevel,
                maxLevel: maxLevel
            }
        });
    };

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
        'pt-BR': new Set([".", ",", ":", "!", "?"])
    };
    const defaultWords = {
        'fr-FR': ['bras', 'travail', 'participation'],
        'pt-BR': ['braço', 'trabalho', 'participação']
    };

    let languageOptions$1 = {
        'French': 'fr-FR',
        'Portuguese': 'pt-BR'
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
    };

    //top-level section container
    const mainContainer$2 = document.getElementById('container');

    const exploreTab = document.getElementById('show-explore');
    const studyTab$1 = document.getElementById('show-study');

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
            let lastIndex = 0;
            utterance.addEventListener('boundary', function (event) {
                lastIndex++;
                if (anchors && lastIndex < anchors.length) {
                    anchors[lastIndex].style.fontWeight = 'bold';
                }
            });
            utterance.addEventListener('end', function () {
                anchors.forEach(word => {
                    word.style.fontWeight = 'normal';
                });
            });
            speechSynthesis.speak(utterance);
            if (anchors && anchors.length) {
                anchors[0].style.fontWeight = 'bold';
            }
        }
    };

    let addTextToSpeech = function (holder, text, aList) {
        let textToSpeechButton = document.createElement('span');
        textToSpeechButton.className = 'text-button listen';
        textToSpeechButton.textContent = 'Listen';
        textToSpeechButton.addEventListener('click', runTextToSpeech.bind(this, text, aList), false);
        holder.appendChild(textToSpeechButton);
    };
    let addSaveToListButton = function (holder, text) {
        let buttonTexts = ['In your study list!', 'Add to study list'];
        let saveToListButton = document.createElement('span');
        saveToListButton.className = 'text-button';
        saveToListButton.textContent = inStudyList(text) ? buttonTexts[0] : buttonTexts[1];
        saveToListButton.addEventListener('click', function () {
            addCards(currentExamples, text);
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
    let setupDefinitions = function (definitionList, definitionHolder) {
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
                    let definitionItem = document.createElement('li');
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
        wordHolder.textContent = words.join(' ');
        addTextToSpeech(wordHolder, words, []);
        addSaveToListButton(wordHolder, words);
        item.appendChild(wordHolder);

        let definitionHolder = document.createElement('ul');
        definitionHolder.className = 'definition';
        let definitionList = [];
        words.forEach(x => {
            if (definitions[x]) {
                definitionList.push(definitions[x]);
            }
        });
        setupDefinitions(definitionList, definitionHolder);
        item.appendChild(definitionHolder);

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

        currentExamples[words].push(getCardFromDefinitions(words, definitionList));
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
    let getCardFromDefinitions = function (text, definitionList) {
        //this assumes definitionList non null
        let result = { t: [text] };
        let answer = '';
        for (let i = 0; i < definitionList.length; i++) {
            answer += definitionList[i].pinyin + ': ' + definitionList[i].en;
            answer += i == definitionList.length - 1 ? '' : ', ';
        }
        result['b'] = answer;
        return result;
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
        mainContainer$2.append(nextGraph);
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

    let initialize$2 = function () {
        let oldState = JSON.parse(localStorage.getItem('state'));
        //TODO: make specialized tries
        for (const [key, value] of Object.entries(languageOptions$1)) {
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
                    });
                } else {
                    //TODO: is this actually what we want?
                    setupExamples(oldState.ngram);
                }
            }
            undoChain = oldState.undoChain;
            if (oldState.activeTab === tabs.study) {
                //reallllllly need a toggle method
                //this does set up the current card, etc.
                studyTab$1.click();
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
        let value = searchBox.value;
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
        studyTab$1.classList.remove('active');
        activeTab = tabs.explore;
        persistState();
    });

    studyTab$1.addEventListener('click', function () {
        exampleContainer.style.display = 'none';
        studyContainer.removeAttribute('style');
        studyTab$1.classList.add('active');
        exploreTab.classList.remove('active');
        activeTab = tabs.study;
        persistState();
    });

    recommendationsDifficultySelector.addEventListener('change', function () {
        let val = recommendationsDifficultySelector.value;
        preferencesChanged(val);
    });

    menuButton.addEventListener('click', function () {
        mainContainer$2.style.display = 'none';
        menuContainer.removeAttribute('style');
    });
    menuExitButton.addEventListener('click', function () {
        menuContainer.style.display = 'none';
        mainContainer$2.removeAttribute('style');
    });

    let switchLanguage = function () {
        let value = languageSelector.value;
        let selectedLanguage = languageOptions$1[value];
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
            persistState();
        }
    };
    languageSelector.addEventListener('change', switchLanguage);

    //TODO probably doesn't belong here and should instead be indirected (could also just export from base)
    const studyTab = document.getElementById('show-study');

    const exportStudyListButton = document.getElementById('exportStudyListButton');
    const cardQuestionContainer = document.getElementById('card-question-container');
    const cardAnswerContainer = document.getElementById('card-answer-container');
    const showAnswerButton = document.getElementById('show-answer-button');
    const taskCompleteElement = document.getElementById('task-complete');
    const cardsDueElement = document.getElementById('cards-due');
    const cardsDueCounter = document.getElementById('card-due-count');
    const taskDescriptionElement = document.getElementById('task-description');
    const cardAnswerElement = document.getElementById('card-answer');
    const wrongButton = document.getElementById('wrong-button');
    const rightButton = document.getElementById('right-button');
    const deleteCardButton = document.getElementById('delete-card-button');

    const relatedCardsContainer = document.getElementById('related-cards-container');
    const relatedCardsElement = document.getElementById('related-cards');
    const relatedCardQueryElement = document.getElementById('related-card-query');
    const cardOldMessageElement = document.getElementById('card-old-message');
    const cardNewMessageElement = document.getElementById('card-new-message');
    const cardRightCountElement = document.getElementById('card-right-count');
    const cardWrongCountElement = document.getElementById('card-wrong-count');
    const cardPercentageElement = document.getElementById('card-percentage');

    let currentKey = null;

    let displayRelatedCards = function (anchor) {
        let MAX_RELATED_CARDS = 3;
        let related = findOtherCards(anchor.textContent, currentKey);
        let studyList = getStudyList();
        relatedCardQueryElement.innerText = anchor.textContent;
        if (!related || !related.length) {
            relatedCardsContainer.style.display = 'none';
            return;
        }
        relatedCardsElement.innerHTML = '';
        for (let i = 0; i < Math.min(MAX_RELATED_CARDS, related.length); i++) {
            let item = document.createElement('p');
            item.className = 'related-card';
            item.innerText = related[i];
            let relatedPerf = document.createElement('p');
            relatedPerf.className = 'related-card-performance';
            relatedPerf.innerText = `(right ${studyList[related[i]].rightCount || 0}, wrong ${studyList[related[i]].wrongCount || 0})`;
            item.appendChild(relatedPerf);
            relatedCardsElement.appendChild(item);
        }
        relatedCardsContainer.removeAttribute('style');
    };

    let setupStudyMode = function () {
        let studyList = getStudyList();
        currentKey = null;
        let currentCard = null;
        cardAnswerContainer.style.display = 'none';
        showAnswerButton.innerText = "Show Answer";
        let counter = 0;
        for (const [key, value] of Object.entries(studyList)) {
            if (value.due <= Date.now()) {
                if (!currentCard || currentCard.due > value.due ||
                    (currentCard.due == value.due && value.target.length < currentCard.target.length)) {
                    currentCard = value;
                    currentKey = key;
                }
                counter++;
            }
        }
        cardsDueCounter.textContent = counter;
        cardQuestionContainer.innerHTML = '';
        if (counter === 0) {
            taskCompleteElement.style.display = 'inline';
            taskDescriptionElement.style.display = 'none';
            showAnswerButton.style.display = 'none';
            return;
        } else {
            taskCompleteElement.style.display = 'none';
            taskDescriptionElement.style.display = 'inline';
            showAnswerButton.style.display = 'block';
        }
        let question = joinTokens(currentCard.target);
        let aList = makeSentenceNavigable(currentCard.target, cardQuestionContainer);
        for (let i = 0; i < aList.length; i++) {
            aList[i].addEventListener('click', displayRelatedCards.bind(this, aList[i]));
        }
        addTextToSpeech(cardQuestionContainer, question, aList);
        cardAnswerElement.textContent = currentCard.base;
        if (currentCard.wrongCount + currentCard.rightCount != 0) {
            cardOldMessageElement.removeAttribute('style');
            cardNewMessageElement.style.display = 'none';
            cardPercentageElement.textContent = Math.round(100 * currentCard.rightCount / ((currentCard.rightCount + currentCard.wrongCount) || 1));
            cardRightCountElement.textContent = `${currentCard.rightCount || 0} time${currentCard.rightCount != 1 ? 's' : ''}`;
            cardWrongCountElement.textContent = `${currentCard.wrongCount || 0} time${currentCard.wrongCount != 1 ? 's' : ''}`;
        } else {
            cardNewMessageElement.removeAttribute('style');
            cardOldMessageElement.style.display = 'none';
        }
        relatedCardsContainer.style.display = 'none';
    };

    let initialize$1 = function () {
        showAnswerButton.addEventListener('click', function () {
            showAnswerButton.innerText = "Answer:";
            cardAnswerContainer.style.display = 'block';
            showAnswerButton.scrollIntoView();
        });
        wrongButton.addEventListener('click', function () {
            updateCard(studyResult.INCORRECT, currentKey);
            setupStudyMode();
            cardsDueElement.scrollIntoView();
            cardsDueElement.classList.add('result-indicator-wrong');
            setTimeout(function () {
                cardsDueElement.classList.remove('result-indicator-wrong');
            }, 750);
            recordEvent(studyResult.INCORRECT);
        });
        rightButton.addEventListener('click', function () {
            updateCard(studyResult.CORRECT, currentKey);
            setupStudyMode();
            cardsDueElement.scrollIntoView();
            cardsDueElement.classList.add('result-indicator-right');
            setTimeout(function () {
                cardsDueElement.classList.remove('result-indicator-right');
            }, 750);
            recordEvent(studyResult.CORRECT);
        });
        deleteCardButton.addEventListener('click', function () {
            let deletedKey = currentKey;
            removeFromStudyList(deletedKey);
            //use deletedKey rather than currentKey since saveStudyList can end up modifying what we have
            //same with addDeletedKey
            saveStudyList();
            setupStudyMode();
        });
        exportStudyListButton.addEventListener('click', function () {
            let studyList = getStudyList();
            let content = "data:text/plain;charset=utf-8,";
            for (const [key, value] of Object.entries(studyList)) {
                //replace is a hack for flashcard field separator...TODO could escape
                content += [key.replace(';', ''), value.base.replace(';', '')].join(';');
                content += '\n';
            }
            //wow, surely it can't be this absurd
            let encodedUri = encodeURI(content);
            let link = document.createElement("a");
            link.setAttribute("href", encodedUri);
            link.setAttribute("download", "trielingual-export-" + Date.now() + ".txt");
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        });
        if (Object.keys(getStudyList() || {}).length > 0) {
            exportStudyListButton.removeAttribute('style');
        }
        //TODO: may want to consider separate callback types for add/delete and also updated
        registerCallback(dataTypes.studyList, function (studyList) {
            if (studyList && Object.keys(studyList).length > 0) {
                exportStudyListButton.removeAttribute('style');
            } else {
                exportStudyListButton.style.display = 'none';
            }
        });
        studyTab.addEventListener('click', function () {
            setupStudyMode();
        });
    };

    //TODO move these to a central spot
    const mainContainer$1 = document.getElementById('container');
    const statsContainer = document.getElementById('stats-container');

    const statsShow = document.getElementById('stats-show');
    const statsExitButton = document.getElementById('exit-button');

    const hourlyGraphDetail = document.getElementById('hourly-graph-detail');
    const addedCalendarDetail = document.getElementById('added-calendar-detail');
    const studyCalendarDetail = document.getElementById('study-calendar-detail');
    const studyGraphDetail = document.getElementById('studied-graph-detail');
    const visitedGraphDetail = document.getElementById('visited-graph-detail');

    const MAX_MISSING_WORDS = 100;

    let lastLevelUpdatePrefix = '';

    function sameDay(d1, d2) {
        return d1.getUTCFullYear() == d2.getUTCFullYear() &&
            d1.getUTCMonth() == d2.getUTCMonth() &&
            d1.getUTCDate() == d2.getUTCDate();
    }
    function Calendar(data, {
        id,
        clickHandler = () => { },
        getIntensity = () => { return '' }
    } = {}) {
        let now = new Date();
        let root = document.createElement('div');
        root.id = `${id}-calendar`;
        root.className = 'calendar';
        for (let i = 0; i < data[0].date.getUTCDay(); i++) {
            if (i === 0) {
                let monthIndicator = document.createElement('div');
                monthIndicator.style.gridRow = '1';
                monthIndicator.className = 'month-indicator';
                root.appendChild(monthIndicator);
            }
            let currentDay = document.createElement('div');
            currentDay.className = 'calendar-day-dummy';
            currentDay.style.gridRow = `${i + 2}`;
            root.appendChild(currentDay);
        }

        for (let i = 0; i < data.length; i++) {
            if (data[i].date.getUTCDay() === 0) {
                let monthIndicator = document.createElement('div');
                monthIndicator.style.gridRow = '1';
                monthIndicator.className = 'month-indicator';
                if (data[i].date.getUTCDate() < 8) {
                    monthIndicator.innerText = data[i].date.toLocaleString('default', { month: 'short', timeZone: 'UTC' });
                }
                root.appendChild(monthIndicator);
            }
            let currentDay = document.createElement('div');
            if (sameDay(now, data[i].date)) {
                currentDay.id = `${id}-today`;
                currentDay.classList.add('today');
            } else if (now.valueOf() < data[i].date.valueOf()) {
                currentDay.classList.add('future');
            }
            currentDay.style.gridRow = `${data[i].date.getUTCDay() + 2}`;
            //currentDay.style.gridColumn = `${12 - i}`;
            currentDay.classList.add('calendar-day');
            currentDay.classList.add(getIntensity(data[i].total));
            currentDay.addEventListener('click', clickHandler.bind(this, 0, i));
            root.appendChild(currentDay);
        }
        return root;
    }
    function BarChart(data, {
        labelText = () => { return '' },
        color = () => { return '' },
        clickHandler = () => { },
        includeYLabel = true,
        customClass,
        scaleToFit
    } = {}) {
        let root = document.createElement('div');
        root.classList.add('bar-chart');
        if (customClass) {
            root.classList.add(customClass);
        }
        if (includeYLabel) {
            root.style.gridTemplateColumns = `50px repeat(${data.length}, 1fr)`;
            for (let i = 10; i >= 1; i--) {
                let yLabel = document.createElement('div');
                yLabel.style.gridRow = `${100 - (10 * i)}`;
                yLabel.innerText = `${10 * i}% -`;
                yLabel.className = 'bar-chart-y-label';
                root.appendChild(yLabel);
            }
        } else {
            root.style.gridTemplateColumns = `repeat(${data.length}, 1fr)`;
        }
        let scaleMultiplier = 1;
        if (scaleToFit) {
            scaleMultiplier = 100;
            //TODO if you ever get really serious, you could determine the number of rows
            //in the grid for scaling purposes instead of scaling across 100 total
            for (let i = 0; i < data.length; i++) {
                let curr = Math.floor(1 / ((data[i].count || 1) / (data[i].total || 100)));
                scaleMultiplier = Math.min(curr || 1, scaleMultiplier);
            }
        }
        for (let i = 0; i < data.length; i++) {
            let bar = document.createElement('div');
            bar.className = 'bar-chart-bar';
            bar.style.gridColumn = `${i + (includeYLabel ? 2 : 1)}`;
            bar.style.backgroundColor = color(i);
            //how many `|| 1` is too many?
            //you know what, don't answer
            bar.style.gridRow = `${(100 - (Math.floor(100 * (data[i].count * scaleMultiplier) / (data[i].total || 1)) || 1)) || 1} / 101`;
            bar.addEventListener('click', clickHandler.bind(this, i));
            root.appendChild(bar);
        }
        let hr = document.createElement('div');
        hr.style.gridRow = '101';
        //don't try this at home
        hr.style.gridColumn = `${includeYLabel ? 2 : 1}/max`;
        hr.className = 'bar-chart-separator';
        root.appendChild(hr);
        for (let i = 0; i < data.length; i++) {
            let xLabel = document.createElement('div');
            xLabel.className = 'bar-chart-x-label';
            xLabel.style.gridColumn = `${i + (includeYLabel ? 2 : 1)}`;
            xLabel.style.gridRow = '102';
            xLabel.innerText = labelText(i);
            root.appendChild(xLabel);
        }
        return root;
    }

    //TODO: combine with the one in data-layer.js
    let getUTCISODate = function (date) {
        function pad(number) {
            if (number < 10) {
                return '0' + number;
            }
            return number;
        }

        return (
            date.getUTCFullYear() +
            '-' +
            pad(date.getUTCMonth() + 1) +
            '-' +
            pad(date.getUTCDate()));
    };
    let getLocalISODate = function (date) {
        function pad(number) {
            if (number < 10) {
                return '0' + number;
            }
            return number;
        }

        return (
            date.getFullYear() +
            '-' +
            pad(date.getMonth() + 1) +
            '-' +
            pad(date.getDate()));
    };
    let fillGapDays = function (daysWithData, originalData, defaultEntry) {
        let firstDayStudied = daysWithData.length ? daysWithData[0].date : new Date();
        //TODO add trollface ascii art to this insanity
        let today = new Date(getLocalISODate(new Date()));

        //always show at least the last 365 days
        let floorDate = new Date(today.valueOf() - 365 * 24 * 60 * 60 * 1000);
        if (firstDayStudied.valueOf() < floorDate.valueOf()) {
            floorDate = firstDayStudied;
        }

        let start = new Date(getLocalISODate(floorDate));
        let end = new Date(today.valueOf() + (7 * 24 * 60 * 60 * 1000));
        let curr = start.valueOf();
        while (curr <= end.valueOf()) {
            let next = new Date(curr);
            if (!(getUTCISODate(next) in originalData)) {
                daysWithData.push({
                    date: next,
                    ...defaultEntry
                });
            }
            curr += (24 * 60 * 60 * 1000);
        }
    };
    let BarChartClickHandler = function (detail, totalsByLevel, prop, index, message) {
        detail.innerHTML = '';
        //TODO: why no built-in difference method?
        let missingWords = new Set([...totalsByLevel[index + 1].characters].filter(x => !totalsByLevel[index + 1][prop].has(x)));
        let i = 0;
        for (let item of missingWords) {
            if (i < MAX_MISSING_WORDS) {
                message += item + ', ';
                i++;
            } else {
                break;
            }
        }
        detail.innerHTML = message;
    };
    //could be an array, but we're possibly going to add out of order, and also trying to avoid hardcoding max level
    let totalsByLevel = {};
    let updateTotalsByLevel = function () {
        totalsByLevel = {};
        Object.keys(trie).forEach(x => {
            let level = trie[x]['__l'];
            if (!(level in totalsByLevel)) {
                totalsByLevel[level] = { seen: new Set(), total: 0, visited: new Set(), characters: new Set() };
            }
            totalsByLevel[level].total++;
            totalsByLevel[level].characters.add(x);
        });
    };
    let createCardGraphs = function (studyList, legend) {
        let studyListCharacters = new Set();
        Object.keys(studyList).forEach(x => {
            //TODO: object.entries likely better
            for (let i = 0; i < studyList[x].target.length; i++) {
                studyListCharacters.add(studyList[x].target[i].toLowerCase());
            }
        });
        studyListCharacters.forEach(x => {
            if (trie[x]) {
                let level = trie[x]['__l'];
                totalsByLevel[level].seen.add(x);
            }
        });
        let levelData = [];
        //safe since we don't add keys in the read of /decks/
        Object.keys(totalsByLevel).sort().forEach(x => {
            levelData.push({
                count: totalsByLevel[x].seen.size || 0,
                total: totalsByLevel[x].total
            });
        });
        const studiedGraph = document.getElementById('studied-graph');
        studiedGraph.innerHTML = '';
        studiedGraph.appendChild(
            BarChart(levelData, {
                labelText: (i) => legend[i],
                color: () => "#68aaee",
                clickHandler: function (i) {
                    BarChartClickHandler(
                        studyGraphDetail,
                        totalsByLevel,
                        'seen',
                        i,
                        `In ${legend[i]}, your study list doesn't yet contain:<br>`
                    );
                }
            })
        );


        let addedByDay = {};
        let sortedCards = Object.values(studyList).sort((x, y) => {
            return (x.added || 0) - (y.added || 0);
        });
        let seenCharacters = new Set();
        for (const card of sortedCards) {
            //hacky, but truncate to day granularity this way
            if (card.added) {
                let day = getLocalISODate(new Date(card.added));
                if (!(day in addedByDay)) {
                    addedByDay[day] = {
                        chars: new Set(),
                        total: 0
                    };
                }
                addedByDay[day].total++;
                card.target.forEach(rawWord => {
                    let word = rawWord.toLowerCase();
                    if (trie[word] && !seenCharacters.has(word)) {
                        addedByDay[day].chars.add(word);
                        seenCharacters.add(word);
                    }
                });
            } else {
                //cards are sorted with unknown add date at front, so safe to add all at the start
                card.target.forEach(rawWord => {
                    let word = rawWord.toLowerCase();
                    if (trie[word]) {
                        seenCharacters.add(word);
                    }
                });
            }
        }
        let dailyAdds = [];
        for (const [date, result] of Object.entries(addedByDay)) {
            dailyAdds.push({
                date: new Date(date),
                chars: result.chars,
                total: result.total
            });
        }

        fillGapDays(dailyAdds, addedByDay, { chars: new Set(), total: 0 });
        dailyAdds.sort((x, y) => x.date - y.date);

        const addedCalendar = document.getElementById('added-calendar');
        addedCalendar.innerHTML = '';
        addedCalendar.appendChild(
            Calendar(dailyAdds, {
                id: 'added-calendar',
                getIntensity: function (total) {
                    if (total == 0) {
                        return 'empty';
                    } else if (total < 6) {
                        return 's';
                    } else if (total < 12) {
                        return 'm';
                    } else if (total < 18) {
                        return 'l';
                    } else if (total < 24) {
                        return 'xl';
                    } else if (total < 30) {
                        return 'xxl';
                    } else {
                        return 'epic';
                    }
                },
                clickHandler: function (_, i) {
                    addedCalendarDetail.innerHTML = '';

                    let data = dailyAdds[i];
                    let characters = '';
                    data.chars.forEach(x => characters += x + ', ');
                    if (data.total && data.chars.size) {
                        addedCalendarDetail.innerText = `On ${getUTCISODate(data.date)}, you added ${data.total} cards, with these new words: ${characters}`;
                    } else if (data.total) {
                        addedCalendarDetail.innerText = `On ${getUTCISODate(data.date)}, you added ${data.total} cards, with no new words.`;
                    } else {
                        addedCalendarDetail.innerText = `On ${getUTCISODate(data.date)}, you added no new cards.`;
                    }
                }
            })
        );
        document.getElementById('added-calendar-calendar').scrollTo({
            top: 0,
            left: document.getElementById('added-calendar-today').offsetLeft
        });
    };
    let createVisitedGraphs = function (visitedCharacters, legend) {
        if (!visitedCharacters) {
            return;
        }
        Object.keys(visitedCharacters).forEach(x => {
            if (trie[x]) {
                const level = trie[x]['__l'];
                totalsByLevel[level].visited.add(x);
            }
        });
        let levelData = [];
        //safe since we don't add keys in the read of /decks/
        Object.keys(totalsByLevel).sort().forEach(x => {
            levelData.push({
                count: totalsByLevel[x].visited.size || 0,
                total: totalsByLevel[x].total
            });
        });
        const visitedGraph = document.getElementById('visited-graph');
        visitedGraph.innerHTML = '';
        visitedGraph.appendChild(
            BarChart(levelData, {
                labelText: (i) => legend[i],
                color: () => "#68aaee",
                clickHandler: function (i) {
                    BarChartClickHandler(
                        visitedGraphDetail,
                        totalsByLevel,
                        'visited',
                        i,
                        `In ${legend[i]}, you haven't yet visited:<br>`
                    );
                }
            })
        );
        document.getElementById('visited-container').removeAttribute('style');
    };

    let createStudyResultGraphs = function (results) {
        let hourlyData = [];
        let dailyData = [];
        for (let i = 0; i < 24; i++) {
            hourlyData.push({
                hour: i,
                correct: (i.toString() in results.hourly) ? (results.hourly[i.toString()].correct || 0) : 0,
                incorrect: (i.toString() in results.hourly) ? (results.hourly[i.toString()].incorrect || 0) : 0
            });
        }
        let total = 0;
        for (let i = 0; i < hourlyData.length; i++) {
            total += hourlyData[i].correct + hourlyData[i].incorrect;
        }
        for (let i = 0; i < 24; i++) {
            hourlyData[i]['count'] = hourlyData[i].correct + hourlyData[i].incorrect;
            hourlyData[i]['total'] = total;
        }
        let daysStudied = Object.keys(results.daily);
        //ISO 8601 lexicographically sortable
        daysStudied.sort((x, y) => x.localeCompare(y));
        for (let i = 0; i < daysStudied.length; i++) {
            let correct = results.daily[daysStudied[i]].correct || 0;
            let incorrect = results.daily[daysStudied[i]].incorrect || 0;
            let total = correct + incorrect;
            dailyData.push({
                date: new Date(daysStudied[i]),
                total: total,
                result: correct - incorrect,
                correct: correct,
                incorrect: incorrect
            });
        }
        fillGapDays(dailyData, results.daily, {
            total: 0,
            result: 0,
            correct: 0,
            incorrect: 0
        });
        dailyData.sort((x, y) => x.date - y.date);
        const studyCalendar = document.getElementById('study-calendar');
        studyCalendar.innerHTML = '';
        studyCalendar.appendChild(
            Calendar(dailyData, {
                id: 'study-calendar',
                getIntensity: function (total) {
                    if (total == 0) {
                        return 'empty';
                    } else if (total < 10) {
                        return 's';
                    } else if (total < 25) {
                        return 'm';
                    } else if (total < 50) {
                        return 'l';
                    } else if (total < 100) {
                        return 'xl';
                    } else if (total < 150) {
                        return 'xxl';
                    } else {
                        return 'epic';
                    }
                },
                clickHandler: function (_, i) {
                    studyCalendarDetail.innerHTML = '';

                    let data = dailyData[i];
                    studyCalendarDetail.innerText = `On ${getUTCISODate(data.date)}, you studied ${data.total || 0} cards. You got ${data.correct} right and ${data.incorrect} wrong.`;
                }
            })
        );
        document.getElementById('study-calendar-container').removeAttribute('style');
        document.getElementById('study-calendar-calendar').scrollTo({
            top: 0,
            left: document.getElementById('study-calendar-today').offsetLeft
        });
        //why, you ask? I don't know
        let getHour = function (hour) { return hour == 0 ? '12am' : (hour < 12 ? `${hour}am` : hour == 12 ? '12pm' : `${hour % 12}pm`) };
        let hourlyClickHandler = function (i) {
            if ((hourlyData[i].correct + hourlyData[i].incorrect) !== 0) {
                hourlyGraphDetail.innerText = `In the ${getHour(hourlyData[i].hour)} hour, you've gotten ${hourlyData[i].correct} correct and ${hourlyData[i].incorrect} incorrect, or ${Math.round((hourlyData[i].correct / (hourlyData[i].correct + hourlyData[i].incorrect)) * 100)}% correct.`;
            } else {
                hourlyGraphDetail.innerText = `In the ${getHour(hourlyData[i].hour)} hour, you've not studied.`;
            }
        };
        let hourlyColor = i => {
            let percentage = (hourlyData[i].correct / (hourlyData[i].correct + hourlyData[i].incorrect)) * 100;
            if (percentage <= 100 && percentage >= 75) {
                return '#6de200';
            }
            if (percentage < 75 && percentage >= 50) {
                return '#68aaee';
            }
            if (percentage < 50 && percentage >= 25) {
                return '#ff9b35';
            }
            if (percentage < 25) {
                return '#ff635f';
            }
        };
        const hourlyGraph = document.getElementById('hourly-graph');
        hourlyGraph.innerHTML = '';
        hourlyGraph.appendChild(
            BarChart(hourlyData, {
                labelText: (i) => getHour(i),
                color: hourlyColor,
                clickHandler: hourlyClickHandler,
                includeYLabel: false,
                customClass: 'hours',
                scaleToFit: true
            })
        );
        document.getElementById('hourly-container').removeAttribute('style');
    };

    let initialize = function () {
        lastLevelUpdatePrefix = getActiveGraph().prefix;
        updateTotalsByLevel();
        statsShow.addEventListener('click', function () {
            let activeGraph = getActiveGraph();
            if (activeGraph.prefix !== lastLevelUpdatePrefix) {
                lastLevelUpdatePrefix = activeGraph.prefix;
                updateTotalsByLevel();
            }
            mainContainer$1.style.display = 'none';
            statsContainer.removeAttribute('style');
            createVisitedGraphs(getVisited(), activeGraph.legend);
            createCardGraphs(getStudyList(), activeGraph.legend);
            createStudyResultGraphs(getStudyResults());
        });

        statsExitButton.addEventListener('click', function () {
            statsContainer.style.display = 'none';
            mainContainer$1.removeAttribute('style');
            //TODO this is silly
            studyGraphDetail.innerText = '';
            addedCalendarDetail.innerText = '';
            visitedGraphDetail.innerText = '';
            studyCalendarDetail.innerText = '';
            hourlyGraphDetail.innerText = '';
        });
    };

    let languageOptions = [
        {
            element: document.getElementById('french-language-card'),
            targetLang: 'fr-FR'
        },
        {
            element: document.getElementById('portuguese-language-card'),
            targetLang: 'pt-BR'
        }
    ];
    const mainContainer = document.getElementById('container');
    const landingContainer = document.getElementById('landing');

    let init = function () {
        Promise.all(
            [
                window.trieFetch
                    .then(response => response.json())
                    .then(data => window.trie = data),
                window.sentencesFetch
                    .then(response => response.json())
                    .then(data => window.sentences = data),
                window.definitionsFetch
                    .then(response => response.json())
                    .then(data => window.definitions = data)
            ]
        ).then(_ => {
            landingContainer.style.display = 'none';
            mainContainer.removeAttribute('style');
            initialize$1();
            initialize$2();
            initialize();
            initialize$4();
            initialize$3();
        });
    };

    if (targetLang) {
        init();
    } else {
        const grid = document.getElementById('language-grid');
        languageOptions.forEach(x => {
            x.element.addEventListener('click', function (e) {
                window.targetLang = x.targetLang;
                languageOptions.forEach(item => {
                    if (item.targetLang !== targetLang) {
                        item.element.style.display = 'none';
                    }
                });
                grid.classList.add('language-grid-selected');
                e.currentTarget.classList.add('language-selected');
                window.trieFetch = fetch(`./data/${targetLang}/trie.json`);
                window.sentencesFetch = fetch(`./data/${targetLang}/sentences.json`);
                window.definitionsFetch = fetch(`./data/${targetLang}/definitions.json`);
                init();
            });
        });
    }
    //ideally we'll continue adding to this

})();
