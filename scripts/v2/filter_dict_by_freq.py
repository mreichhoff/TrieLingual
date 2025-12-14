#!/usr/bin/env python3
"""
Extract definitions for top N most frequent words.

Takes dictionary from parse_dictionary.py and frequency data from filter_freq_by_dict.py,
outputs definitions for only the top N most frequent words.

This reduces the size of dictionary data loaded on the frontend.
"""

import argparse
import json
import sys


def main():
    parser = argparse.ArgumentParser(
        description='Extract definitions for top N most frequent words',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Get definitions for top 5000 words
  python filter_dict_by_freq.py \\
    --dict-file raw/french-dict-v0.json \\
    --freq-file public/data/fr-FR/common-words.json \\
    --top-n 5000 \\
    -o public/data/fr-FR/definitions.json
  
  # With stats and pretty printing
  python filter_dict_by_freq.py \\
    --dict-file raw/french-dict-v0.json \\
    --freq-file public/data/fr-FR/common-words.json \\
    --top-n 10000 \\
    -o output.json \\
    --stats --pretty

Input format (freq-file):
  [["de", 12345], ["je", 1234], ...]  # Output of filter_freq_by_dict.py

Input format (dict-file):
  {"word": [{"def": "...", "pos": "...", ...}], ...}  # Output of parse_dictionary.py

Output format:
  {"de": [...], "je": [...], ...}  # Definitions for top N words only
        """
    )

    parser.add_argument(
        '--dict-file', required=True,
        help='JSON file with dictionary entries (output of parse_dictionary.py)')
    parser.add_argument(
        '--freq-file', required=True,
        help='JSON file with sorted word-frequency pairs (output of filter_freq_by_dict.py)')
    parser.add_argument(
        '--top-n', type=int, required=True,
        help='Number of top frequent words to include')
    parser.add_argument(
        '--output', '-o', required=True,
        help='Output file path for filtered dictionary')
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
            f"  Loaded {len(freq_data):,} word-frequency pairs", file=sys.stderr)

    # Load dictionary
    print(f"Loading dictionary from {args.dict_file}...", file=sys.stderr)
    with open(args.dict_file, encoding='utf-8') as f:
        dictionary = json.load(f)

    if args.stats:
        print(
            f"  Loaded dictionary with {len(dictionary):,} entries", file=sys.stderr)

    # Extract top N words
    top_n = min(args.top_n, len(freq_data))
    top_words = [word for word, _ in freq_data[:top_n]]

    if args.stats:
        print(
            f"\nExtracting definitions for top {top_n:,} words...", file=sys.stderr)
        if top_n < len(freq_data):
            print(
                f"  (Requested {args.top_n:,}, but only {len(freq_data):,} words available)", file=sys.stderr)

    # Filter dictionary to only include top N words
    filtered_dict = {}
    missing_words = []

    for word in top_words:
        if word in dictionary:
            filtered_dict[word] = dictionary[word]
        else:
            missing_words.append(word)

    if args.stats:
        print(
            f"  Included {len(filtered_dict):,} definitions", file=sys.stderr)
        if missing_words:
            print(
                f"  Warning: {len(missing_words)} words had no dictionary entry", file=sys.stderr)
            if len(missing_words) <= 10:
                print(
                    f"    Missing: {', '.join(missing_words)}", file=sys.stderr)
            else:
                print(
                    f"    First 10 missing: {', '.join(missing_words[:10])}", file=sys.stderr)

    # Calculate size reduction
    if args.stats:
        original_size = len(dictionary)
        filtered_size = len(filtered_dict)
        reduction_pct = ((original_size - filtered_size) /
                         original_size * 100) if original_size > 0 else 0
        print(
            f"\n  Size reduction: {original_size:,} → {filtered_size:,} entries ({reduction_pct:.1f}% smaller)", file=sys.stderr)
        print(file=sys.stderr)

    # Save output
    print(f"Writing filtered dictionary to {args.output}...", file=sys.stderr)
    with open(args.output, 'w', encoding='utf-8') as f:
        if args.pretty:
            json.dump(filtered_dict, f, ensure_ascii=False, indent=2)
        else:
            json.dump(filtered_dict, f, ensure_ascii=False)

    print(
        f"✓ Complete! {len(filtered_dict):,} definitions saved to {args.output}", file=sys.stderr)


if __name__ == '__main__':
    main()
