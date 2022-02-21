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
let studyList = JSON.parse(localStorage.getItem(`studyList/${targetLang}`) || '{}');
let studyResults = JSON.parse(localStorage.getItem(`studyResults/${targetLang}`) || '{"hourly":{},"daily":{}}');
let visited = JSON.parse(localStorage.getItem(`visited/${targetLang}`) || '{}');

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
    localStorage.setItem(`visited/${targetLang}`, JSON.stringify(visited));
    callbacks[dataTypes.visited].forEach(x => x(visited));
};

let registerCallback = function (dataType, callback) {
    callbacks[dataType].push(callback);
};

//keeping keys/localStudyList for parity with current hacked together firebase version
let saveStudyList = function (keys, localStudyList) {
    localStorage.setItem(`studyList/${targetLang}`, JSON.stringify(studyList));
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
    saveStudyList([key]);
};
let addCards = function (examples) {
    let newCards = examples.map((x, i) => ({ ...x, due: Date.now() + i }));
    let newKeys = [];
    for (let i = 0; i < newCards.length; i++) {
        let key = sanitizeKey(getKey(newCards[i].t));
        newKeys.push(key);
        if (!studyList[key] && newCards[i].b) {
            studyList[key] = {
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
    saveStudyList(newKeys);
    callbacks[dataTypes.studyList].forEach(x => x(studyList));
};

let inStudyList = function (tokens) {
    return studyList[sanitizeKey(getKey(tokens))];
};

let getCardCount = function (word) {
    let count = 0;
    //TODO: if performance becomes an issue, we can pre-compute this
    //as-is, it performs fine even with larger flashcard decks
    Object.entries(studyList || {}).forEach(([_, value]) => {
        if (value.target.some(token => token.toLocaleLowerCase() === word.trim().toLocaleLowerCase())) {
            count++;
        }
    });
    return count;
};

let getStudyList = function () {
    return studyList;
}
let findOtherCards = function (seeking, currentKey) {
    let candidates = Object.entries(studyList || {}).filter(([key, value]) => key !== currentKey && value.target.some(token => token.toLocaleLowerCase() === seeking.trim().toLocaleLowerCase()));
    candidates.sort((a, b) => b[1].rightCount - a[1].rightCount);
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
    localStorage.setItem(`studyResults/${targetLang}`, JSON.stringify(studyResults));
};

//TODO: unused stuff from the firebase side
let mergeStudyLists = function (baseStudyList, targetStudyList) {
    baseStudyList = baseStudyList || {};
    for (const key in targetStudyList) {
        if (!baseStudyList[key] ||
            (baseStudyList[key].rightCount + baseStudyList[key].wrongCount) <=
            (targetStudyList[key].rightCount + targetStudyList[key].wrongCount)) {
            baseStudyList[key] = targetStudyList[key];
        }
    }
    studyList = baseStudyList;
};
let getKey = function (tokens) {
    return tokens.join ? tokens.join('') : tokens;
};
let sanitizeKey = function (key) {
    return key.replaceAll('.', '').replaceAll('#', '').replaceAll('$', '').replaceAll('/', '').replaceAll('[', '').replaceAll(']', '');
};

let initialize = function () {
    studyList = JSON.parse(localStorage.getItem(`studyList/${targetLang}`) || '{}');
    studyResults = JSON.parse(localStorage.getItem(`studyResults/${targetLang}`) || '{"hourly":{},"daily":{}}');
    visited = JSON.parse(localStorage.getItem(`visited/${targetLang}`) || '{}');
};

export { initialize, getVisited, updateVisited, registerCallback, saveStudyList, addCards, inStudyList, getCardCount, getStudyList, removeFromStudyList, findOtherCards, updateCard, recordEvent, getStudyResults, studyResult, dataTypes }