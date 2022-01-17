let state = JSON.parse(localStorage.getItem('state') || '{}');
window.targetLang = null;
window.trieFetch = null;
window.sentencesFetch = null;
if (state && state.targetLang) {
    window.targetLang = state.targetLang;
    window.trieFetch = fetch(`./data/${targetLang}/trie.json`);
    window.sentencesFetch = fetch(`./data/${targetLang}/sentences.json`);
}