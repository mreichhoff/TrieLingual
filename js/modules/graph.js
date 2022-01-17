let cy = null;
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
    switch (level) {
        case 6:
            return '#68aaee';
        case 5:
            return '#de68ee';
        case 4:
            return '#6de200';
        case 3:
            return '#fff249';
        case 2:
            return '#ff9b35';
        case 1:
            return '#ff635f';
    }
};
let nodeWidth = function (element) {
    let word = element.data('word');
    if (word.length <= 6) {
        return '45px';
    } else if (word.length <= 8) {
        return '60px';
    } else {
        return '80px';
    }
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
    //TODO make this injectable
    let prefersLight = window.matchMedia("(prefers-color-scheme: light)").matches;
    return [
        {
            selector: 'node',
            style: {
                'background-color': levelColor,
                'label': 'data(word)',
                'color': 'black',
                'font-size': '12px',
                'shape': 'round-rectangle',
                'width': nodeWidth,
                'text-valign': 'center',
                'text-halign': 'center'
            }
        },
        {
            selector: 'edge',
            style: {
                'target-arrow-shape': 'none',
                'curve-style': 'straight'
            }
        }
    ];
}
let setupCytoscape = function (root, elements, graphContainer, nodeEventHandler, edgeEventHandler) {
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