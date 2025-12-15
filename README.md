<div align="center">
  <h1>TrieLingual</h1>
  <p><strong>Explore the building blocks of language.</strong></p>
  <img src="./public/images/icon.svg" height="120" width="120" alt="TrieLingual Logo">
  <br>
  <br>
  <a href="https://trielingual.com"><strong>Live Site</strong></a>
  <br>
  <br>
  <a href="https://trielingual.com/french">French</a> | 
  <a href="https://trielingual.com/spanish">Spanish</a> | 
  <a href="https://trielingual.com/portuguese">Portuguese</a> | 
  <a href="https://trielingual.com/italian">Italian</a> | 
  <a href="https://trielingual.com/german">German</a> | 
  <a href="https://trielingual.com/korean">Korean</a>
</div>

## Overview

TrieLingual is a data-driven language learning tool that visualizes how words connect. By analyzing at least **50 million sentences per language**, it builds interactive n-gram tries that let you explore collocations, understand word frequency, and learn vocabulary in context.

Unlike tools that teach words in isolation, TrieLingual shows you the *paths* words take to form sentences. This makes it easy to see a word in many contexts, and to spot grammar patterns.


https://github.com/user-attachments/assets/becc5aa1-23d1-458f-abf4-c57d210f94c4


## ✨ Features

### 🔍 Interactive Visualizations
Explore language structure through multiple interactive lenses:
*   **Trie Diagrams**: Navigate word connections up to 3 levels deep using an interactive tree diagram.  Every node has example sentences. Diagrams of words following and words preceding are both available.
*   **Sunburst Diagrams**: Visualize the probability distribution of following words hierarchically.
*   **Sankey Diagrams**: See the flow of incoming and outgoing word connections.
*   **Coverage Charts**: Track your vocabulary coverage against the most frequent words.

### 📚 Context-First Learning
*   **Real Examples**: Every node reveals example sentences pulled from subtitles or Tatoeba.
*   **Frequency Grading**: Sentences are sorted by average word frequency, so you learn from examples you can actually understand.
*   **Color-Coded Frequency**: Nodes are colored on a hot-to-cold gradient (Red = Top 500, Blue = Top 10k) to instantly gauge word difficulty.

### 🧠 Study & Retention
*   **Direct Anki Integration**: Seamlessly add words and sentences to your Anki decks via AnkiConnect.
*   **Built-in Spaced Repetition**: Prefer not to use Anki? Use the integrated study mode to review flashcards directly in the browser.
*   **AI Assistance**: Generate custom sentences and explanations for complex phrases.

## Example Use Cases

### Grammar

Have trouble remembering if it's `depender de` or `depender en`? Check out the Sankey for [depender](https://trielingual.com/spanish/depender). The tall column for `de` is a clear giveaway.

<img width="738" height="803" alt="Screenshot 2025-12-14 at 5 04 56 PM" src="https://github.com/user-attachments/assets/b5a0d24a-cac6-4c90-8230-69979a6c47f8" />

### Paths

Want to find patterns deep in sentences? Check out the wheel of language.

<img width="1501" height="852" alt="sunburst-screenshot" src="https://github.com/user-attachments/assets/344e997b-5b54-42d0-87f8-68a09b7affd7" />


### Prioritizing what to learn

Curious how much bang for your buck you get by learning a word? Check out the coverage graphs. Here's the cumulative line if you'd learn the top 1,000 words in Spanish.

<img width="736" height="769" alt="cumulative-frequenc-coverage" src="https://github.com/user-attachments/assets/57af4433-c3c3-4cf1-8deb-4e4999ab9f5b" />


### Irregular verb forms

What verb was `quepa` in Spanish again? Get to the infinitive in one click.

<img width="748" height="260" alt="definition-form-links" src="https://github.com/user-attachments/assets/c47cfc23-2bcf-48d1-84e8-fbbd3d79c02c" />

### Anki cards with one click

Want to study a sentence? Make an Anki card in one click.

https://github.com/user-attachments/assets/8e491b47-ac9d-4bb8-b8f5-649a41e90516


### Tap any word, any time.

The example sentences and all the diagrams are interactive. Dig around to your heart's content.

https://github.com/user-attachments/assets/376bcc63-e628-4e71-b30c-7caa3d0d1669


### AI Help

Curious about what a phrase means, or how it's used? Want extra example sentences? Ask the AI.


https://github.com/user-attachments/assets/ad7ae507-b432-4bb5-8728-8675ebd0b67d



## 🌍 Supported Languages
(And their terrible puns)

*   🇫🇷 French (*French Tries*)
*   🇧🇷 Portuguese (*PorTRIEguese*)
*   🇮🇹 Italian (*Trietalian*)
*   🇩🇪 German (*Triedesco* (idk, this wasn't as easy for me))
*   🇪🇸 Spanish (*Espárbol*)
*   🇰🇷 Korean (*Namumal* (tbh, I trusted an AI on this one))

## 🛠️ How it Works

The data pipeline processes tens of millions of sentences per language to generate a word-level trie containing the top 100,000 most frequent words.
1.  **Ingestion**: Sentences are tokenized and analyzed for n-gram frequency.
2.  **Pruning**: The trie is trimmed to a max depth of 3 (trigrams) and filtered for the most common children at each node.
3.  **Visualization**: The frontend uses **Cytoscape.js** for graphs, **D3.js** for charts, and **Chart.js** for statistics.

## 🚀 Running Locally

1.  Clone the repo.
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Run the development server:
    ```bash
    npm run serve
    ```
4.  Watch for changes:
    ```bash
    npm run watch
    ```

## Acknowledgements
Sentence and definition data was pulled from:
* [tatoeba](https://tatoeba.org/), which releases data under [CC-BY 2.0 FR](https://creativecommons.org/licenses/by/2.0/fr/)
* [wiktionary](https://www.wiktionary.org/), which releases data under [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/)
  * Due to the sharealike clause, please treat the `definition.json` content in `data/` as also released under [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/).
* [OpenSubtitles](http://www.opensubtitles.org/)
* [CommonCrawl](https://opus.nlpl.eu/CCAligned.php)

The latter two were accessed via [Opus](https://opus.nlpl.eu/).
