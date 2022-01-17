import json
from heapq import heappush, heappushpop
import nltk
import argparse
from functools import reduce
import jieba


zh_punctuation = {'。', '‘', '’', '“', '”', '，',
                  '？', '!', '...', '.', '! ', '?', ' ', '！', '"', '\'', ','}


def get_words(language, sentence):
    if language == 'chinese':
        return [x for x in jieba.cut(sentence) if x not in zh_punctuation]
    else:
        return [x.lower() for x in nltk.word_tokenize(sentence, language=language)
                if any(letter.isalpha() for letter in x)]


def remove_freq_field(result_list):
    for item in result_list:
        item.pop('freq')


def get_tokens(language, sentence):
    # TODO could probably combine with get_words at some level
    if language == 'chinese':
        return [x for x in jieba.cut(sentence)]
    else:
        return [x for x in nltk.word_tokenize(sentence, language=language)]


def get_word_frequencies(filename):
    with open(filename) as f:
        return {value.strip(): idx for idx, value in enumerate(f)}


def get_word_set(filename):
    with open(filename) as f:
        return {value.strip(): [] for value in f}


def get_average_frequency(word_frequencies, words):
    # words assumed to be properly lowercased, etc.
    return reduce(lambda a, b: a + b, [word_frequencies[word]
                                       if word in word_frequencies else len(word_frequencies) for word in words]) / len(words)


def main():
    # TODO fill in as needed
    blocklist = {}
    parser = argparse.ArgumentParser(
        description='Get examples for a set of words in a file')
    parser.add_argument(
        '--language', help='a lowercase language name, like chinese or english')
    parser.add_argument(
        '--frequency-list-filename', help='the filename of a frequency list, one word per line')
    parser.add_argument(
        '--translations-filename', help='the filename of a list of sentences in the target language')
    parser.add_argument(
        '--word-set', help='the set of words for which to seek examples')

    args = parser.parse_args()

    freqs = get_word_frequencies(args.frequency_list_filename)
    word_set = get_word_set(args.word_set)
    with open(args.translations_filename) as f:
        for line in f:
            target, base = line.strip().split('\t')
            words = get_words(args.language, target)
            target_tokens = get_tokens(args.language, target)
            if(len(words) == 0):
                continue
            freq = get_average_frequency(freqs, words)
            for word in words:
                if word in word_set:
                    if len(word_set[word]) < 3:
                        heappush(word_set[word],
                                 (-freq, target_tokens, base))
                    else:
                        heappushpop(
                            word_set[word], (-freq, target_tokens, base))
    sentences = set()
    result = []
    for word in word_set.keys():
        for sentence in word_set[word]:
            joined = ''.join(sentence[1])
            if joined not in sentences:
                sentences.add(joined)
                result.append(
                    {'freq': -sentence[0], 't': sentence[1], 'b': sentence[2]})
    result.sort(key=lambda entry: entry['freq'])
    remove_freq_field(result)
    print(json.dumps(result, ensure_ascii=False))


if __name__ == '__main__':
    main()
