import cytoscape from "cytoscape";

let cy = null;
let root = null;
let resizeTimer = null;
let resizeListenerAdded = false;
function getLevelForWord(word) {
    if (window.freqs && window.freqs[word]) {
        let freqRank = window.freqs[word].freq;
        if (freqRank < 500) {
            return 1;
        } else if (freqRank < 1000) {
            return 2;
        } else if (freqRank < 2000) {
            return 3;
        } else if (freqRank < 4000) {
            return 4;
        } else if (freqRank < 7000) {
            return 5;
        } else {
            return 6;
        }
    } else {
        return 6;
    }
}

let bfs = function (value, elements) {
    if (!value) {
        return;
    }
    let queue = [];
    queue.push({ word: value, path: [value], trie: trie[value] });
    while (queue.length > 0) {
        //apparently shift isn't O(1) in js, but this is max 18 elements, so screw it
        let curr = queue.shift();
        elements.nodes.push({
            data: {
                id: curr.path.join(''),
                word: curr.word,
                depth: curr.path.length - 1,
                path: curr.path,
                level: getLevelForWord(curr.word)
            }
        });
        for (const [key, value] of Object.entries(curr.trie)) {
            if (key === '__l') {
                continue;
            }
            elements.edges.push({
                data: {
                    id: ('_edge' + curr.path.join('') + key),
                    source: curr.path.join(''),
                    target: (curr.path.join('') + key)
                }
            });
            queue.push({ word: key, path: [...curr.path, key], trie: curr.trie[key] });
        }
    }
};

// BFS for inverted trie - traverses backward from word to its predecessors
let bfsInverted = function (value, elements, invertedTrieData) {
    if (!value || !invertedTrieData) {
        return;
    }
    let queue = [];
    queue.push({ word: value, path: [value], trie: invertedTrieData });
    while (queue.length > 0) {
        let curr = queue.shift();
        elements.nodes.push({
            data: {
                id: curr.path.join(''),
                word: curr.word,
                depth: curr.path.length - 1,
                path: curr.path,
                level: getLevelForWord(curr.word)
            }
        });
        for (const [key, value] of Object.entries(curr.trie)) {
            if (key === '__l') {
                continue;
            }
            // In inverted trie, edges point backward (from predecessor to current word)
            elements.edges.push({
                data: {
                    id: ('_edge' + key + curr.path.join('')),
                    source: (key + curr.path.join('')),
                    target: curr.path.join('')
                }
            });
            queue.push({ word: key, path: [key, ...curr.path], trie: curr.trie[key] });
        }
    }
};
//this file meant to hold all cytoscape-related code
let levelColor = function (element) {
    let level = element.data('level');
    // Warm to cool gradient: level 1 (most frequent) = warm red, level 6 (least frequent) = cool blue
    switch (level) {
        case 1:
            return '#ff4444';  // Warm red (most frequent)
        case 2:
            return '#ff8833';  // Warm orange
        case 3:
            return '#ffcc22';  // Warm yellow
        case 4:
            return '#88dd44';  // Lime green
        case 5:
            return '#44ddbb';  // Cool cyan
        case 6:
            return '#4488ff';  // Cool blue (least frequent)
    }
};
let nodeWidth = function (element) {
    let word = element.data('word');
    return `${Math.max(30, (word.length * 10) + 10)}px`;
};
let nodeHeight = function (element) {
    return '32px';
};

let layout = function (root) {
    let rootSelector = root;
    if (Array.isArray(root)) {
        rootSelector = root.join(',');
    }
    // TODO: this only sort of works. Ideally it would show the leaves at the top, but this just switches arrow directions?
    return {
        name: 'breadthfirst',
        root: rootSelector,
        padding: 6,
        spacingFactor: 0.85
    };
};
let getStylesheet = function () {
    return [
        {
            selector: 'node',
            style: {
                'background-color': levelColor,
                'label': 'data(word)',
                'color': 'black',
                'font-size': '13px',
                'font-family': 'monospace',
                'shape': 'rectangle',
                'width': nodeWidth,
                'height': nodeHeight,
                'text-valign': 'center',
                'text-halign': 'center'
            }
        },
        {
            selector: 'edge',
            style: {
                'target-arrow-shape': 'triangle',
                'curve-style': 'straight',
                'arrow-scale': '0.9',
                'line-color': '#444',
                'target-arrow-color': '#777'
            }
        }
    ];
}
let setupCytoscape = function (root, elements, graphContainer, nodeEventHandler, edgeEventHandler, mode) {
    root = root;
    // In inverted mode, find leaf nodes (nodes with no incoming edges) to use as roots
    let layoutRoots = root;
    if (mode === 'inverted') {
        const nodeIds = new Set(elements.nodes.map(n => n.data.id));
        const nodesWithIncomingEdges = new Set(elements.edges.map(e => e.data.target));
        const leafNodes = Array.from(nodeIds).filter(id => !nodesWithIncomingEdges.has(id));
        // Cytoscape expects selector strings with # prefix for IDs
        layoutRoots = leafNodes.length > 0 ? leafNodes.map(id => '#' + id) : root;
    }

    cy = cytoscape({
        container: graphContainer,
        elements: elements,
        layout: layout(layoutRoots),
        style: getStylesheet(),
        maxZoom: 10,
        minZoom: 0.5
    });
    cy.on('tap', 'node', nodeEventHandler);
    cy.on('tap', 'edge', edgeEventHandler);
    // Add a debounced window resize handler to re-run the layout when the viewport changes.
    // Ensure we only add one global listener even if setupCytoscape is called multiple times.
    if (!resizeListenerAdded) {
        window.addEventListener('resize', function () {
            if (resizeTimer) {
                clearTimeout(resizeTimer);
            }
            resizeTimer = setTimeout(function () {
                if (cy) {
                    // Re-apply the layout to redraw nodes/edges responsively
                    cy.layout(layout(layoutRoots)).run();
                }
            }, 150);
        });
        resizeListenerAdded = true;
    }
};
let initializeGraph = function (value, containerElement, nodeEventHandler, edgeEventHandler, mode, invertedTrieData) {
    let result = { 'nodes': [], 'edges': [] };
    let maxDepth = 1;
    if (mode === 'inverted' && invertedTrieData) {
        bfsInverted(value, result, invertedTrieData);
    } else {
        bfs(value, result, maxDepth, {});
    }
    setupCytoscape(value, result, containerElement, nodeEventHandler, edgeEventHandler, mode);
};
let isInGraph = function (node) {
    return cy && cy.getElementById(node).length;
};
let updateColorScheme = function () {
    if (!cy) {
        return;
    }
    cy.style(getStylesheet());
};

export { initializeGraph, isInGraph, updateColorScheme }