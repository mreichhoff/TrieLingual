// Parse language and optional word from URL path (e.g., /french/bras or /french)
const slugToLang = {
    'french': 'fr-FR',
    'portuguese': 'pt-BR',
    'italian': 'it-IT',
    'german': 'de-DE',
    'spanish': 'es-ES',
    'norwegian': 'nb-NO'
};

function parseUrlPath() {
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

const urlPath = parseUrlPath();

// Expose parsed URL path to other modules
window.urlPath = urlPath;

// TODO why are these being set to null like this?
window.targetLang = null;
window.trieFetch = null;
window.sentencesFetch = null;
window.definitionsFetch = null;
window.invertedTrieFetch = null;

// Set language from URL only
if (urlPath.lang) {
    window.targetLang = urlPath.lang;
    window.trieFetch = fetch(`/data/${targetLang}/trie.json`);
    window.sentencesFetch = fetch(`/data/${targetLang}/sentences.json`);
    window.definitionsFetch = fetch(`/data/${targetLang}/definitions.json`);
    window.wordlistFetch = fetch(`/data/${targetLang}/wordlist.json`);
    window.invertedTrieFetch = fetch(`/data/${targetLang}/inverted-trie.json`);
}