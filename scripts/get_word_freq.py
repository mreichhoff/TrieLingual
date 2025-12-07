import json
from heapq import nlargest
import argparse

from lang_utils import tokenize


def main():
    parser = argparse.ArgumentParser(
        description='Get word frequencies from text files.')
    parser.add_argument(
        '--language', help='a lowercase language name, like chinese or english')
    parser.add_argument(
        '--limit', help='remove words ranked lower than this limit')
    parser.add_argument('-f', '--file-list', nargs='+',
                        help='The list of files, one sentence per line', required=True)

    args = parser.parse_args()

    raw_result = {}
    for filename in args.file_list:
        with open(filename) as target_sentences:
            for line in target_sentences:
                target = line.strip()
                words = tokenize(target, args.language, args.language.lower() != 'german')
                for word in words:
                    if word == '':
                        continue
                    if word not in raw_result:
                        raw_result[word] = 0
                    raw_result[word] += 1

    limited = nlargest(min(int(args.limit), len(raw_result)),
                       raw_result.items(), key=lambda kvp: kvp[1])
    result = {x[0]: x[1] for x in limited}

    print(json.dumps(result, ensure_ascii=False))


if __name__ == '__main__':
    main()
