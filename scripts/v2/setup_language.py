#!/usr/bin/env python3
"""
Complete language setup pipeline for TrieLingual.

Orchestrates all the data preparation steps: dictionary parsing, frequency analysis,
trie building, sentence extraction, and final output generation.
"""

import argparse
import subprocess
import sys
from pathlib import Path


def run_command(description, cmd, cwd=None):
    """Run a command and report status."""
    print(f"\n{'='*80}", file=sys.stderr)
    print(f"{description}", file=sys.stderr)
    print(f"{'='*80}", file=sys.stderr)
    print(f"Command: {' '.join(cmd)}", file=sys.stderr)
    print(file=sys.stderr)

    try:
        result = subprocess.run(
            cmd,
            cwd=cwd,
            check=True,
            stderr=subprocess.PIPE,
            text=True
        )
        if result.stderr:
            print(result.stderr, file=sys.stderr)
        print(f"✓ {description} complete", file=sys.stderr)
        return True
    except subprocess.CalledProcessError as e:
        print(f"✗ {description} failed with exit code {e.returncode}",
              file=sys.stderr)
        if e.stderr:
            print(e.stderr, file=sys.stderr)
        return False


def main():
    parser = argparse.ArgumentParser(
        description='Complete language setup pipeline for TrieLingual',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Example:
  python setup_language.py \\
    --language portuguese \\
    --output-dir ~/languages/portuguese \\
    --dictionary ~/languages/portuguese/portuguese-dictionary.jsonl \\
    --preferred-dataset tatoeba \\
    --preferred-target ~/languages/portuguese/tatoeba.pt \\
    --preferred-base ~/languages/portuguese/tatoeba.en \\
    --freq-dataset opensubs \\
    --freq-target ~/languages/portuguese/pt-opensubs.pt \\
    --freq-base ~/languages/portuguese/pt-opensubs.en \\
    --top-words 10000 \\
    --parallelism 8

This will:
  1. Parse the dictionary
  2. Build frequency list from freq dataset
  3. Filter dictionary by top N words
  4. Build forward and reverse tries
  5. Trim tries for web deployment
  6. Add examples to tries
  7. Extract sentences for dictionary words
        """
    )

    # Required arguments
    parser.add_argument(
        '--language', required=True,
        help='Language code for tokenization (e.g., portuguese, french, german)')
    parser.add_argument(
        '--output-dir', required=True,
        help='Directory to save all generated files')
    parser.add_argument(
        '--dictionary', required=True,
        help='Path to raw dictionary JSONL file')

    # Preferred dataset (for examples and as first trie source)
    parser.add_argument(
        '--preferred-dataset', required=True,
        help='Name of preferred dataset (e.g., tatoeba)')
    parser.add_argument(
        '--preferred-target', required=True,
        help='Target language sentences file for preferred dataset')
    parser.add_argument(
        '--preferred-base', required=True,
        help='Base language (English) sentences file for preferred dataset')

    # Frequency dataset (for allowlist)
    parser.add_argument(
        '--freq-dataset', required=True,
        help='Name of dataset to use for frequency analysis (e.g., opensubs)')
    parser.add_argument(
        '--freq-target', required=True,
        help='Target language sentences file for frequency dataset')
    parser.add_argument(
        '--freq-base', required=True,
        help='Base language sentences file for frequency dataset')

    # Optional arguments
    parser.add_argument(
        '--top-words', type=int, default=10000,
        help='Number of top frequent words to include in dictionary (default: 10000)')
    parser.add_argument(
        '--freq-limit', type=int, default=100000,
        help='Total words to extract for allowlist (default: 100000)')
    parser.add_argument(
        '--parallelism', '-j', type=int, default=4,
        help='Number of parallel processes for trie building (default: 4)')
    parser.add_argument(
        '--chunk-size', type=int, default=1000000,
        help='Lines per chunk for parallel trie building (default: 1000000)')
    parser.add_argument(
        '--max-sentences', type=int, default=3,
        help='Maximum example sentences per word (default: 3)')
    parser.add_argument(
        '--skip-steps', nargs='+', choices=[
            'dictionary', 'frequency', 'filter-dict', 'forward-trie',
            'forward-trim', 'reverse-trie', 'reverse-trim',
            'forward-examples', 'reverse-examples', 'sentences'
        ],
        help='Steps to skip (useful for resuming interrupted runs)')

    args = parser.parse_args()

    # Resolve paths
    scripts_dir = Path(__file__).parent.parent
    output_dir = Path(args.output_dir).expanduser()
    output_dir.mkdir(parents=True, exist_ok=True)

    # Define intermediate file paths
    full_dict = output_dir / 'full_dictionary.json'
    freqs_allowlist = output_dir / 'freqs-used-as-allowlist'
    unfiltered_wordlist = output_dir / 'unfiltered_wordlist.json'
    filtered_dict = output_dir / 'filtered-dictionary.json'
    full_trie = output_dir / 'full-trie.json'
    trimmed_trie = output_dir / 'trimmed-trie.json'
    inverted_full_trie = output_dir / 'inverted-full-trie.json'
    inverted_trimmed_trie = output_dir / 'inverted-trimmed-trie.json'
    full_trie_with_examples = output_dir / 'full-trie-with-examples.json'
    inverted_full_trie_with_examples = output_dir / \
        'inverted-full-trie-with-examples.json'
    sentences_json = output_dir / 'sentences.json'

    skip_steps = set(args.skip_steps or [])

    # Step 1: Parse dictionary
    if 'dictionary' not in skip_steps:
        if not run_command(
            "Step 1: Parse dictionary",
            [
                sys.executable,
                str(scripts_dir / 'parse_dictionary.py'),
                '--filename', args.dictionary
            ],
            cwd=str(scripts_dir)
        ):
            # Redirect stdout to file
            with open(full_dict, 'w') as f:
                subprocess.run(
                    [
                        sys.executable,
                        str(scripts_dir / 'parse_dictionary.py'),
                        '--filename', args.dictionary
                    ],
                    stdout=f,
                    check=True
                )
            print(f"✓ Dictionary saved to {full_dict}", file=sys.stderr)
    else:
        print(f"\nSkipping Step 1: Parse dictionary", file=sys.stderr)

    # Step 2: Build frequency list
    if 'frequency' not in skip_steps:
        with open(freqs_allowlist, 'w') as f:
            subprocess.run(
                [
                    sys.executable,
                    str(scripts_dir / 'get_word_freq.py'),
                    '--language', args.language,
                    '--limit', str(args.freq_limit),
                    '-f', args.freq_target
                ],
                stdout=f,
                check=True
            )
        print(f"✓ Frequency list saved to {freqs_allowlist}", file=sys.stderr)
    else:
        print(f"\nSkipping Step 2: Build frequency list", file=sys.stderr)

    # Step 3: Create unfiltered wordlist
    if 'frequency' not in skip_steps:
        run_command(
            "Step 3: Create unfiltered wordlist",
            [
                sys.executable,
                str(scripts_dir / 'v2' / 'freq_postprocess.py'),
                '--freq-file', str(freqs_allowlist),
                '--dict-file', str(full_dict),
                '--skip-filter',
                '-o', str(unfiltered_wordlist)
            ]
        )

    # Step 4: Filter dictionary by top N words
    if 'filter-dict' not in skip_steps:
        run_command(
            "Step 4: Filter dictionary by top N words",
            [
                sys.executable,
                str(scripts_dir / 'v2' / 'filter_dict_by_freq.py'),
                '--dict-file', str(full_dict),
                '--freq-file', str(unfiltered_wordlist),
                '--top-n', str(args.top_words),
                '-o', str(filtered_dict)
            ]
        )
    else:
        print(f"\nSkipping Step 4: Filter dictionary", file=sys.stderr)

    # Step 5: Build forward trie
    if 'forward-trie' not in skip_steps:
        run_command(
            "Step 5: Build forward trie (parallel)",
            [
                sys.executable,
                str(scripts_dir / 'v2' / 'build_trie_parallel.py'),
                '--language', args.language,
                '--allow-list-filename', str(freqs_allowlist),
                '--target-sentences-filename', args.freq_target,
                '--depth', '5',
                '--output', str(full_trie),
                '--max-children-per-level', '6', '3', '2', '2', '0',
                '--parallelism', str(args.parallelism),
                '--chunk-size', str(args.chunk_size)
            ]
        )
    else:
        print(f"\nSkipping Step 5: Build forward trie", file=sys.stderr)

    # Step 6: Trim forward trie
    if 'forward-trim' not in skip_steps:
        run_command(
            "Step 6: Trim forward trie for web deployment",
            [
                sys.executable,
                str(scripts_dir / 'v2' / 'trie_postprocess.py'),
                '--input_file', str(full_trie),
                '--output', str(trimmed_trie),
                '--min-count', '10',
                '--max-children-per-level', '6', '2', '0',
                '--max-depth', '2',
                '--remove-counts'
            ]
        )
    else:
        print(f"\nSkipping Step 6: Trim forward trie", file=sys.stderr)

    # Step 7: Build reverse trie
    if 'reverse-trie' not in skip_steps:
        run_command(
            "Step 7: Build reverse trie (parallel)",
            [
                sys.executable,
                str(scripts_dir / 'v2' / 'build_trie_parallel.py'),
                '--language', args.language,
                '--allow-list-filename', str(freqs_allowlist),
                '--target-sentences-filename', args.freq_target,
                '--depth', '5',
                '--output', str(inverted_full_trie),
                '--max-children-per-level', '6', '3', '2', '2', '0',
                '--parallelism', str(args.parallelism),
                '--chunk-size', str(args.chunk_size),
                '--reverse'
            ]
        )
    else:
        print(f"\nSkipping Step 7: Build reverse trie", file=sys.stderr)

    # Step 8: Trim reverse trie
    if 'reverse-trim' not in skip_steps:
        run_command(
            "Step 8: Trim reverse trie for web deployment",
            [
                sys.executable,
                str(scripts_dir / 'v2' / 'trie_postprocess.py'),
                '--input_file', str(inverted_full_trie),
                '--output', str(inverted_trimmed_trie),
                '--min-count', '10',
                '--max-children-per-level', '6', '2', '0',
                '--max-depth', '2',
                '--remove-counts'
            ]
        )
    else:
        print(f"\nSkipping Step 8: Trim reverse trie", file=sys.stderr)

    # Step 9: Add examples to forward trie
    if 'forward-examples' not in skip_steps:
        run_command(
            "Step 9: Add examples to forward trie",
            [
                sys.executable,
                str(scripts_dir / 'v2' / 'add_examples_to_trie.py'),
                '--language', args.language,
                '--trie', str(full_trie),
                '--freq-file', str(freqs_allowlist),
                '--sentence-files', args.preferred_target, args.preferred_base,
                '--sentence-files', args.freq_target, args.freq_base,
                '-o', str(full_trie_with_examples)
            ]
        )
    else:
        print(f"\nSkipping Step 9: Add examples to forward trie", file=sys.stderr)

    # Step 10: Add examples to reverse trie
    if 'reverse-examples' not in skip_steps:
        run_command(
            "Step 10: Add examples to reverse trie",
            [
                sys.executable,
                str(scripts_dir / 'v2' / 'add_examples_to_trie.py'),
                '--language', args.language,
                '--trie', str(inverted_full_trie),
                '--freq-file', str(freqs_allowlist),
                '--sentence-files', args.preferred_target, args.preferred_base,
                '--sentence-files', args.freq_target, args.freq_base,
                '--reverse',
                '-o', str(inverted_full_trie_with_examples)
            ]
        )
    else:
        print(f"\nSkipping Step 10: Add examples to reverse trie", file=sys.stderr)

    # Step 11: Extract example sentences
    if 'sentences' not in skip_steps:
        run_command(
            "Step 11: Extract example sentences for dictionary words",
            [
                sys.executable,
                str(scripts_dir / 'v2' / 'extract_example_sentences.py'),
                '--dict-file', str(filtered_dict),
                '--freq-file', str(unfiltered_wordlist),
                '--sentence-files', args.preferred_target, args.preferred_base,
                '--language', args.language,
                '--max-sentences', str(args.max_sentences),
                '-o', str(sentences_json),
                '--stats'
            ]
        )
    else:
        print(f"\nSkipping Step 11: Extract example sentences", file=sys.stderr)

    # Summary
    print(f"\n{'='*80}", file=sys.stderr)
    print(f"PIPELINE COMPLETE", file=sys.stderr)
    print(f"{'='*80}", file=sys.stderr)
    print(f"\nGenerated files in {output_dir}:", file=sys.stderr)
    print(f"  Dictionary: {filtered_dict.name}", file=sys.stderr)
    print(f"  Word list: {unfiltered_wordlist.name}", file=sys.stderr)
    print(f"  Forward trie: {trimmed_trie.name}", file=sys.stderr)
    print(f"  Reverse trie: {inverted_trimmed_trie.name}", file=sys.stderr)
    print(
        f"  Forward trie with examples: {full_trie_with_examples.name}", file=sys.stderr)
    print(
        f"  Reverse trie with examples: {inverted_full_trie_with_examples.name}", file=sys.stderr)
    print(f"  Sentences: {sentences_json.name}", file=sys.stderr)
    print(f"\n✓ All steps completed successfully!", file=sys.stderr)


if __name__ == '__main__':
    main()
