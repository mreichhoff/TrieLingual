#!/usr/bin/env python3
"""
Parallel trie builder orchestrator.

Splits a large sentences file into chunks, builds tries in parallel,
and merges the results.
"""

import argparse
import json
import os
import subprocess
import sys
import tempfile
from concurrent.futures import ProcessPoolExecutor, as_completed
from pathlib import Path


def count_lines(filename):
    """Count lines in a file efficiently."""
    print(f"Counting lines in {filename}...", file=sys.stderr)

    # Use wc -l for speed if available (Unix-like systems)
    try:
        result = subprocess.run(
            ['wc', '-l', filename],
            capture_output=True,
            text=True,
            check=True
        )
        line_count = int(result.stdout.split()[0])
        print(f"Found {line_count:,} lines", file=sys.stderr)
        return line_count
    except (subprocess.CalledProcessError, FileNotFoundError, ValueError):
        # Fallback to Python counting
        with open(filename, 'rb') as f:
            line_count = sum(1 for _ in f)
        print(f"Found {line_count:,} lines", file=sys.stderr)
        return line_count


def build_chunk(args_tuple):
    """
    Build a trie for a specific chunk of lines.

    Args:
        args_tuple: Tuple of (chunk_id, start_line, end_line, config)

    Returns:
        Tuple of (chunk_id, output_file_path, success, error_msg)
    """
    chunk_id, start_line, end_line, config = args_tuple

    # Create temporary output file
    output_file = os.path.join(
        config['temp_dir'], f'trie_chunk_{chunk_id:04d}.json')

    # Build command
    cmd = [
        sys.executable,
        config['build_script'],
        '--language', config['language'],
        '--allow-list-filename', config['allow_list_filename'],
        '--target-sentences-filename', config['target_sentences_filename'],
        '--depth', str(config['depth']),
        '--start-line', str(start_line),
        '--end-line', str(end_line),
    ]

    # Add optional arguments
    if config.get('min_count'):
        cmd.extend(['--min-count', str(config['min_count'])])

    if config.get('max_children_per_level'):
        cmd.append('--max-children-per-level')
        cmd.extend([str(x) for x in config['max_children_per_level']])

    if config.get('ignore_case'):
        cmd.append('--ignore-case')

    if config.get('reverse'):
        cmd.append('--reverse')

    try:
        print(
            f"[Chunk {chunk_id}] Processing lines {start_line:,} to {end_line:,}...", file=sys.stderr)

        # Run build_trie.py and capture output
        with open(output_file, 'w') as f:
            result = subprocess.run(
                cmd,
                stdout=f,
                stderr=subprocess.PIPE,
                text=True,
                check=True
            )

        print(f"[Chunk {chunk_id}] ✓ Complete", file=sys.stderr)
        return (chunk_id, output_file, True, None)

    except subprocess.CalledProcessError as e:
        error_msg = f"Failed with exit code {e.returncode}: {e.stderr}"
        print(f"[Chunk {chunk_id}] ✗ {error_msg}", file=sys.stderr)
        return (chunk_id, output_file, False, error_msg)
    except Exception as e:
        error_msg = f"Unexpected error: {str(e)}"
        print(f"[Chunk {chunk_id}] ✗ {error_msg}", file=sys.stderr)
        return (chunk_id, output_file, False, error_msg)


def trim_children(trie, depth, counts):
    """
    Recursively trim children to keep only top N at each depth.
    Copied from build_trie.py for final trimming.
    """
    if depth >= len(counts):
        return

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


def merge_tries_progressive(trie_files, merge_script):
    """
    Merge tries progressively to manage memory.

    Args:
        trie_files: List of trie file paths to merge
        merge_script: Path to merge_tries.py script

    Returns:
        Path to final merged trie file
    """
    if not trie_files:
        raise ValueError("No trie files to merge")

    if len(trie_files) == 1:
        return trie_files[0]

    print(f"\nMerging {len(trie_files)} trie files...", file=sys.stderr)

    # Create temp directory for merge intermediates
    temp_dir = tempfile.mkdtemp(prefix='trie_merge_')

    current_files = list(trie_files)
    merge_round = 0

    # Merge in batches to avoid memory issues
    while len(current_files) > 1:
        merge_round += 1
        next_files = []
        batch_size = 10  # Merge 10 files at a time

        print(
            f"Merge round {merge_round}: {len(current_files)} files...", file=sys.stderr)

        for i in range(0, len(current_files), batch_size):
            batch = current_files[i:i + batch_size]
            output_file = os.path.join(
                temp_dir, f'merge_round{merge_round}_batch{i // batch_size}.json')

            # Run merge script
            cmd = [sys.executable, merge_script] + batch + ['-o', output_file]

            try:
                subprocess.run(cmd, check=True, stderr=subprocess.PIPE)
                next_files.append(output_file)
            except subprocess.CalledProcessError as e:
                print(f"Merge failed: {e.stderr.decode()}", file=sys.stderr)
                raise

        current_files = next_files

    print("✓ Merge complete", file=sys.stderr)
    return current_files[0]


def main():
    parser = argparse.ArgumentParser(
        description='Build a trie in parallel chunks and merge results',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Example:
  python build_trie_parallel.py \\
    --language fr \\
    --allow-list-filename raw/fr-freqs.json \\
    --target-sentences-filename raw/fr.txt \\
    --depth 3 \\
    --chunk-size 1000000 \\
    --parallelism 4 \\
    --output final_trie.json
        """
    )

    # Required arguments
    parser.add_argument(
        '--language', required=True,
        help='Language code (e.g., en, fr, de)')
    parser.add_argument(
        '--allow-list-filename', required=True,
        help='Path to allowlist/frequency JSON file')
    parser.add_argument(
        '--target-sentences-filename', required=True,
        help='Path to sentences file')
    parser.add_argument(
        '--depth', type=int, required=True,
        help='Maximum trie depth (n-gram size)')
    parser.add_argument(
        '--output', '-o', required=True,
        help='Output file path for final merged trie')

    # Optional arguments
    parser.add_argument(
        '--chunk-size', type=int, default=1000000,
        help='Lines per chunk (default: 1,000,000)')
    parser.add_argument(
        '--parallelism', '-j', type=int, default=4,
        help='Number of parallel processes (default: 4)')
    parser.add_argument(
        '--min-count', type=int,
        help='Minimum count to keep a node')
    parser.add_argument(
        '--max-children-per-level', type=int, nargs='+',
        help='Max children to keep at each depth level')
    parser.add_argument(
        '--ignore-case', action='store_true', default=True,
        help='Ignore case when tokenizing (default: True)')
    parser.add_argument(
        '--reverse', action='store_true',
        help='Build reverse n-grams (words ending with each word instead of starting with it)')
    parser.add_argument(
        '--temp-dir',
        help='Temporary directory for chunk files (default: system temp)')
    parser.add_argument(
        '--keep-chunks', action='store_true',
        help='Keep intermediate chunk files after merging')

    args = parser.parse_args()

    # Resolve script paths
    script_dir = Path(__file__).parent
    build_script = script_dir / 'build_trie.py'
    merge_script = script_dir / 'merge_tries.py'

    if not build_script.exists():
        print(
            f"Error: build_trie.py not found at {build_script}", file=sys.stderr)
        sys.exit(1)
    if not merge_script.exists():
        print(
            f"Error: merge_tries.py not found at {merge_script}", file=sys.stderr)
        sys.exit(1)

    # Count lines in input file
    total_lines = count_lines(args.target_sentences_filename)

    # Calculate chunks
    chunk_size = args.chunk_size
    num_chunks = (total_lines + chunk_size - 1) // chunk_size

    print(f"\nProcessing plan:", file=sys.stderr)
    print(f"  Total lines: {total_lines:,}", file=sys.stderr)
    print(f"  Chunk size: {chunk_size:,}", file=sys.stderr)
    print(f"  Number of chunks: {num_chunks}", file=sys.stderr)
    print(f"  Parallelism: {args.parallelism}", file=sys.stderr)
    print(f"", file=sys.stderr)

    # Create temp directory
    if args.temp_dir:
        temp_dir = args.temp_dir
        os.makedirs(temp_dir, exist_ok=True)
    else:
        temp_dir = tempfile.mkdtemp(prefix='trie_build_')

    print(f"Temporary directory: {temp_dir}\n", file=sys.stderr)

    # Prepare chunk tasks
    config = {
        'build_script': str(build_script),
        'language': args.language,
        'allow_list_filename': args.allow_list_filename,
        'target_sentences_filename': args.target_sentences_filename,
        'depth': args.depth,
        'min_count': args.min_count,
        'max_children_per_level': args.max_children_per_level,
        'ignore_case': args.ignore_case,
        'reverse': args.reverse,
        'temp_dir': temp_dir,
    }

    tasks = []
    for i in range(num_chunks):
        start_line = i * chunk_size
        end_line = min((i + 1) * chunk_size, total_lines)
        tasks.append((i, start_line, end_line, config))

    # Execute chunks in parallel
    print(
        f"Building {num_chunks} chunks with {args.parallelism} workers...\n", file=sys.stderr)

    chunk_files = []
    failed_chunks = []

    with ProcessPoolExecutor(max_workers=args.parallelism) as executor:
        futures = {executor.submit(build_chunk, task): task for task in tasks}

        for future in as_completed(futures):
            chunk_id, output_file, success, error_msg = future.result()

            if success:
                chunk_files.append(output_file)
            else:
                failed_chunks.append((chunk_id, error_msg))

    # Check for failures
    if failed_chunks:
        print(f"\n✗ {len(failed_chunks)} chunk(s) failed:", file=sys.stderr)
        for chunk_id, error_msg in failed_chunks:
            print(f"  Chunk {chunk_id}: {error_msg}", file=sys.stderr)
        sys.exit(1)

    print(f"\n✓ All {num_chunks} chunks built successfully", file=sys.stderr)

    # Sort chunk files by chunk ID
    chunk_files.sort()

    # Merge all chunks
    final_trie = merge_tries_progressive(chunk_files, str(merge_script))

    # Move final trie to output location
    print(f"\nWriting final trie to {args.output}...", file=sys.stderr)

    # Load the merged trie
    with open(final_trie) as f:
        trie_data = json.load(f)

    # Apply final trimming if max_children_per_level is specified
    if args.max_children_per_level:
        print(
            f"Applying final trimming with max children per level: {args.max_children_per_level}...", file=sys.stderr)
        for key in trie_data.keys():
            if key == "__C":
                continue
            trim_children(trie_data[key], 0, args.max_children_per_level)
        print("✓ Trimming complete", file=sys.stderr)

    # Save final trie
    with open(args.output, 'w') as f:
        json.dump(trie_data, f, ensure_ascii=False)

    # Cleanup
    if not args.keep_chunks:
        print(f"Cleaning up temporary files...", file=sys.stderr)
        import shutil
        try:
            shutil.rmtree(temp_dir)
        except Exception as e:
            print(
                f"Warning: Could not remove temp directory: {e}", file=sys.stderr)
    else:
        print(f"Keeping chunk files in {temp_dir}", file=sys.stderr)

    print(f"\n✓ Complete! Final trie saved to {args.output}", file=sys.stderr)


if __name__ == '__main__':
    main()
