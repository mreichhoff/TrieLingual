import {
    getAnkiSettings,
    saveAnkiSettings,
    testConnection,
    getDeckNames,
    getModelNames,
    addTrieLingualCards
} from './anki.js';

let ankiSettings = null;

function showAnkiSettings() {
    document.getElementById('menu-container').style.display = 'none';
    document.getElementById('anki-settings-container').removeAttribute('style');
    updateAnkiUI();
}

function hideAnkiSettings() {
    document.getElementById('anki-settings-container').style.display = 'none';
    document.getElementById('menu-container').removeAttribute('style');
}

function updateAnkiUI() {
    ankiSettings = getAnkiSettings();

    const configSection = document.getElementById('anki-config-section');
    const activeSection = document.getElementById('anki-integration-active');

    if (ankiSettings.enabled && ankiSettings.testPassed) {
        // Show active status
        configSection.style.display = 'none';
        activeSection.removeAttribute('style');
        document.getElementById('anki-current-deck').textContent = ankiSettings.deck || 'Default';
        document.getElementById('anki-current-model').textContent = ankiSettings.modelName || 'Basic';
    } else {
        // Show configuration
        configSection.style.display = ankiSettings.testPassed ? 'block' : 'none';
        activeSection.style.display = 'none';

        if (ankiSettings.testPassed) {
            document.getElementById('anki-enable-checkbox').checked = ankiSettings.enabled;
        }
    }
}

async function handleTestConnection() {
    const button = document.getElementById('anki-test-connection');
    const status = document.getElementById('anki-connection-status');

    button.disabled = true;
    button.textContent = 'Testing...';
    status.textContent = '';
    status.className = 'anki-status';

    try {
        const connected = await testConnection();

        if (connected) {
            status.textContent = '✓ Connected to Anki successfully!';
            status.style.color = '#22c55e';

            // Update settings
            ankiSettings.testPassed = true;
            saveAnkiSettings(ankiSettings);

            // Load decks and models
            await loadDecksAndModels();

            // Show configuration section
            document.getElementById('anki-config-section').removeAttribute('style');
        } else {
            status.textContent = '✗ Could not connect to Anki. Make sure Anki is running with AnkiConnect installed.';
            status.style.color = '#ef4444';
            ankiSettings.testPassed = false;
            saveAnkiSettings(ankiSettings);
        }
    } catch (error) {
        status.textContent = `✗ Error: ${error.message}`;
        status.style.color = '#ef4444';
        ankiSettings.testPassed = false;
        saveAnkiSettings(ankiSettings);
    } finally {
        button.disabled = false;
        button.textContent = 'Test Connection';
    }
}

async function loadDecksAndModels() {
    try {
        // Load decks
        const decks = await getDeckNames();
        const deckSelect = document.getElementById('anki-deck-select');
        deckSelect.innerHTML = '<option value="">Select a deck...</option>';
        decks.forEach(deck => {
            const option = document.createElement('option');
            option.value = deck;
            option.textContent = deck;
            if (deck === ankiSettings.deck) {
                option.selected = true;
            }
            deckSelect.appendChild(option);
        });

        // Load models
        const models = await getModelNames();
        const modelSelect = document.getElementById('anki-model-select');
        modelSelect.innerHTML = '';
        models.forEach(model => {
            const option = document.createElement('option');
            option.value = model;
            option.textContent = model;
            if (model === ankiSettings.modelName) {
                option.selected = true;
            }
            modelSelect.appendChild(option);
        });
    } catch (error) {
        console.error('Failed to load decks and models:', error);
    }
}

function handleSaveSettings() {
    const deckSelect = document.getElementById('anki-deck-select');
    const modelSelect = document.getElementById('anki-model-select');
    const enableCheckbox = document.getElementById('anki-enable-checkbox');
    const status = document.getElementById('anki-save-status');

    if (!deckSelect.value) {
        status.textContent = '✗ Please select a deck';
        status.style.color = '#ef4444';
        return;
    }

    ankiSettings.deck = deckSelect.value;
    ankiSettings.modelName = modelSelect.value;
    ankiSettings.enabled = enableCheckbox.checked;

    saveAnkiSettings(ankiSettings);

    status.textContent = '✓ Settings saved successfully!';
    status.style.color = '#22c55e';

    setTimeout(() => {
        updateAnkiUI();
    }, 1000);
}

function handleDisable() {
    ankiSettings.enabled = false;
    saveAnkiSettings(ankiSettings);
    updateAnkiUI();
}

function initialize() {
    ankiSettings = getAnkiSettings();

    // Menu button
    const showButton = document.getElementById('anki-settings-show');
    if (showButton) {
        showButton.addEventListener('click', showAnkiSettings);
    }

    // Exit button
    const exitButton = document.getElementById('anki-settings-exit-button');
    if (exitButton) {
        exitButton.addEventListener('click', hideAnkiSettings);
    }

    // Test connection button
    const testButton = document.getElementById('anki-test-connection');
    if (testButton) {
        testButton.addEventListener('click', handleTestConnection);
    }

    // Refresh decks button
    const refreshButton = document.getElementById('anki-refresh-decks');
    if (refreshButton) {
        refreshButton.addEventListener('click', loadDecksAndModels);
    }

    // Save settings button
    const saveButton = document.getElementById('anki-save-settings');
    if (saveButton) {
        saveButton.addEventListener('click', handleSaveSettings);
    }

    // Disable button
    const disableButton = document.getElementById('anki-disable-button');
    if (disableButton) {
        disableButton.addEventListener('click', handleDisable);
    }
}

// Get current Anki settings (exported for use in base.js)
function getSettings() {
    return getAnkiSettings();
}

export { initialize, getSettings, addTrieLingualCards };
