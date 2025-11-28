import argparse
import json


def main():
    parser = argparse.ArgumentParser(
        description='Parse a dictionary JSONL file into a compact mapping.')
    parser.add_argument('--dictionary-filename', required=True,
                        help='JSON dictionary file output by parse_dictionary.py.')
    parser.add_argument('--trie-filename', required=True,
                        help='The trie whose entries will be the allowlist of what to include in output.')
    args = parser.parse_args()

    with open(args.dictionary_filename) as f:
        dictionary = json.load(f)
    with open(args.trie_filename) as f:
        trie = json.load(f)
    output = {}
    for word in trie.keys():
        output[word] = dictionary[word] if word in dictionary else {}
    print(json.dumps(output, ensure_ascii=False))


if __name__ == '__main__':
    main()
