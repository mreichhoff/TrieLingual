# TrieLingual AI Coding Instructions

## Project Overview
TrieLingual is a language learning web app that visualizes n-gram tries (word-level, max depth 3) from ~10M sentences per language. Users explore words via an interactive CytoscapeJS graph and build flashcard study sets with spaced repetition.

## Architecture

### Frontend: Three-layer modular stack
- **Data Layer** (`js/modules/data-layer.js`): localStorage-backed state management for study lists, visited words, and study results. Uses observer pattern with callbacks for reactive updates.
- **Visualization** (`js/modules/graph.js`): CytoscapeJS graph display with BFS trie traversal. Node colors encode word frequency levels (1-6). Handles both explore and study mode interactions.
- **Base Logic** (`js/modules/base.js`): Central coordinator managing UI state, tab navigation, search, recommendations, TTS, and language switching. Maintains `currentRoot`, `currentExamples`, `currentNgram` state.

### Backend: Static JSON data files
- **Trie data** (`data/{lang}/trie.json`): Nested objects where keys are words, values are child tries. Special `__l` field stores frequency level (1-6). Max depth 3 from root.
- **Sentences** (`data/{lang}/sentences.json`): Indexed sentence data for examples.
- **Definitions** (`data/{lang}/definitions.json`): Word definitions from Wiktionary (CC BY-SA 3.0).
- **Subtries** (`data/{lang}/subtries/{-word}.json`): Pre-computed subtries for performance (loaded on-demand).

### Python data pipeline
- `build_trie.py`: Core. Generates tries from sentence corpora using NLTK tokenization. Trims by frequency and depth.
- `get_examples_for_trie.py`: Selects example sentences, sorted by average word frequency.
- `parse_dictionary.py`: Extracts definitions from Wiktionary dumps.
- `remove_unused_sentences.py`: Filters sentences not in final trie.

## Key Patterns & Conventions

### Global state
- Language: `window.targetLang` (e.g., 'de-DE')
- Loaded data: `window.trie`, `window.sentences`, `window.definitions`
- Fetch promises: `window.trieFetch`, `window.sentencesFetch`, `window.definitionsFetch`
- Initialize via Promise.all() in `main.js` after language selection

### Module initialization
All modules export `initialize()` called in `main.js` after data loads:
```javascript
import { initialize as graphInit } from "./graph.js";
graphInit();
```

### Data access patterns
- **Search examples**: Trie traversal (split word → walk path → retrieve `window.sentences[id]`)
- **Study cards**: localStorage keys like `studyList/{lang}` store card metadata with `due`, `rightCount`, `wrongCount`, `nextJump`
- **Visited tracking**: localStorage `visited/{lang}` counts node views for recommendations

### localStorage keys (per-language)
- `studyList/{targetLang}`: Study card collection
- `studyResults/{targetLang}`: Historical study stats (hourly/daily)
- `visited/{targetLang}`: Node visitation counts
- Top-level `state`: Stores `targetLang` for resuming

### Language support
Hardcoded in `main.js`, `base.js`, `index.html`:
- 'fr-FR', 'pt-BR', 'it-IT', 'de-DE', 'es-ES', 'nb-NO'
- To add: Update language options array, add data folder, add punctuation/default words sets

### Frequency levels
- `__l` field in trie (1-6, top500 to top10k)
- Color codes: red→1, orange→2, yellow→3, green→4, purple→5, blue→6
- Used for recommendations difficulty filtering and visual feedback

## Build & Deployment

### Development
- **NPM scripts** (see `package.json`):
  - `npm run build`: Bundle once with Rollup → `js/bundle.js` (IIFE format)
  - `npm run watch`: Rollup in watch mode (live rebuild on source changes)
  - `npm run serve`: Start Firebase emulators (local dev server)
- **Source entry**: `js/modules/main.js`
- **Bundler config**: `rollup.config.ts`
- **Firebase config**: `firebase.json`, `firestore.rules`, `firestore.indexes.json`

### Production
- Deploy via Firebase Hosting (configured in `firebase.json`)
- Deploy command: `firebase deploy`
- Service Worker: `asset-service-worker.js` caches all assets for PWA offline support
- Manifest: `manifest.json` enables PWA install
- Functions: Cloud Functions (`functions/src/index.ts`) available for backend logic

## Testing & Debugging

### No test framework in place
- Test via browser dev tools (localStorage, Network tab for data loads)
- Verify trie structure: inspect `window.trie` in console after language selection
- Recommendations: Web Worker messages in Network tab, enable/check `recommendations-worker.js`

### Common issues
- **Stale data**: Clear localStorage or use DevTools > Application > Storage
- **Missing language**: Verify data files exist and language code is added to all three places
- **Graph not rendering**: Check `window.trie` loaded, CytoscapeJS available

## Project-Specific Conventions

### Naming
- **Node IDs**: Concatenated word path (e.g., 'thedog' for path ['the','dog'])
- **Edge IDs**: '_edge' prefix + source + target word
- **Study card keys**: Sanitized target sentence text (remove special chars)

### Trie metadata
- `__l`: frequency level (always present at leaf)
- `__C`: frequency count (used during trie building, removed before shipping)

### Async patterns
- Prefer Promise.all() for parallel data loads
- Web Worker used for recommendations computation (heavy filtering)
- No async/await in codebase; uses `.then()` chains

### Known limitations (documented in FAQ)
- Max 10k words per language (top frequency cutoff)
- Max trigram depth (3-level paths only)
- No i18n (UI hardcoded in English)
- Content moderation: rudimentary blocklist, ongoing effort
- **Prototype status**: Do not assume production-grade error handling

## Critical Files to Understand
- `/js/modules/base.js`: Central coordinator (554 lines)
- `/js/data-layer.js`: State management pattern
- `/js/modules/graph.js`: Trie visualization logic
- `/scripts/build_trie.py`: Data generation source of truth
- `/data/{lang}/trie.json`: Inspect structure for language support
