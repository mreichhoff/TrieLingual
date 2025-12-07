import json
import argparse

def get_word_frequencies(filename):
    with open(filename) as f:
        return {value.strip(): idx for idx, value in enumerate(f)}


def remove_freq_field(trie):
    if '__C' in trie:
        trie.pop('__C')
    for item in trie.keys():
        remove_freq_field(trie[item])


def trim_children(trie, depth, counts):
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


def trim_by_count(trie, count):
    to_delete = []
    for key in trie.keys():
        if key == "__C":
            continue
        if trie[key]["__C"] < count:
            to_delete.append(key)
    for item in to_delete:
        trie.pop(item)
    for key in trie.keys():
        if key == "__C":
            continue
        trim_by_count(trie[key], count)


zh_punctuation = {'。', '‘', '’', '“', '”', '，',
                  '？', '!', '...', '.', '! ', '?', ' ', '！', '"', '\'', ','}


def get_words(language, sentence):
    # if language == 'chinese':
    #     return [x for x in jieba.cut(sentence) if x not in zh_punctuation]
    # else:
    return [x.lower() for x in sentence.split()
            if any(letter.isalpha() for letter in x)]


def main():
    parser = argparse.ArgumentParser(
        description='Build a word-level trie')
    parser.add_argument(
        '--language', help='a lowercase language name, like chinese or english')
    parser.add_argument(
        '--allow-list-filename', help='the filename of an allow list, one word per line')
    parser.add_argument(
        '--target-sentences-filename', help='the filename of a list of sentences in the target language')

    args = parser.parse_args()
    allowlist = get_word_frequencies(args.allow_list_filename)
    trie = {}
    with open(args.target_sentences_filename) as f:
        for line in f:
            words = get_words(args.language, line.strip())
            for i in range(0, len(words)):
                if words[i] not in allowlist:
                    continue
                first = words[i]
                second = words[i+1] if i < len(words)-1 else None
                third = words[i+2] if i < len(words)-2 else None
                if first not in trie:
                    trie[first] = {"__C": 0}
                if second not in allowlist:
                    continue
                if second is not None and second not in trie[first]:
                    trie[first][second] = {"__C": 0}
                if second is not None:
                    trie[first][second]["__C"] += 1
                if third not in allowlist:
                    continue
                if third is not None and third not in trie[first][second]:
                    trie[first][second][third] = {"__C": 0}
                trie[first]["__C"] += 1
                if third is not None:
                    trie[first][second][third]["__C"] += 1
    for key in trie.keys():
        if key == "__C":
            continue
        trim_children(trie[key], 0, [6, 2, 0])
    trim_by_count(trie, 10)

    # remove_freq_field(trie)
    # TODO unfortunate that it includes a lot of empty {}
    # Will clean that up + add levels in post-processing step
    # This script is memory constrained and takes long enough as it is
    print(json.dumps(trie, ensure_ascii=False))


if __name__ == '__main__':
    main()
