import json
import argparse


def merge_trie_nodes(node1, node2):
    """
    Recursively merge two trie nodes.

    Combines counts and merges child nodes recursively.

    Args:
        node1: First trie node (dict)
        node2: Second trie node (dict)

    Returns:
        Merged trie node
    """
    if not isinstance(node1, dict) or not isinstance(node2, dict):
        return node1 if node1 else node2

    # Start with a copy of node1
    merged = dict(node1)

    # Merge counts
    if "__C" in node2:
        merged["__C"] = merged.get("__C", 0) + node2["__C"]

    # Merge children
    for key, value in node2.items():
        if key == "__C":
            continue

        if key in merged:
            # Recursively merge child nodes
            merged[key] = merge_trie_nodes(merged[key], value)
        else:
            # Add new child from node2
            merged[key] = value

    return merged


def merge_tries(trie1, trie2):
    """
    Merge two complete tries.

    Args:
        trie1: First trie (dict)
        trie2: Second trie (dict)

    Returns:
        Merged trie
    """
    return merge_trie_nodes(trie1, trie2)


def load_trie(filename):
    """Load a trie from a JSON file."""
    with open(filename) as f:
        return json.load(f)


def save_trie(trie, filename):
    """Save a trie to a JSON file."""
    with open(filename, 'w') as f:
        json.dump(trie, f, ensure_ascii=False, indent=2)


def main():
    parser = argparse.ArgumentParser(
        description='Merge two or more trie JSON files produced by build_trie.py')
    parser.add_argument(
        'input_files', nargs='+',
        help='Input trie JSON files to merge (2 or more)')
    parser.add_argument(
        '--output', '-o',
        help='Output file path (default: print to stdout)')
    parser.add_argument(
        '--pretty', action='store_true',
        help='Pretty-print JSON output (default: compact)')

    args = parser.parse_args()

    if len(args.input_files) < 2:
        parser.error("At least 2 input files are required")

    # Load first trie
    print(f"Loading {args.input_files[0]}...", file=__import__('sys').stderr)
    merged_trie = load_trie(args.input_files[0])

    # Merge remaining tries
    for filename in args.input_files[1:]:
        print(f"Merging {filename}...", file=__import__('sys').stderr)
        trie = load_trie(filename)
        merged_trie = merge_tries(merged_trie, trie)

    # Output result
    if args.output:
        print(f"Writing merged trie to {args.output}...", file=__import__(
            'sys').stderr)
        if args.pretty:
            save_trie(merged_trie, args.output)
        else:
            with open(args.output, 'w') as f:
                json.dump(merged_trie, f, ensure_ascii=False)
    else:
        # Print to stdout
        if args.pretty:
            print(json.dumps(merged_trie, ensure_ascii=False, indent=2))
        else:
            print(json.dumps(merged_trie, ensure_ascii=False))

    print("Merge complete!", file=__import__('sys').stderr)


if __name__ == '__main__':
    main()
