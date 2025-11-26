import { initialize as dataInit } from "./data-layer.js";
import { initialize as baseInit } from "./base.js";
import { initialize as faqInit } from "./faq.js";
import { initialize as studyModeInit } from "./study-mode.js";
import { initialize as statsInit } from "./stats.js";

//TODO: adding a new language involves changing index.html, base.js, and main.js. refactor
let languageOptions = [
    {
        element: document.getElementById('french-language-card'),
        targetLang: 'fr-FR'
    },
    {
        element: document.getElementById('portuguese-language-card'),
        targetLang: 'pt-BR'
    },
    {
        element: document.getElementById('italian-language-card'),
        targetLang: 'it-IT'
    },
    {
        element: document.getElementById('german-language-card'),
        targetLang: 'de-DE'
    },
    {
        element: document.getElementById('spanish-language-card'),
        targetLang: 'es-ES'
    },
    {
        element: document.getElementById('norwegian-language-card'),
        targetLang: 'nb-NO'
    }
];
const mainContainer = document.getElementById('main-container');
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
                .then(data => window.definitions = data),
            // window.invertedTrieFetch
            //     .then(response => response.json())
            //     .then(data => window.invertedTrie = data)
        ]
    ).then(_ => {
        landingContainer.style.display = 'none';
        mainContainer.removeAttribute('style');
        dataInit();
        studyModeInit();
        baseInit();
        statsInit();
        faqInit();
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
            window.trieFetch = fetch(`/data/${targetLang}/trie.json`);
            window.sentencesFetch = fetch(`/data/${targetLang}/sentences.json`);
            window.definitionsFetch = fetch(`/data/${targetLang}/definitions.json`);
            // window.invertedTrieFetch = fetch(`/data/${targetLang}/inverted-trie.json`);
            init();
        });
    });
}
//ideally we'll continue adding to this