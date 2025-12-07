import { initialize as dataInit } from "./data-layer.js";
import { initialize as baseInit } from "./base.js";
import { initialize as faqInit } from "./faq.js";
import { initialize as studyModeInit } from "./study-mode.js";
import { initialize as statsInit } from "./stats.js";
import { initialize as firebaseInit } from "./firebase.js";

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
        firebaseInit();
        dataInit();
        studyModeInit();
        baseInit();
        statsInit();
        faqInit();
    });
};

let initWithMinimumDelay = function (minDelay) {
    const startTime = Date.now();
    const promise = Promise.all(
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
        ]
    );

    promise.then(_ => {
        const elapsed = Date.now() - startTime;
        const remaining = minDelay - elapsed;
        const delayTime = Math.max(0, remaining);

        setTimeout(() => {
            revealApp(() => {
                firebaseInit();
                dataInit();
                studyModeInit();
                baseInit();
                statsInit();
                faqInit();
            });
        }, delayTime);
    });
};

function revealApp(callback) {
    // make sure main container is available for animation
    mainContainer.style.display = '';
    // force reflow so animations will run
    void mainContainer.offsetWidth;
    landingContainer.classList.add('fade-out');
    mainContainer.classList.add('slide-in-right');

    const onEnd = function (e) {
        if (e.target !== mainContainer) return;
        mainContainer.removeEventListener('animationend', onEnd);
        landingContainer.classList.remove('fade-out');
        mainContainer.classList.remove('slide-in-right');
        // hide landing after animation
        landingContainer.style.display = 'none';
        if (typeof callback === 'function') callback();
    };

    mainContainer.addEventListener('animationend', onEnd);
}

if (targetLang) {
    init();
} else {
    const grid = document.getElementById('language-grid');
    languageOptions.forEach(x => {
        x.element.addEventListener('click', function (e) {
            window.targetLang = x.targetLang;
            grid.classList.add('language-grid-selected');
            e.currentTarget.classList.add('language-selected');

            // Update URL to reflect the selected language
            const langToSlugMap = {
                'fr-FR': 'french',
                'pt-BR': 'portuguese',
                'it-IT': 'italian',
                'de-DE': 'german',
                'es-ES': 'spanish',
                'nb-NO': 'norwegian'
            };
            const slug = langToSlugMap[targetLang];
            if (slug) {
                history.pushState({}, '', `/${slug}`);
            }

            window.trieFetch = fetch(`/data/${targetLang}/trie.json`);
            window.sentencesFetch = fetch(`/data/${targetLang}/sentences.json`);
            window.definitionsFetch = fetch(`/data/${targetLang}/definitions.json`);
            // window.invertedTrieFetch = fetch(`/data/${targetLang}/inverted-trie.json`);

            // Enforce minimum 0.5 second animation delay before showing app
            initWithMinimumDelay(500);
        });
    });
}
//ideally we'll continue adding to this