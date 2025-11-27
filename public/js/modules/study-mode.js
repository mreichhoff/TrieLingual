import { makeSentenceNavigable, joinTokens } from "./base.js";
import { dataTypes, registerCallback, saveStudyList, getStudyList, findOtherCards, removeFromStudyList, recordEvent, studyResult, updateCard } from "./data-layer.js";

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
    relatedCardQueryElement.innerText = anchor.textContent;
    if (!related || !related.length) {
        relatedCardsContainer.style.display = 'none';
        return;
    }
    relatedCardsElement.innerHTML = '';
    for (let i = 0; i < Math.min(MAX_RELATED_CARDS, related.length); i++) {
        let item = document.createElement('p');
        item.className = 'related-card';
        item.innerText = joinTokens(related[i][1].target);
        let relatedPerf = document.createElement('p');
        relatedPerf.className = 'related-card-performance';
        relatedPerf.innerText = `(right ${related[i][1].rightCount || 0}, wrong ${related[i][1].wrongCount || 0})`;
        item.appendChild(relatedPerf);
        relatedCardsElement.appendChild(item);
    }
    relatedCardsContainer.removeAttribute('style');
}

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
    // addTextToSpeech(cardQuestionContainer, question, aList);
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

let initialize = function () {
    const modeToggle = document.getElementById('mode-toggle');
    const exampleContainer = document.getElementById('example-container');
    const studyContainer = document.getElementById('study-container');
    let currentMode = 'explore'; // 'explore' or 'study'

    const exploreIcon = `
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
        </svg>
    `;
    const studyIcon = `
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-9 14l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
        </svg>
    `;

    modeToggle.addEventListener('click', function () {
        if (currentMode === 'explore') {
            // Switch to study mode
            currentMode = 'study';
            modeToggle.innerHTML = exploreIcon;
            modeToggle.setAttribute('aria-label', 'Switch to explore mode');
            modeToggle.setAttribute('title', 'Explore mode');
            modeToggle.classList.add('study-mode');

            // Animate out explore, animate in study
            exampleContainer.classList.add('slide-out');

            exampleContainer.addEventListener('animationend', function onExploreOut() {
                exampleContainer.removeEventListener('animationend', onExploreOut);
                exampleContainer.style.display = 'none';
                exampleContainer.classList.remove('slide-out');

                studyContainer.style.display = 'block';
                studyContainer.classList.add('slide-in');
                setupStudyMode();

                studyContainer.addEventListener('animationend', function onStudyIn() {
                    studyContainer.removeEventListener('animationend', onStudyIn);
                    studyContainer.classList.remove('slide-in');
                });
            });
        } else {
            // Switch to explore mode
            currentMode = 'explore';
            modeToggle.innerHTML = studyIcon;
            modeToggle.setAttribute('aria-label', 'Switch to study mode');
            modeToggle.setAttribute('title', 'Study mode');
            modeToggle.classList.remove('study-mode');

            // Animate out study, animate in explore
            studyContainer.classList.add('slide-out');

            studyContainer.addEventListener('animationend', function onStudyOut() {
                studyContainer.removeEventListener('animationend', onStudyOut);
                studyContainer.style.display = 'none';
                studyContainer.classList.remove('slide-out');

                exampleContainer.style.display = 'block';
                exampleContainer.classList.add('slide-in');

                exampleContainer.addEventListener('animationend', function onExploreIn() {
                    exampleContainer.removeEventListener('animationend', onExploreIn);
                    exampleContainer.classList.remove('slide-in');
                });
            });
        }
    });

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
        saveStudyList([deletedKey]);
        setupStudyMode();
    });
    exportStudyListButton.addEventListener('click', function () {
        let studyList = getStudyList();
        let content = "data:text/plain;charset=utf-8,";
        for (const [_, value] of Object.entries(studyList)) {
            //replace is a hack for flashcard field separator...TODO could escape
            content += [joinTokens(value.target).replace(';', ''), value.base.replace(';', '')].join(';');
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
};

export { initialize }