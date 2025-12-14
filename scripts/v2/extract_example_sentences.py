#!/usr/bin/env python3
"""
Extract example sentences for dictionary words.

Takes a dictionary and parallel sentence files, finds the N easiest sentences
for each word, and outputs a deduplicated array of sentences.

Output format matches public/data/{lang}/sentences.json:
[{"t": ["word1", "word2", ...], "b": "Base language sentence"}, ...]
"""

import argparse
import json
import sys
from pathlib import Path
import heapq
from collections import defaultdict

# Add parent directory to path to import lang_utils
sys.path.insert(0, str(Path(__file__).parent.parent))
from lang_utils import tokenize


def calculate_sentence_difficulty(words, word_frequencies):
    """
    Calculate average frequency rank of words in a sentence.
    Lower rank = more common = easier.

    Args:
        words: List of words in sentence
        word_frequencies: Dict mapping word -> frequency rank

    Returns:
        Average rank (lower is easier), or float('inf') if any word unknown
    """
    ranks = []
    for word in words:
        if word not in word_frequencies:
            # Unknown words make sentence much harder
            return float('inf')
        ranks.append(word_frequencies[word])

    if not ranks:
        return float('inf')

    return sum(ranks) / len(ranks)


def process_sentence_files(sentence_file_pairs, dict_words, word_frequencies,
                           language, ignore_case, max_sentences):
    """
    Process all sentence files once, collecting best sentences for each word.
    Uses heaps to efficiently maintain top N easiest sentences per word.

    Returns:
        Dict mapping word -> list of (difficulty, target_tokens, base_sentence) tuples
    """
    # Use max-heaps (negate difficulty) to keep top N easiest sentences per word
    # word -> heap of (-difficulty, target_tokens, base_text)
    word_sentences = defaultdict(list)
    sentences_seen = 0

    for target_file, base_file in sentence_file_pairs:
        print(f"  Processing {target_file}...", file=sys.stderr)

        with open(target_file, encoding='utf-8') as tf, open(base_file, encoding='utf-8') as bf:
            for target_line, base_line in zip(tf, bf):
                target_text = target_line.strip()
                base_text = base_line.strip()

                if not target_text or not base_text:
                    continue

                sentences_seen += 1
                if sentences_seen % 100000 == 0:
                    print(
                        f"    Processed {sentences_seen:,} sentences...", file=sys.stderr)

                # Tokenize target sentence
                words = tokenize(target_text, language, ignore_case)

                # Calculate difficulty once for this sentence
                difficulty = calculate_sentence_difficulty(
                    words, word_frequencies)

                if difficulty == float('inf'):
                    continue

                # Add this sentence to heap for each dictionary word it contains
                target_tuple = tuple(words)
                for word in set(words):  # Use set to avoid duplicates within same sentence
                    if word not in dict_words:
                        continue

                    heap = word_sentences[word]

                    # Use negative difficulty for max-heap (we want smallest difficulties)
                    # Python's heapq is a min-heap, so negate to simulate max-heap
                    if len(heap) < max_sentences:
                        # Heap not full yet, just add
                        heapq.heappush(
                            heap, (-difficulty, target_tuple, base_text))
                    elif -heap[0][0] > difficulty:
                        # This sentence is easier than the hardest in our heap
                        heapq.heapreplace(
                            heap, (-difficulty, target_tuple, base_text))

    print(
        f"    Total sentences processed: {sentences_seen:,}", file=sys.stderr)

    # Convert heaps to sorted lists (easiest first)
    result = {}
    for word, heap in word_sentences.items():
        # Extract from heap and sort by actual difficulty (not negated)
        sentences = [(-neg_diff, target_tuple, base_text)
                     for neg_diff, target_tuple, base_text in heap]
        sentences.sort(key=lambda x: x[0])  # Sort by difficulty ascending
        result[word] = sentences

    return result


def main():
    parser = argparse.ArgumentParser(
        description='Extract example sentences for dictionary words',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Extract 3 example sentences per word
  python extract_example_sentences.py \\
    --dict-file public/data/fr-FR/definitions.json \\
    --freq-file public/data/fr-FR/common-words.json \\
    --target-file raw/fr.txt \\
    --base-file raw/en.txt \\
    --language french \\
    -o public/data/fr-FR/sentences.json \\
    --max-sentences 3

  # Multiple sentence sources (e.g., Tatoeba + OpenSubtitles)
  python extract_example_sentences.py \\
    --dict-file definitions.json \\
    --freq-file common-words.json \\
    --sentence-files tatoeba.fr tatoeba.en \\
    --sentence-files opensubs.fr opensubs.en \\
    --language french \\
    -o sentences.json
        """
    )

    parser.add_argument(
        '--dict-file', required=True,
        help='JSON file with dictionary entries (output of filter_dict_by_freq.py)')
    parser.add_argument(
        '--freq-file', required=True,
        help='JSON file with word-frequency pairs (output of freq_postprocess.py)')
    parser.add_argument(
        '--sentence-files', nargs=2, action='append', required=True,
        metavar=('TARGET', 'BASE'),
        help='Pair of parallel sentence files (target language, base language). Can specify multiple times.')
    parser.add_argument(
        '--language', required=True,
        help='Language code for tokenization (e.g., french, german, spanish)')
    parser.add_argument(
        '--output', '-o', required=True,
        help='Output file path for sentences JSON')
    parser.add_argument(
        '--max-sentences', type=int, default=3,
        help='Maximum sentences to find per word (default: 3)')
    parser.add_argument(
        '--ignore-case', action='store_true', default=True,
        help='Ignore case when tokenizing (default: True)')
    parser.add_argument(
        '--stats', action='store_true',
        help='Print statistics')

    args = parser.parse_args()

    # Load dictionary (just need the keys/words)
    print(f"Loading dictionary from {args.dict_file}...", file=sys.stderr)
    with open(args.dict_file, encoding='utf-8') as f:
        dictionary = json.load(f)
    dict_words = set(dictionary.keys())

    if args.stats:
        print(
            f"  Loaded {len(dict_words):,} words from dictionary", file=sys.stderr)

    # Load frequency data
    print(f"Loading frequency data from {args.freq_file}...", file=sys.stderr)
    with open(args.freq_file, encoding='utf-8') as f:
        freq_array = json.load(f)

    # Create word -> rank mapping
    word_frequencies = {word: idx for idx, (word, _) in enumerate(freq_array)}

    if args.stats:
        print(
            f"  Loaded {len(word_frequencies):,} word frequencies", file=sys.stderr)

    # Process all sentence files in one pass
    print(f"\nProcessing sentence files...", file=sys.stderr)

    word_sentences = process_sentence_files(
        args.sentence_files, dict_words, word_frequencies,
        args.language, args.ignore_case, args.max_sentences
    )

    words_with_sentences = len(word_sentences)
    print(
        f"\n✓ Found sentences for {words_with_sentences:,}/{len(dict_words):,} words ({words_with_sentences/len(dict_words)*100:.1f}%)", file=sys.stderr)

    # Collect unique sentences
    sentence_map = {}  # (target_tuple, base) -> True (for deduplication)

    for word, sentences in word_sentences.items():
        for difficulty, target_tuple, base_text in sentences:
            sentence_map[(target_tuple, base_text)] = True

    # Convert to output format
    print(f"\nConverting to output format...", file=sys.stderr)
    sentences_array = [
        {"t": list(target_tuple), "b": base}
        for target_tuple, base in sentence_map.keys()
    ]

    if args.stats:
        print(
            f"  Total unique sentences: {len(sentences_array):,}", file=sys.stderr)

    # Save output
    print(f"Writing sentences to {args.output}...", file=sys.stderr)
    with open(args.output, 'w', encoding='utf-8') as f:
        json.dump(sentences_array, f, ensure_ascii=False)

    print(
        f"✓ Complete! {len(sentences_array):,} sentences saved to {args.output}", file=sys.stderr)


if __name__ == '__main__':
    main()
