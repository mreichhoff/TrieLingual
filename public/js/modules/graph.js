import cytoscape from "cytoscape";

let cy = null;
let root = null;
let resizeTimer = null;
let resizeListenerAdded = false;
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
                level: trie[curr.word]['__l']
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
    return `${Math.max(30, (word.length * 10) + 12)}px`;
};
let nodeHeight = function (element) {
    return '32px';
};

let layout = function (root) {
    return {
        name: 'breadthfirst',
        root: root,
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
let setupCytoscape = function (root, elements, graphContainer, nodeEventHandler, edgeEventHandler) {
    root = root;
    cy = cytoscape({
        container: graphContainer,
        elements: elements,
        layout: layout(root),
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
                    cy.layout(layout(root)).run();
                }
            }, 150);
        });
        resizeListenerAdded = true;
    }
};
let initializeGraph = function (value, containerElement, nodeEventHandler, edgeEventHandler) {
    let result = { 'nodes': [], 'edges': [] };
    let maxDepth = 1;
    bfs(value, result, maxDepth, {});
    setupCytoscape(value, result, containerElement, nodeEventHandler, edgeEventHandler);
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