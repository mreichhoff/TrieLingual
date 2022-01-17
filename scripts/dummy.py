import json
with open('./freqs.json') as f:
    freq_dict = json.load(f)
    list = sorted(freq_dict.items(), key=lambda kvp: kvp[1], reverse=True)
    result = [x[0] for x in list]
    for word in result:
        print(word)
