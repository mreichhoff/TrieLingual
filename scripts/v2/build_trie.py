from pathlib import Path
import argparse
import json
import sys

# Add parent directory to path to import lang_utils
sys.path.insert(0, str(Path(__file__).parent.parent))
from lang_utils import tokenize

def get_word_frequencies(filename):
    """Load word frequencies from JSON file (output of get_word_freq.py).
-
    JSON format: {"word": frequency_count, "word2": frequency_count, ...}
    Returns dict with word as key and frequency rank (lower is more frequent) as value.
    """
    with open(filename) as f:
        freq_dict = json.load(f)

    # Sort by frequency (descending) and create rank mapping
    sorted_words = sorted(freq_dict.items(), key=lambda x: x[1], reverse=True)
    return {word: idx for idx, (word, _) in enumerate(sorted_words)}


def build_trie_from_file(sentences_file, allowlist, language, ignore_case, depth, start_line, end_line):
    """
    Build a trie from sentences with optional line range support.

    Args:
        sentences_file: Path to sentences file
        allowlist: Dict of allowed words
        language: Language code
        ignore_case: Whether to ignore case
        depth: Maximum depth of trie (max n-gram size)
        start_line: Starting line index (0-based, None for 0)
        end_line: Ending line index exclusive (None for EOF)
    """
    trie = {}
    line_num = 0

    with open(sentences_file) as f:
        for line in f:
            # Skip lines outside the range if specified
            if start_line is not None and line_num < start_line:
                line_num += 1
                continue
            if end_line is not None and line_num >= end_line:
                break

            words = tokenize(line.strip(), language, ignore_case)
            # Filter to only words in allowlist and remove empty strings
            words = [w for w in words if w and w in allowlist]

            # Build n-grams up to the specified depth
            for i in range(len(words)):
                first = words[i]

                # Initialize first word node
                if first not in trie:
                    trie[first] = {"__C": 0}
                trie[first]["__C"] += 1

                # Build n-grams of increasing depth
                current_node = trie[first]
                for d in range(1, depth):
                    next_idx = i + d
                    if next_idx >= len(words):
                        break

                    next_word = words[next_idx]

                    # Initialize child node
                    if next_word not in current_node:
                        current_node[next_word] = {"__C": 0}

                    current_node[next_word]["__C"] += 1
                    current_node = current_node[next_word]

            line_num += 1

    return trie


def trim_by_count_iterative(trie, min_count):
    """
    Recursively remove nodes with count below threshold.
    Uses explicit stack to avoid deep recursion.
    """
    stack = [trie]

    while stack:
        node = stack.pop()

        # Find keys to delete (those with count < min_count)
        to_delete = []
        for key, value in node.items():
            if key == "__C":
                continue
            if isinstance(value, dict) and "__C" in value:
                if value["__C"] < min_count:
                    to_delete.append(key)
                else:
                    stack.append(value)

        # Delete marked keys
        for key in to_delete:
            node.pop(key)


def trim_children(trie, depth, counts):
    to_delete = sorted(
        [item for item in trie.items() if item[0] != "__C"],
        key=lambda kvp: kvp[1]["__C"],
        reverse=True)[counts[depth]:]
    for item in to_delete:
        if item[0] == "__C":
            continue
        trie.pop(item[0])
    for key in trie.keys():
        if key == "__C":
            continue
        trim_children(trie[key], depth+1, counts)


def main():
    parser = argparse.ArgumentParser(
        description='Build a word-level n-gram trie from a sentences file')
    parser.add_argument(
        '--language', required=True,
        help='Language code (e.g., en, fr, de)')
    parser.add_argument(
        '--allow-list-filename', required=True,
        help='Path to allowlist file, one word per line')
    parser.add_argument(
        '--target-sentences-filename', required=True,
        help='Path to sentences file')
    parser.add_argument(
        '--depth', type=int, required=True,
        help='Maximum trie depth (n-gram size, e.g., 3 for trigrams)')
    parser.add_argument(
        '--start-line', type=int, default=None,
        help='Starting line index (0-based, inclusive)')
    parser.add_argument(
        '--end-line', type=int, default=None,
        help='Ending line index (0-based, exclusive)')
    parser.add_argument(
        '--min-count', type=int, default=1,
        help='Minimum count to keep a node (default: 1)')
    parser.add_argument(
        '--max-children-per-level', type=int, nargs='+',
        help='Max children to keep at each depth level (e.g., 10 5 2 for depths 0,1,2)')
    parser.add_argument(
        '--ignore-case', action='store_true', default=True,
        help='Ignore case when tokenizing (default: True)')

    args = parser.parse_args()

    # Load allowlist
    allowlist = get_word_frequencies(args.allow_list_filename)

    # Build trie
    trie = build_trie_from_file(
        args.target_sentences_filename,
        allowlist,
        args.language,
        args.ignore_case,
        args.depth,
        args.start_line,
        args.end_line
    )

    # Trim by minimum count
    if args.min_count > 1:
        trim_by_count_iterative(trie, args.min_count)

    # Trim by rank (keep top N children per level)
    if args.max_children_per_level:
        for key in trie.keys():
            if key == "__C":
                continue
            trim_children(trie[key], 0, args.max_children_per_level)

    # Output JSON (keep __C field as requested)
    print(json.dumps(trie, ensure_ascii=False))


if __name__ == '__main__':
    main()
