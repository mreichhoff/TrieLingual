let trie = {};
let visited = {};
let maxLevel = 6;
let minLevel = 1;
const maxEdgesForRecommendation = 16;

let getRecommendations = function () {
    if (!trie || !visited) {
        return [];
    }
    if (Object.keys(visited).length < 5) {
        return [];
    }
    let keys = Object.keys(trie);
    let best = 0;
    let result = [];
    for (let i = 0; i < keys.length; i++) {
        if (visited[keys[i]] || trie[keys[i]]['__l'] < minLevel || trie[keys[i]]['__l'] > maxLevel) {
            continue;
        }
        let currentWord = keys[i];
        let total = 0;
        let queue = [];
        queue.push({ word: currentWord, trie: trie[currentWord] });
        while (queue.length > 0) {
            //apparently shift isn't O(1) in js, but this is max 18 elements, so screw it
            let curr = queue.shift();
            total += ((visited[curr.word] || 0) / trie[curr.word]['__l']);
            for (const [key, value] of Object.entries(curr.trie)) {
                if (key === '__l') {
                    continue;
                }
                queue.push({ word: key, trie: curr.trie[key] });
            }
        }
        if (best < total) {
            result = [currentWord];
        } else if (best === total) {
            result.push(currentWord);
        }
        best = Math.max(best, total);
    }
    result.sort((a, b) => {
        return trie[a]['__l'] - trie[b]['__l'];
    });
    return result.slice(0, 3);
}
onmessage = function (e) {
    if (e.data.type === 'graph') {
        trie = e.data.payload;
    } else if (e.data.type === 'visited') {
        visited = e.data.payload;
    } else if (e.data.type === 'levelPreferences') {
        maxLevel = e.data.payload.maxLevel;
        minLevel = e.data.payload.minLevel;
    }
}
setInterval(function () {
    let message = {
        recommendations: getRecommendations()
    };
    postMessage(message);
}, 60000);