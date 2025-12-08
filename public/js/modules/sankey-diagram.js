import { sankey, sankeyLinkHorizontal } from 'd3-sankey';
import { select } from 'd3-selection';
import { scaleOrdinal } from 'd3-scale';
import { schemeCategory10 } from 'd3-scale-chromatic';
import { setupExamples } from './base.js';

let currentSankeyData = null;

// Build Sankey data from subtries and inverted subtries
function buildSankeyData(word, subtrie, invertedSubtrie, maxDepth = 2, direction = 'both') {
    const nodes = [];
    const links = [];
    const nodeMap = new Map();
    const nodePaths = new Map(); // Track the path to each node
    const nodeIsIncoming = new Map(); // Track if node is from inverted trie (incoming)

    let nodeId = 0;

    // Helper to get or create node
    function getNodeId(name, depth, path = [], isIncoming = false) {
        const key = `${name}_${depth}`;
        if (!nodeMap.has(key)) {
            const id = nodeId++;
            nodeMap.set(key, id);
            nodes.push({ id, name, depth });
            nodePaths.set(id, path);
            nodeIsIncoming.set(id, isIncoming);
        }
        return nodeMap.get(key);
    }

    // Add center node (the searched word)
    const centerDepth = direction === 'incoming' ? maxDepth : 1;
    const centerNodeId = getNodeId(word, centerDepth, [word], false);

    // Process forward trie (words that come after)
    if (subtrie && (direction === 'both' || direction === 'outgoing')) {
        function processForwardNode(trieNode, parentId, parentDepth, parentPath) {
            for (const [key, value] of Object.entries(trieNode)) {
                if (key === '__l' || key === '__e' || key === '__C') continue;

                const count = value.__C || 1;
                const currentPath = [...parentPath, key];
                const childId = getNodeId(key, parentDepth + 1, currentPath, false);

                links.push({
                    source: parentId,
                    target: childId,
                    value: count
                });

                // Recurse to next level (limit depth to avoid too much complexity)
                if (parentDepth < maxDepth && typeof value === 'object') {
                    processForwardNode(value, childId, parentDepth + 1, currentPath);
                }
            }
        }
        processForwardNode(subtrie, centerNodeId, centerDepth, [word]);
    }

    // Process inverted trie (words that come before)
    if (invertedSubtrie && (direction === 'both' || direction === 'incoming')) {
        function processBackwardNode(trieNode, childId, childDepth, childPath) {
            for (const [key, value] of Object.entries(trieNode)) {
                if (key === '__l' || key === '__e' || key === '__C') continue;

                const count = value.__C || 1;
                const currentPath = [key, ...childPath];
                const parentId = getNodeId(key, childDepth - 1, currentPath, true);

                links.push({
                    source: parentId,
                    target: childId,
                    value: count
                });

                // Recurse to previous level (limit depth)
                if (childDepth > (direction === 'outgoing' ? 1 : 1 - maxDepth) && typeof value === 'object') {
                    processBackwardNode(value, parentId, childDepth - 1, currentPath);
                }
            }
        }
        processBackwardNode(invertedSubtrie, centerNodeId, centerDepth, [word]);
    }

    return { nodes, links, nodePaths, centerDepth, nodeIsIncoming };
}

function initializeSankeyDiagram(container, word, subtrie, invertedSubtrie, options = {}) {
    if (!container || !word) return;

    const { maxDepth = 2, direction = 'both' } = options;

    // Clear previous diagram
    select(container).selectAll('*').remove();

    // Build data
    const data = buildSankeyData(word, subtrie, invertedSubtrie, maxDepth, direction);
    currentSankeyData = data;

    if (!data.nodes.length || !data.links.length) {
        const message = document.createElement('div');
        message.style.cssText = 'display: flex; align-items: center; justify-content: center; height: 100%; color: #eee; font-size: 16px;';
        message.textContent = 'No data available for Sankey diagram';
        container.appendChild(message);
        return;
    }

    const { nodePaths, centerDepth, nodeIsIncoming } = data;

    // Set up dimensions
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 600;
    const margin = { top: 20, right: 20, bottom: 20, left: 20 };

    // Create SVG
    const svg = select(container)
        .append('svg')
        .attr('width', '100%')
        .attr('height', '100%')
        .attr('viewBox', `0 0 ${width} ${height}`)
        .style('background', 'transparent');

    const g = svg.append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

    // Configure sankey
    const sankeyGenerator = sankey()
        .nodeId(d => d.id)
        .nodeWidth(20)
        .nodePadding(10)
        .extent([[0, 0], [width - margin.left - margin.right, height - margin.top - margin.bottom]]);

    // Generate layout
    const { nodes: layoutNodes, links: layoutLinks } = sankeyGenerator(data);

    // Color scale based on depth
    const color = scaleOrdinal(schemeCategory10);

    // Add links
    g.append('g')
        .attr('class', 'links')
        .selectAll('path')
        .data(layoutLinks)
        .enter()
        .append('path')
        .attr('d', sankeyLinkHorizontal())
        .attr('stroke', d => {
            // Color based on source node depth
            return color(d.source.depth);
        })
        .attr('stroke-width', d => Math.max(1, d.width))
        .attr('stroke-opacity', 0.3)
        .attr('fill', 'none')
        .on('mouseover', function () {
            select(this).attr('stroke-opacity', 0.6);
        })
        .on('mouseout', function () {
            select(this).attr('stroke-opacity', 0.3);
        })
        .append('title')
        .text(d => `${d.source.name} → ${d.target.name}\n${d.value} occurrences`);

    // Add nodes
    const node = g.append('g')
        .attr('class', 'nodes')
        .selectAll('g')
        .data(layoutNodes)
        .enter()
        .append('g');

    node.append('rect')
        .attr('x', d => d.x0)
        .attr('y', d => d.y0)
        .attr('height', d => d.y1 - d.y0)
        .attr('width', d => d.x1 - d.x0)
        .attr('fill', d => {
            // Highlight center node
            if (d.name === word) return '#FBB824';
            return color(d.depth);
        })
        .attr('stroke', '#fff')
        .attr('stroke-width', 1)
        .style('cursor', 'pointer')
        .on('click', function (event, d) {
            // Show examples for this node's path
            let path = nodePaths.get(d.id);
            if (path) {
                // If node is from the inverted trie (incoming), use inverted mode
                const isIncoming = nodeIsIncoming.get(d.id);
                if (direction === 'both' && isIncoming) {
                    window.currentMode = 'inverted';
                } else if (direction === 'both') {
                    window.currentMode = 'normal';
                }
                setupExamples(path);
            }
        })
        .append('title')
        .text(d => `${d.name}\n${d.value || 0} connections`);

    // Add labels
    node.append('text')
        .attr('x', d => d.x0 < width / 2 ? d.x1 + 6 : d.x0 - 6)
        .attr('y', d => (d.y1 + d.y0) / 2)
        .attr('dy', '0.35em')
        .attr('text-anchor', d => d.x0 < width / 2 ? 'start' : 'end')
        .attr('fill', '#eee')
        .attr('font-size', '12px')
        .attr('font-family', 'monospace')
        .style('pointer-events', 'none')
        .text(d => d.name);
}

function destroySankeyDiagram(container) {
    if (!container) return;
    select(container).selectAll('*').remove();
    currentSankeyData = null;
}

export { initializeSankeyDiagram, destroySankeyDiagram };
