import { hierarchy, partition } from 'd3-hierarchy';
import { select } from 'd3-selection';
import { arc } from 'd3-shape';
import { scaleOrdinal } from 'd3-scale';
import { schemeCategory10 } from 'd3-scale-chromatic';
import { zoom, zoomIdentity } from 'd3-zoom';
import { setupExamples } from './base.js';

// Build hierarchical data structure for sunburst from subtrie
let buildSunburstData = function (word, subtrie) {
    if (!subtrie || !word) return null;

    // Map to track full paths for each node ID
    const nodePaths = new Map();

    // Recursive function to build hierarchy
    const buildNode = function (key, data, path, depth = 0) {
        const currentPath = [...path, key];
        const nodeId = currentPath.join('_');
        nodePaths.set(nodeId, currentPath);

        const node = {
            name: key,
            id: nodeId,
            path: currentPath,
            depth: depth
        };

        // Get frequency level from window.freqs based on word rank
        if (window.freqs && window.freqs[key.toLowerCase()]) {
            const rank = window.freqs[key.toLowerCase()].freq;
            // Map rank to level (1-6) matching the frequency system
            if (rank < 500) {
                node.level = 1;
            } else if (rank < 1000) {
                node.level = 2;
            } else if (rank < 2000) {
                node.level = 3;
            } else if (rank < 4000) {
                node.level = 4;
            } else if (rank < 7000) {
                node.level = 5;
            } else if (rank < 10000) {
                node.level = 6;
            }
        }

        // Get count for arc sizing
        if (data.__C) {
            node.value = data.__C;
        } else {
            node.value = 1; // Default if no count
        }

        // Build children
        const children = [];
        for (const childKey in data) {
            if (childKey === '__l' || childKey === '__C' || childKey === '__e') continue;
            const childNode = buildNode(childKey, data[childKey], currentPath, depth + 1);
            if (childNode) {
                children.push(childNode);
            }
        }

        if (children.length > 0) {
            node.children = children;
        }

        return node;
    };

    // Build root node
    const root = buildNode(word, subtrie, [], 0);

    return { root, nodePaths };
};

// Initialize sunburst diagram
let initializeSunburstDiagram = function (container, word, subtrie) {
    if (!container || !word || !subtrie) return;

    // Clear existing content
    container.innerHTML = '';

    // Build data structure
    const { root, nodePaths } = buildSunburstData(word, subtrie);
    if (!root) return;

    // Set up dimensions
    const width = 928;
    const height = 928;
    const radius = Math.min(width, height) / 2;

    // Create frequency-based gradient color function (similar to trie visualization)
    const getFrequencyColor = function (level) {
        if (!level) return '#64748b'; // Default for nodes without level
        // Gradient from red (common) to blue (rare)
        const colors = [
            { stop: 1, color: [239, 68, 68] },    // red (top 500)
            { stop: 2, color: [249, 115, 22] },   // orange (top 1k)
            { stop: 3, color: [234, 179, 8] },    // yellow (top 2k)
            { stop: 4, color: [34, 197, 94] },    // green (top 4k)
            { stop: 5, color: [168, 85, 247] },   // purple (top 7k)
            { stop: 6, color: [59, 130, 246] }    // blue (top 10k)
        ];
        const colorData = colors.find(c => c.stop === level);
        if (colorData) {
            const [r, g, b] = colorData.color;
            return `rgb(${r}, ${g}, ${b})`;
        }
        return '#64748b';
    };

    // Create SVG
    const svg = select(container)
        .append('svg')
        .attr('viewBox', `${-width / 2} ${-height / 2} ${width} ${height}`)
        .style('width', '100%')
        .style('height', '100%')
        .style('font', '12px sans-serif');

    // Add a group for zoom transformations
    const g = svg.append('g');

    // Set up zoom behavior
    const zoomBehavior = zoom()
        .scaleExtent([0.5, 4]) // Allow zoom from 50% to 400%
        .clickDistance(4) // Treat movements less than 4 pixels as clicks, not drags
        .on('zoom', (event) => {
            g.attr('transform', event.transform);
        });

    svg.call(zoomBehavior);

    // TODO: do we want a reset button? Not sure there's space for it.
    // // Add reset zoom button
    // const resetButton = select(container)
    //     .append('div')
    //     .style('position', 'absolute')
    //     .style('top', '10px')
    //     .style('right', '10px')
    //     .style('background', 'rgba(30, 41, 59, 0.9)')
    //     .style('color', '#fff')
    //     .style('padding', '8px 12px')
    //     .style('border-radius', '6px')
    //     .style('cursor', 'pointer')
    //     .style('font-size', '14px')
    //     .style('font-weight', '500')
    //     .style('border', '1px solid rgba(255, 255, 255, 0.2)')
    //     .style('z-index', '10')
    //     .text('Reset Zoom')
    //     .on('click', () => {
    //         svg.transition()
    //             .duration(750)
    //             .call(zoomBehavior.transform, zoomIdentity);
    //     })
    //     .on('mouseover', function () {
    //         select(this).style('background', 'rgba(51, 65, 85, 0.95)');
    //     })
    //     .on('mouseout', function () {
    //         select(this).style('background', 'rgba(30, 41, 59, 0.9)');
    //     });

    // Create hierarchy and partition layout
    const hierarchyRoot = hierarchy(root)
        .count() // Use count() instead of sum() to give equal weight to each node
        .sort((a, b) => b.value - a.value);

    const partitionLayout = partition()
        .size([2 * Math.PI, radius]);

    partitionLayout(hierarchyRoot);

    // Create arc generator
    const arcGenerator = arc()
        .startAngle(d => d.x0)
        .endAngle(d => d.x1)
        .padAngle(d => Math.min((d.x1 - d.x0) / 2, 0.005))
        .padRadius(radius / 2)
        .innerRadius(d => d.y0)
        .outerRadius(d => d.y1 - 1);

    // Track whether a path is currently selected
    let pathSelected = false;

    // Draw arcs
    const paths = g.append('g')
        .selectAll('path')
        .data(hierarchyRoot.descendants())
        .join('path')
        .attr('fill', d => {
            if (d.depth === 0) return '#94a3b8'; // Root node color
            return getFrequencyColor(d.data.level);
        })
        .attr('d', arcGenerator)
        .style('cursor', 'pointer')
        .style('opacity', 0.85)
        .attr('stroke', 'none')
        .attr('stroke-width', 0)
        .on('mouseover', function () {
            if (!pathSelected) {
                select(this)
                    .style('opacity', 1)
                    .style('filter', 'brightness(1.1)');
            }
        })
        .on('mouseout', function () {
            if (!pathSelected) {
                select(this)
                    .style('opacity', 0.85)
                    .style('filter', 'none');
            }
        })
        .on('click', function (event, d) {
            event.stopPropagation();

            // Mark that a path is selected
            pathSelected = true;

            // Reset all paths to default state
            paths
                .attr('stroke', 'none')
                .attr('stroke-width', 0)
                .style('filter', 'none');

            // Dim all nodes first
            paths.style('opacity', 0.3);

            // Highlight the path from root to clicked node
            const ancestorIds = d.ancestors().map(ancestor => ancestor.data.id);
            paths.filter(node => ancestorIds.includes(node.data.id))
                .attr('stroke', '#fff')
                .attr('stroke-width', 3)
                .style('opacity', 1);

            // Get the path for this node
            const path = nodePaths.get(d.data.id);
            if (path && path.length > 0) {
                // Set mode to normal for forward-looking subtrie
                window.currentMode = 'normal';

                // Show examples for this path
                setupExamples(path);
            }
        });

    // Add labels for larger arcs
    g.append('g')
        .attr('pointer-events', 'none')
        .attr('text-anchor', 'middle')
        .selectAll('text')
        .data(hierarchyRoot.descendants().filter(d => {
            // Only show labels for arcs that are large enough
            const angle = d.x1 - d.x0;
            return angle > 0.04 && d.depth > 0;
        }))
        .join('text')
        .attr('transform', d => {
            const x = (d.x0 + d.x1) / 2 * 180 / Math.PI;
            const y = (d.y0 + d.y1) / 2;
            return `rotate(${x - 90}) translate(${y},0) rotate(${x < 180 ? 0 : 180})`;
        })
        .attr('dy', '0.35em')
        .style('font-size', d => {
            const angle = d.x1 - d.x0;
            if (angle > 0.2) return '18px';
            if (angle > 0.1) return '16px';
            if (angle > 0.06) return '14px';
            return '12px';
        })
        .style('fill', 'white')
        .style('text-shadow', '0 1px 2px rgba(0,0,0,0.6)')
        .style('font-weight', '500')
        .text(d => d.data.name);

    // Add center label
    g.append('text')
        .attr('text-anchor', 'middle')
        .attr('dy', '0.35em')
        .style('font-size', '24px')
        .style('font-weight', 'bold')
        .style('fill', 'white')
        .style('text-shadow', '0 2px 4px rgba(0,0,0,0.8)')
        .style('pointer-events', 'none')
        .text(word);
};

// Cleanup function
let destroySunburstDiagram = function (container) {
    if (container) {
        container.innerHTML = '';
    }
};

export { initializeSunburstDiagram, destroySunburstDiagram };
