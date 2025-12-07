import json
import argparse

COUNT_KEY = '__C'


def read_dictionary_file(filename):
    with open(filename) as f:
        return json.load(f)


def all_in_dictionary(words, dictionary):
    for word in words:
        if word == '' or word not in dictionary:
            return False
    return True


def trim_children(trie, depth, counts):
    to_delete = sorted(
        [item for item in trie.items() if item[0] != COUNT_KEY],
        key=lambda kvp: kvp[1][COUNT_KEY],
        reverse=True)[counts[depth]:]
    for item in to_delete:
        if item[0] == COUNT_KEY:
            continue
        trie.pop(item[0])
    for key in trie.keys():
        if key == COUNT_KEY:
            continue
        trim_children(trie[key], depth+1, counts)


def trim_by_count(trie, count):
    to_delete = []
    for key in trie.keys():
        if key == COUNT_KEY:
            continue
        if trie[key][COUNT_KEY] < count:
            to_delete.append(key)
    for item in to_delete:
        trie.pop(item)
    for key in trie.keys():
        if key == COUNT_KEY:
            continue
        trim_by_count(trie[key], count)


def main():
    parser = argparse.ArgumentParser(
        description='Build a word-level trie from preprocess_collocations.py output')
    parser.add_argument(
        '--dictionary-filename', help='the filename of a dictionary output by parse_dictionary')
    # assume the collocations were already filtered by some max frequency rank
    # parser.add_argument(
    #     '--frequency-filename', help='the filename of a frequency dictionary, output by get_word_freq')
    parser.add_argument('-f', '--collocations-file-list', nargs='+',
                        help='The list of files output by preprocess_collocations, in order of collocation length (e.g., one for 2 grams, one for 3 grams)', required=True)
    args = parser.parse_args()

    dictionary = read_dictionary_file(args.dictionary_filename)
    trie = {}

    collocation_length = 2
    for file in args.collocations_file_list:
        with open(file) as f:
            for line in f:
                line = line.strip()
                parts = line.split('\t')
                if (len(parts) != 2):
                    # I very foolishly made some empty string handling error...
                    continue
                collocation, count = parts
                words = collocation.split(' ')
                if len(words) != collocation_length or not all_in_dictionary(words, dictionary):
                    continue
                runner = trie
                for word in words:
                    if word not in runner:
                        runner[word] = {COUNT_KEY: int(count)}
                    runner = runner[word]
        collocation_length += 1
    for key in trie.keys():
        if key == COUNT_KEY:
            continue
        trim_children(trie[key], 0, [6, 2, 0])
    for key in trie.keys():
        if key == COUNT_KEY:
            continue
        trim_by_count(trie[key], 10)

    print(json.dumps(trie, ensure_ascii=False))


if __name__ == '__main__':
    main()
