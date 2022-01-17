import { initialize as baseInit } from "./base.js";
import { initialize as faqInit } from "./faq.js";
import { initialize as studyModeInit } from "./study-mode.js";
import { initialize as statsInit } from "./stats.js";
import { initialize as recommendationsInit } from "./recommendations.js";

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
                .then(data => window.sentences = data)
        ]
    ).then(_ => {
        landingContainer.style.display = 'none';
        mainContainer.removeAttribute('style');
        studyModeInit();
        baseInit();
        statsInit();
        faqInit();
        recommendationsInit();
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
            init();
        });
    });
}
//ideally we'll continue adding to this