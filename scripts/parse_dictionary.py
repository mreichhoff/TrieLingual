import argparse
import json
from typing import Any, Dict, List


def normalize_form_of(raw_form: Any) -> List[str]:
    """Normalize the form_of field into a list of lemma strings."""
    if raw_form is None:
        return []
    if isinstance(raw_form, list):
        # Elements may be dicts with 'word' or raw strings
        result = []
        for item in raw_form:
            if isinstance(item, dict):
                word = item.get('word') or item.get('lemma')
                if word:
                    result.append(word)
            elif isinstance(item, str):
                result.append(item)
        return result
    if isinstance(raw_form, dict):
        word = raw_form.get('word') or raw_form.get('lemma')
        return [word] if word else []
    if isinstance(raw_form, str):
        return [raw_form]
    return []


def join_glosses(sense: Dict[str, Any]) -> str:
    """Prefer raw_glosses, fall back to glosses. Join with '; '"""
    raw = sense.get('raw_glosses')
    if raw:
        return '; '.join(raw)
    glosses = sense.get('glosses')
    if glosses:
        # glosses may be list of strings or list of dicts
        cleaned = []
        for g in glosses:
            if isinstance(g, dict):
                text = g.get('gloss') or g.get('text')
                if text:
                    cleaned.append(text)
            elif isinstance(g, str):
                cleaned.append(g)
        if cleaned:
            return '; '.join(cleaned)
    return ''


def extract_links(sense: Dict[str, Any]) -> List[str]:
    links = sense.get('links')
    if not links:
        return []
    result = []
    for link in links:
        if isinstance(link, dict):
            word = link.get('word') or link.get('title') or link.get('text')
            if word:
                result.append(word)
        elif isinstance(link, str):
            result.append(link)
    return result


def main():
    parser = argparse.ArgumentParser(
        description='Parse a dictionary JSONL file into a compact mapping.')
    parser.add_argument('--filename', required=True,
                        help='JSONL dictionary file (one JSON object per line).')
    parser.add_argument('--include-empty', action='store_true',
                        help='Include senses with no gloss text.')
    args = parser.parse_args()

    word_key = 'word'
    senses_key = 'senses'
    tags_key = 'tags'
    form_of_key = 'form_of'
    part_of_speech_key = 'pos'

    output: Dict[str, List[Dict[str, Any]]] = {}
    with open(args.filename, encoding='utf-8') as f:
        for line in f:
            if not line.strip():
                continue
            curr = json.loads(line)
            word = curr.get(word_key)
            if not word:
                continue
            senses = curr.get(senses_key, [])
            if word not in output:
                output[word] = []
            for sense in senses:
                gloss_text = join_glosses(sense)
                if not gloss_text and not args.include_empty:
                    continue
                entry: Dict[str, Any] = {
                    'def': gloss_text
                }
                # tags (morphological info, e.g., first-person, imperfect, indicative)
                tags = sense.get(tags_key)
                if tags:
                    entry['tags'] = tags
                # form_of -> lemma(s)
                form_raw = sense.get(form_of_key)
                lemmas = normalize_form_of(form_raw)
                if lemmas:
                    entry['form_of'] = lemmas
                # links referencing lemmas or related words
                link_words = extract_links(sense)
                if link_words:
                    entry['links'] = link_words
                # part of speech at entry level or sense level
                pos = sense.get(part_of_speech_key) or curr.get(
                    part_of_speech_key)
                if pos:
                    entry['pos'] = pos
                output[word].append(entry)

    print(json.dumps(output, ensure_ascii=False))


if __name__ == '__main__':
    main()
