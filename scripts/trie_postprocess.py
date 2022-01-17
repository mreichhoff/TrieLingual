import argparse
import json


def parse_line(line):
    return line.strip().split('\t')


def get_words_with_level(lines):
    result = {}
    for line in lines:
        parsed_line = parse_line(line)
        result[parsed_line[0]] = int(parsed_line[1])
    return result


def trim_children(trie, max_depth):
    for word in trie:
        if max_depth == 0:
            trie[word] = [key for key in trie[word]]
        else:
            trim_children(trie[word], max_depth-1)


def main():
    parser = argparse.ArgumentParser(
        description='Add levels and optimize a trie')
    parser.add_argument(
        '--trie-filename', help='a trie in json format')
    parser.add_argument(
        '--levels-filename', help='the filename of a list of "word\tlevel", one word per line')
    parser.add_argument(
        '--max-depth', help='the 0-indexed depth after which no children are allowed (e.g., for trigrams, use 2)')

    args = parser.parse_args()
    words_with_level = {}
    trie = {}
    with open(args.levels_filename) as f:
        words_with_level = get_words_with_level(f.readlines())
    with open(args.trie_filename) as f:
        trie = json.load(f)

    # convert bottom-level dicts (all empty) to arrays
    # should save some space
    # or not
    #trim_children(trie, int(args.max_depth)-1)

    for item in words_with_level.items():
        if item[0] not in trie:
            trie[item[0]] = {}
        trie[item[0]]['__l'] = item[1]

    print(json.dumps(trie, ensure_ascii=False))


if __name__ == '__main__':
    main()
