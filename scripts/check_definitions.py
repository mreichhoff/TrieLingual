import argparse
import json


def get_hsk_words(hsk_filename):
    hsk_words = set()
    with open(hsk_filename) as f:
        for line in f:
            word, _ = line.split('\t')
            hsk_words.add(word)
            # we want each word and each individual character
            for i in range(0, len(word)):
                hsk_words.add(word[i])
    return hsk_words


def main():
    parser = argparse.ArgumentParser(
        description='Get definitions for HSK words. Outputs JSON.')
    parser.add_argument(
        '--hsk-filename', help='the filename of an HSK list of format {word\tlevel}')
    parser.add_argument(
        '--dict-filename', help='the definitions filename, formatted as json')

    args = parser.parse_args()

    words = get_hsk_words(args.hsk_filename)
    print(len(words))
    with open(args.dict_filename) as f:
        definitions = json.load(f)
        for word in words:
            if word not in definitions:
                print(word)


if __name__ == '__main__':
    main()
