import argparse
import json

# really just dedupes, I think?


def main():
    parser = argparse.ArgumentParser(
        description='Parse a tatoeba translations file')
    parser.add_argument(
        '--file', help='a tatoeba download')

    args = parser.parse_args()

    translations = {}
    with open(args.file) as f:
        for line in f:
            target, base = line.strip().split('\t')
            translations[target] = base

    for item in translations.items():
        print(f"{item[0]}\t{item[1]}")


if __name__ == '__main__':
    main()
