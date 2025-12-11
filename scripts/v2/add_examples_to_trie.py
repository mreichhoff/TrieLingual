#!/usr/bin/env python3
"""
Add example sentences to trie nodes.

Takes a trie and augments each node with example sentences, preferring
easier sentences (measured by average word frequency rank).
"""
from lang_utils import tokenize
import argparse
import json
import sys
from heapq import heappush, heappushpop
from pathlib import Path

# Add parent directory to path to import lang_utils
sys.path.insert(0, str(Path(__file__).parent.parent))


def get_word_frequencies(filename):
    """
    Load word frequencies from JSON file (output of get_word_freq.py).
    Returns dict with word as key and frequency rank as value.
    """
    with open(filename, encoding='utf-8') as f:
        freq_dict = json.load(f)

    # Sort by frequency (descending) and create rank mapping
    sorted_words = sorted(freq_dict.items(), key=lambda x: x[1], reverse=True)
    return {word: idx for idx, (word, _) in enumerate(sorted_words)}


def get_average_frequency_rank(word_frequencies, words):
    """
    Calculate average frequency rank for a list of words.
    Lower rank = more common = easier sentence.
    """
    if not words:
        return float('inf')

    total_rank = 0
    for word in words:
        # Use word's rank if known, otherwise use max rank (least common)
        rank = word_frequencies.get(word, len(word_frequencies))
        total_rank += rank

    return total_rank / len(words)


def remove_punctuation(sentence):
    """Remove common punctuation for deduplication."""
    return sentence.replace('.', '').replace(',', '').replace(
        '?', '').replace('!', '').replace('\'', '').replace('-', '').replace(' ', '')


def get_trie_max_depth(trie):
    """
    Determine the maximum depth of the trie.

    Returns:
        Maximum depth (1 for unigrams only, 2 for bigrams, 3 for trigrams, etc.)
    """
    max_depth = 1

    def traverse(node, current_depth):
        nonlocal max_depth
        max_depth = max(max_depth, current_depth)

        for key in node:
            if key in ('__e', '__C', '__l'):
                continue
            if isinstance(node[key], dict):
                traverse(node[key], current_depth + 1)

    traverse(trie, 1)
    return max_depth


def find_ngrams_in_sentence(words, trie, max_depth, reverse=False):
    """
    Find all n-grams in a sentence that exist in the trie.

    Args:
        words: List of tokenized words
        trie: The trie structure
        max_depth: Maximum n-gram depth to search
        reverse: If True, trie contains n-grams ending at each word (words before)
                 If False, trie contains n-grams starting with each word (words after)

    Returns:
        List of tuples: (path, node) where path is list of words, node is trie node
    """
    found_ngrams = []

    for i in range(len(words)):
        word = words[i]
        if word not in trie:
            continue

        # Found unigram
        found_ngrams.append(([word], trie[word]))

        if reverse:
            # For reverse trie, extend backwards (words before current word)
            current_node = trie[word]
            current_path = [word]

            for depth in range(1, max_depth):
                prev_idx = i - depth
                if prev_idx < 0:
                    break

                prev_word = words[prev_idx]
                if prev_word not in current_node:
                    break

                current_node = current_node[prev_word]
                # Insert at beginning for reverse
                current_path.insert(0, prev_word)
                found_ngrams.append((current_path.copy(), current_node))
        else:
            # For forward trie, extend forwards (words after current word)
            current_node = trie[word]
            current_path = [word]

            for depth in range(1, max_depth):
                next_idx = i + depth
                if next_idx >= len(words):
                    break

                next_word = words[next_idx]
                if next_word not in current_node:
                    break

                current_node = current_node[next_word]
                current_path.append(next_word)
                found_ngrams.append((current_path.copy(), current_node))

    return found_ngrams


def add_examples_from_file_pair(trie, target_file, base_file, word_frequencies, language, ignore_case, max_examples_per_node, seen_sentences, max_depth, dataset_idx, reverse=False):
    """
    Process a pair of target/base sentence files and add examples to trie.

    Args:
        trie: The trie structure to augment
        target_file: Path to target language sentences
        base_file: Path to base language sentences
        word_frequencies: Dict mapping words to frequency ranks
        language: Language code for tokenization
        ignore_case: Whether to ignore case
        max_examples_per_node: Max number of examples to keep per node
        seen_sentences: Set of already-seen sentences (for deduplication)
        max_depth: Maximum depth of the trie
        dataset_idx: Index of this dataset (0-based, lower = higher priority)
        reverse: If True, trie contains n-grams ending at each word

    Returns:
        Number of sentences processed
    """
    sentences_processed = 0

    with open(target_file, encoding='utf-8') as target_f, \
            open(base_file, encoding='utf-8') as base_f:

        for target_line in target_f:
            base_line = base_f.readline()
            if not base_line:
                break

            target = target_line.strip()
            base = base_line.strip()

            if not target or not base:
                continue

            # Deduplicate by normalized target sentence
            normalized = remove_punctuation(target.lower())
            if normalized in seen_sentences:
                continue
            seen_sentences.add(normalized)

            # Tokenize target sentence
            words = tokenize(target, language, ignore_case)
            words = [w for w in words if w]  # Remove empty strings

            if not words:
                continue

            # Calculate average frequency rank (lower = easier)
            avg_freq_rank = get_average_frequency_rank(word_frequencies, words)

            # Find all n-grams in this sentence that exist in the trie
            ngrams = find_ngrams_in_sentence(
                words, trie, max_depth, reverse=reverse)

            # Add example to each matching n-gram node
            for path, node in ngrams:
                # Initialize __e field if not present
                if '__e' not in node:
                    node['__e'] = []

                # Use heap with dataset_idx as primary sort key (earlier datasets preferred)
                # Then by avg_freq_rank (easier sentences preferred within same dataset)
                # Heap is min-heap, so we negate both to make it max-heap
                # Format: (priority_key, target, base, dataset_idx)
                priority_key = (-dataset_idx, -avg_freq_rank)

                if len(node['__e']) < max_examples_per_node:
                    heappush(node['__e'], (priority_key,
                             target, base, dataset_idx))
                else:
                    # Only add if this example has higher priority than the lowest priority one
                    heappushpop(node['__e'], (priority_key,
                                target, base, dataset_idx))

            sentences_processed += 1

            if sentences_processed % 100000 == 0:
                print(
                    f"  Processed {sentences_processed:,} sentences from {Path(target_file).name}...", file=sys.stderr)

    return sentences_processed


def clean_examples(trie):
    """
    Convert heap format to final list format, keeping dataset_idx.
    Converts from [(priority_key, target, base, dataset_idx), ...] to [[target, base, dataset_idx], ...]
    Sorts by dataset_idx (primary) then frequency (secondary).
    """
    if '__e' in trie:
        # Sort by priority key (dataset_idx, then frequency)
        # Extract target, base, and dataset_idx for final output
        trie['__e'] = [[target, base, dataset_idx]
                       for _, target, base, dataset_idx in sorted(trie['__e'])]

    # Recurse on children
    for key in trie:
        if key in ('__e', '__C', '__l'):
            continue
        if isinstance(trie[key], dict):
            clean_examples(trie[key])


def count_nodes_with_examples(trie):
    """Count how many nodes have examples."""
    count = 0
    if '__e' in trie and trie['__e']:
        count = 1

    for key in trie:
        if key in ('__e', '__C', '__l'):
            continue
        if isinstance(trie[key], dict):
            count += count_nodes_with_examples(trie[key])

    return count


def main():
    parser = argparse.ArgumentParser(
        description='Add example sentences to trie nodes',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Single sentence file pair
  python add_examples_to_trie.py \\
    --language fr \\
    --trie trie.json \\
    --freq-file freqs.json \\
    --sentence-files target.txt base.txt \\
    -o trie-with-examples.json
  
  # Multiple sentence file pairs (earlier takes precedence)
  python add_examples_to_trie.py \\
    --language fr \\
    --trie trie.json \\
    --freq-file freqs.json \\
    --sentence-files high-quality-target.txt high-quality-base.txt \\
    --sentence-files backup-target.txt backup-base.txt \\
    -o trie-with-examples.json \\
    --stats
        """
    )

    parser.add_argument(
        '--language', required=True,
        help='Language code (e.g., en, fr, de)')
    parser.add_argument(
        '--trie', required=True,
        help='Input trie JSON file')
    parser.add_argument(
        '--freq-file', required=True,
        help='Word frequency JSON file (output of get_word_freq.py)')
    parser.add_argument(
        '--sentence-files', nargs=2, action='append', required=True,
        metavar=('TARGET', 'BASE'),
        help='Pair of sentence files (target, base). Can be specified multiple times. Earlier pairs take precedence.')
    parser.add_argument(
        '--output', '-o', required=True,
        help='Output trie JSON file with examples')
    parser.add_argument(
        '--max-examples-per-node', type=int, default=3,
        help='Maximum number of examples to keep per node (default: 3)')
    parser.add_argument(
        '--ignore-case', action='store_true', default=True,
        help='Ignore case when tokenizing (default: True)')
    parser.add_argument(
        '--reverse', action='store_true',
        help='Trie contains n-grams ending at each word (words before) instead of starting with each word (words after)')
    parser.add_argument(
        '--pretty', action='store_true',
        help='Pretty-print JSON output')
    parser.add_argument(
        '--stats', action='store_true',
        help='Print statistics about example coverage')

    args = parser.parse_args()

    # Load trie
    print(f"Loading trie from {args.trie}...", file=sys.stderr)
    with open(args.trie, encoding='utf-8') as f:
        trie = json.load(f)
    print(f"✓ Trie loaded", file=sys.stderr)

    # Load word frequencies
    print(
        f"Loading word frequencies from {args.freq_file}...", file=sys.stderr)
    word_frequencies = get_word_frequencies(args.freq_file)
    print(
        f"✓ Loaded {len(word_frequencies):,} word frequencies", file=sys.stderr)

    # Determine trie depth
    print(f"Analyzing trie depth...", file=sys.stderr)
    max_depth = get_trie_max_depth(trie)
    print(f"✓ Trie max depth: {max_depth}", file=sys.stderr)

    # Track seen sentences across all file pairs
    seen_sentences = set()

    # Process each sentence file pair
    print(
        f"\nProcessing {len(args.sentence_files)} sentence file pair(s)...", file=sys.stderr)

    for i, (target_file, base_file) in enumerate(args.sentence_files, 1):
        print(
            f"\n[Pair {i}/{len(args.sentence_files)}] Processing:", file=sys.stderr)
        print(f"  Target: {target_file}", file=sys.stderr)
        print(f"  Base: {base_file}", file=sys.stderr)

        count = add_examples_from_file_pair(
            trie,
            target_file,
            base_file,
            word_frequencies,
            args.language,
            args.ignore_case,
            args.max_examples_per_node,
            seen_sentences,
            max_depth,
            i - 1,  # dataset_idx (0-based)
            args.reverse
        )

        print(f"  ✓ Processed {count:,} sentences", file=sys.stderr)

    print(f"\n✓ All sentence pairs processed", file=sys.stderr)
    print(
        f"  Total unique sentences: {len(seen_sentences):,}", file=sys.stderr)

    # Clean up examples (convert from heap format to final list)
    print(f"\nCleaning example format...", file=sys.stderr)
    clean_examples(trie)
    print(f"✓ Examples cleaned", file=sys.stderr)

    # Print statistics if requested
    if args.stats:
        nodes_with_examples = count_nodes_with_examples(trie)
        print(f"\nStatistics:", file=sys.stderr)
        print(
            f"  Nodes with examples: {nodes_with_examples:,}", file=sys.stderr)

    # Save output
    print(f"\nWriting trie with examples to {args.output}...", file=sys.stderr)
    with open(args.output, 'w', encoding='utf-8') as f:
        if args.pretty:
            json.dump(trie, f, ensure_ascii=False, indent=2)
        else:
            json.dump(trie, f, ensure_ascii=False)

    print(
        f"✓ Complete! Trie with examples saved to {args.output}", file=sys.stderr)


if __name__ == '__main__':
    main()
