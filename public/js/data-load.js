let state = JSON.parse(localStorage.getItem('state') || '{}');
// TODO why are these being set to null like this?
window.targetLang = null;
window.trieFetch = null;
window.sentencesFetch = null;
window.definitionsFetch = null;
// window.invertedTrieFetch = null;
if (state && state.targetLang) {
    window.targetLang = state.targetLang;
    window.trieFetch = fetch(`/data/${targetLang}/trie.json`);
    window.sentencesFetch = fetch(`/data/${targetLang}/sentences.json`);
    window.definitionsFetch = fetch(`/data/${targetLang}/definitions.json`);
    // window.invertedTrieFetch = fetch(`/data/${targetLang}/inverted-trie.json`);
}