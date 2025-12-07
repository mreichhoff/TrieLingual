#!/usr/bin/env python3
"""
Trim an existing trie by count and/or children limits.

Useful for creating subset views of a full trie for web deployment.
"""

import argparse
import json
import sys


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


def trim_by_depth(trie, max_depth):
    """
    Remove all nodes beyond the specified depth.

    Args:
        trie: The trie node to trim
        max_depth: Maximum depth to keep (0-based, e.g., 2 means keep depths 0,1,2)
    """
    def trim_recursive(node, current_depth):
        if current_depth >= max_depth:
            # Remove all children at this level
            keys_to_remove = [k for k in node.keys() if k != "__C"]
            for key in keys_to_remove:
                node.pop(key)
            return

        # Recurse on children
        for key in list(node.keys()):
            if key == "__C":
                continue
            if isinstance(node[key], dict):
                trim_recursive(node[key], current_depth + 1)

    trim_recursive(trie, 0)


def trim_children(trie, depth, counts):
    """
    Recursively trim children to keep only top N at each depth.

    Args:
        trie: The trie node to trim
        depth: Current depth level
        counts: List where index is depth, value is max children count
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
        trim_children(trie[key], depth + 1, counts)


def remove_counts(trie):
    """
    Remove all __C fields from the trie.
    Uses explicit stack to avoid deep recursion.
    """
    stack = [trie]

    while stack:
        node = stack.pop()

        # Remove __C if present
        if "__C" in node:
            node.pop("__C")

        # Add children to stack
        for key, value in node.items():
            if isinstance(value, dict):
                stack.append(value)


def get_trie_stats(trie, max_depth=10):
    """
    Get statistics about a trie.

    Returns:
        Dict with node counts per depth level
    """
    stats = {d: 0 for d in range(max_depth)}

    def count_nodes(node, depth):
        if depth >= max_depth:
            return

        for key, value in node.items():
            if key == "__C":
                continue
            if isinstance(value, dict):
                stats[depth] += 1
                count_nodes(value, depth + 1)

    count_nodes(trie, 0)
    return stats


def main():
    parser = argparse.ArgumentParser(
        description='Trim an existing trie by count and/or children limits',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Trim by minimum count only
  python trie_postprocess.py input.json -o output.json --min-count 10
  
  # Trim by children limits only
  python trie_postprocess.py input.json -o output.json --max-children-per-level 100 50 20
  
  # Trim by depth (convert 5-level trie to 3-level)
  python trie_postprocess.py input.json -o output.json --max-depth 2
  
  # Combine all trimming methods
  python trie_postprocess.py input.json -o output.json --max-depth 2 --min-count 5 --max-children-per-level 100 50 20
  
  # Pretty print output
  python trie_postprocess.py input.json -o output.json --min-count 10 --pretty
        """
    )

    parser.add_argument(
        '--input_file',
        help='Input trie JSON file')
    parser.add_argument(
        '--output', '-o', required=True,
        help='Output file path for trimmed trie')
    parser.add_argument(
        '--min-count', type=int,
        help='Minimum count to keep a node (removes nodes with __C < min-count)')
    parser.add_argument(
        '--max-children-per-level', type=int, nargs='+',
        help='Max children to keep at each depth level (e.g., 100 50 20 for depths 0,1,2)')
    parser.add_argument(
        '--max-depth', type=int,
        help='Maximum depth to keep (0-based, e.g., 2 keeps depths 0,1,2)')
    parser.add_argument(
        '--remove-counts', action='store_true',
        help='Remove __C count fields from output (default: False, keeps counts)')
    parser.add_argument(
        '--pretty', action='store_true',
        help='Pretty-print JSON output with indentation')
    parser.add_argument(
        '--stats', action='store_true',
        help='Print statistics before and after trimming')

    args = parser.parse_args()

    # Validate arguments
    if not args.min_count and not args.max_children_per_level and not args.max_depth:
        parser.error(
            "At least one of --min-count, --max-children-per-level, or --max-depth must be specified")

    # Load input trie
    print(f"Loading trie from {args.input_file}...", file=sys.stderr)
    with open(args.input_file) as f:
        trie = json.load(f)

    # Get initial stats if requested
    if args.stats:
        print("\nInitial trie statistics:", file=sys.stderr)
        stats = get_trie_stats(trie)
        for depth, count in stats.items():
            if count > 0:
                print(f"  Depth {depth}: {count:,} nodes", file=sys.stderr)
        total_nodes = sum(stats.values())
        print(f"  Total: {total_nodes:,} nodes\n", file=sys.stderr)

    # Trim by depth first (affects subsequent operations)
    if args.max_depth is not None:
        print(
            f"Trimming to maximum depth {args.max_depth}...", file=sys.stderr)
        for key in trie.keys():
            if key == "__C":
                continue
            trim_by_depth(trie[key], args.max_depth)
        print("✓ Depth trimming complete", file=sys.stderr)

    # Trim by minimum count
    if args.min_count:
        print(
            f"Trimming by minimum count ({args.min_count})...", file=sys.stderr)
        trim_by_count_iterative(trie, args.min_count)
        print("✓ Count trimming complete", file=sys.stderr)

    # Trim by children limits
    if args.max_children_per_level:
        print(
            f"Trimming by max children per level: {args.max_children_per_level}...", file=sys.stderr)
        for key in trie.keys():
            if key == "__C":
                continue
            trim_children(trie[key], 0, args.max_children_per_level)
        print("✓ Children trimming complete", file=sys.stderr)

    # Get final stats if requested
    if args.stats:
        print("\nFinal trie statistics:", file=sys.stderr)
        stats = get_trie_stats(trie)
        for depth, count in stats.items():
            if count > 0:
                print(f"  Depth {depth}: {count:,} nodes", file=sys.stderr)
        total_nodes = sum(stats.values())
        print(f"  Total: {total_nodes:,} nodes\n", file=sys.stderr)

    # Remove counts if requested
    if args.remove_counts:
        print("Removing __C count fields...", file=sys.stderr)
        remove_counts(trie)
        print("✓ Count fields removed", file=sys.stderr)

    # Save output
    print(f"Writing trimmed trie to {args.output}...", file=sys.stderr)
    with open(args.output, 'w') as f:
        if args.pretty:
            json.dump(trie, f, ensure_ascii=False, indent=2)
        else:
            json.dump(trie, f, ensure_ascii=False)

    print(f"✓ Complete! Trimmed trie saved to {args.output}", file=sys.stderr)


if __name__ == '__main__':
    main()
