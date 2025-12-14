// Anki Connect integration
// Documentation: https://git.sr.ht/~foosoft/anki-connect

const ANKI_CONNECT_URL = 'http://127.0.0.1:8765';
const ANKI_CONNECT_VERSION = 6;

// Get Anki settings from localStorage
let getAnkiSettings = function () {
    const settings = localStorage.getItem(`ankiSettings/${targetLang}`);
    if (!settings) {
        return {
            enabled: false,
            deck: null,
            modelName: 'Basic',
            testPassed: false
        };
    }
    return JSON.parse(settings);
};

// Save Anki settings to localStorage
let saveAnkiSettings = function (settings) {
    localStorage.setItem(`ankiSettings/${targetLang}`, JSON.stringify(settings));
};

// Make a request to Anki Connect
async function invoke(action, params = {}) {
    const requestBody = {
        action,
        version: ANKI_CONNECT_VERSION,
        params
    };

    try {
        const response = await fetch(ANKI_CONNECT_URL, {
            method: 'POST',
            body: JSON.stringify(requestBody),
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        if (Object.getOwnPropertyNames(data).length !== 2) {
            throw new Error('Response has an unexpected number of fields');
        }
        if (!data.hasOwnProperty('error')) {
            throw new Error('Response is missing required error field');
        }
        if (!data.hasOwnProperty('result')) {
            throw new Error('Response is missing required result field');
        }
        if (data.error) {
            throw new Error(data.error);
        }

        return data.result;
    } catch (error) {
        console.error('Anki Connect error:', error);
        throw error;
    }
}

// Test connection to Anki Connect
async function testConnection() {
    try {
        const version = await invoke('version');
        return version >= ANKI_CONNECT_VERSION;
    } catch (error) {
        return false;
    }
}

// Get list of deck names
async function getDeckNames() {
    return await invoke('deckNames');
}

// Get list of model names
async function getModelNames() {
    return await invoke('modelNames');
}

// Get fields for a specific model
async function getModelFieldNames(modelName) {
    return await invoke('modelFieldNames', { modelName });
}

// Create a deck if it doesn't exist
async function createDeck(deckName) {
    return await invoke('createDeck', { deck: deckName });
}

// Add a note to Anki
async function addNote(deckName, modelName, fields, tags = []) {
    const note = {
        deckName,
        modelName,
        fields,
        tags,
        options: {
            allowDuplicate: false,
            duplicateScope: 'deck'
        }
    };

    return await invoke('addNote', { note });
}

// Add a card from TrieLingual to Anki
// Assumes a Basic model with Front and Back fields
async function addTrieLingualCard(card, settings) {
    const { deck, modelName } = settings;

    // Format the front (target language)
    const front = Array.isArray(card.t) ? card.t.join(' ') : card.t;

    // Format the back (base language / English)
    const back = card.b;

    // Create fields object based on model
    // For Basic model: Front and Back
    // For other models, we'll try to adapt
    const fields = {
        'Front': front,
        'Back': back
    };

    const tags = ['trielingual', targetLang];

    try {
        const noteId = await addNote(deck, modelName, fields, tags);
        return noteId;
    } catch (error) {
        console.error('Failed to add card to Anki:', error);
        throw error;
    }
}

// Add multiple cards to Anki
async function addTrieLingualCards(cards, settings) {
    const results = [];
    const errors = [];

    for (const card of cards) {
        try {
            const noteId = await addTrieLingualCard(card, settings);
            results.push({ success: true, noteId, card });
        } catch (error) {
            results.push({ success: false, error: error.message, card });
            errors.push(error);
        }
    }

    return { results, errors, successCount: results.filter(r => r.success).length };
}

export {
    getAnkiSettings,
    saveAnkiSettings,
    testConnection,
    getDeckNames,
    getModelNames,
    getModelFieldNames,
    createDeck,
    addNote,
    addTrieLingualCard,
    addTrieLingualCards
};
