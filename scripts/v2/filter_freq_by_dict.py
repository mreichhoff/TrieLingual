#!/usr/bin/env python3
"""
Filter word frequencies by dictionary presence and output sorted array.

Takes frequency data from get_word_freq.py and dictionary from parse_dictionary.py,
outputs a sorted array of words (by frequency) that exist in the dictionary.

This is useful for frontend display to show users how common a word is.
"""

import argparse
import json
import sys


def main():
    parser = argparse.ArgumentParser(
        description='Filter word frequencies by dictionary presence and output sorted array',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Basic usage
  python filter_freq_by_dict.py --freq-file freqs.json --dict-file dictionary.json -o common-words.json
  
  # With pretty printing
  python filter_freq_by_dict.py --freq-file freqs.json --dict-file dictionary.json -o common-words.json --pretty
  
  # With stats
  python filter_freq_by_dict.py --freq-file freqs.json --dict-file dictionary.json -o common-words.json --stats

Output format:
  [["de", 12345], ["je", 1234], ...]  # [word, count] pairs, most to least frequent, dictionary words only
        """
    )

    parser.add_argument(
        '--freq-file', required=True,
        help='JSON file with word frequencies (output of get_word_freq.py), format: {"word": count, ...}')
    parser.add_argument(
        '--dict-file', required=True,
        help='JSON file with dictionary entries (output of parse_dictionary.py), format: {"word": [senses], ...}')
    parser.add_argument(
        '--output', '-o', required=True,
        help='Output file path for sorted word array (format: [[word, count], ...])')
    parser.add_argument(
        '--pretty', action='store_true',
        help='Pretty-print JSON output with indentation')
    parser.add_argument(
        '--stats', action='store_true',
        help='Print statistics about filtering')

    args = parser.parse_args()

    # Load frequency data
    print(f"Loading frequency data from {args.freq_file}...", file=sys.stderr)
    with open(args.freq_file, encoding='utf-8') as f:
        freq_data = json.load(f)

    if args.stats:
        print(
            f"  Loaded {len(freq_data):,} words with frequencies", file=sys.stderr)

    # Load dictionary
    print(f"Loading dictionary from {args.dict_file}...", file=sys.stderr)
    with open(args.dict_file, encoding='utf-8') as f:
        dictionary = json.load(f)

    if args.stats:
        print(
            f"  Loaded dictionary with {len(dictionary):,} entries", file=sys.stderr)

    # Filter: keep only words that exist in dictionary
    print("Filtering words by dictionary presence...", file=sys.stderr)
    filtered_words = {word: count for word,
                      count in freq_data.items() if word in dictionary}

    if args.stats:
        removed = len(freq_data) - len(filtered_words)
        print(f"  Kept {len(filtered_words):,} words", file=sys.stderr)
        print(
            f"  Removed {removed:,} words not in dictionary", file=sys.stderr)

    # Sort by frequency (descending) and create [word, count] pairs
    print("Sorting by frequency...", file=sys.stderr)
    sorted_words = sorted(filtered_words.items(),
                          key=lambda x: x[1], reverse=True)
    word_count_array = [[word, count] for word, count in sorted_words]

    if args.stats:
        print(f"\nTop 10 most frequent words:", file=sys.stderr)
        for i, (word, count) in enumerate(sorted_words[:10], 1):
            print(f"  {i}. {word} ({count:,} occurrences)", file=sys.stderr)
        print(file=sys.stderr)

    # Save output
    print(f"Writing sorted word array to {args.output}...", file=sys.stderr)
    with open(args.output, 'w', encoding='utf-8') as f:
        if args.pretty:
            json.dump(word_count_array, f, ensure_ascii=False, indent=2)
        else:
            json.dump(word_count_array, f, ensure_ascii=False)

    print(
        f"✓ Complete! {len(word_count_array):,} words saved to {args.output}", file=sys.stderr)


if __name__ == '__main__':
    main()
