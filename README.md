# TrieLingual
A [prototype site](https://mreichhoff.github.io/TrieLingual/) to help language learners study the building blocks of language.

## Summary
A word-level trie was generated for multiple languages. It contains the 10,000 most common words from the language, and has a max depth of 3 (i.e., paths represent up to a trigram). The children at each level were the most commonly observed words following the root. The data was generated from ~10 million sentences per language.

The result is displayed as a graph via CytoscapeJS. Example sentences containing the n-gram are shown when a given path in the trie is clicked. The example sentences were sorted by average word frequency from a superset of the data used to build the tries.

The idea came from another project of mine, [HanziGraph](https://github.com/mreichhoff/HanziGraph); the code is nearly identical.

## Project Status
This project is a prototype. Content moderation (including further screening for offensive content; a rudimentary blocklist has already been applied, but it's far from perfect) and improvement of the translations are both ongoing efforts. Please do not treat any of this code or content as production-ready.

More languages may be added in the future.

## Acknowledgements
Sentence and definition data was pulled from:
* [tatoeba](https://tatoeba.org/), which releases data under [CC-BY 2.0 FR](https://creativecommons.org/licenses/by/2.0/fr/)
* [wiktionary](https://www.wiktionary.org/), which releases data under [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/)
  * Due to the sharealike clause, please treat the `definition.json` content in `data/` as also released under [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/).
* [OpenSubtitles](http://www.opensubtitles.org/)
* [CommonCrawl](https://opus.nlpl.eu/CCAligned.php)

The latter two were accessed via [Opus](https://opus.nlpl.eu/).