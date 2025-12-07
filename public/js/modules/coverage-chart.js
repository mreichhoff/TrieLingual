import { Chart, registerables } from 'chart.js';

// Register Chart.js components
Chart.register(...registerables);

let chart = null;

/**
 * Calculate cumulative coverage data from word frequency list
 * Returns array of { rank, coverage, word } objects
 */
let calculateCoverage = function () {
    if (!window.freqs || !window.wordlist) {
        return [];
    }

    // Get total count across all words
    const totalCount = Object.values(window.freqs).reduce((sum, item) => sum + item.count, 0);

    let cumulativeCount = 0;
    const coverageData = [];

    // wordlist is array of [word, count] pairs, already sorted by frequency
    window.wordlist.forEach((item, index) => {
        const word = item[0];
        const count = item[1];
        if (word && count) {
            cumulativeCount += count;
            const coverage = (cumulativeCount / totalCount) * 100;

            // Sample data points for performance (every 10th word, plus milestones)
            if (index % 10 === 0 || index < 100 ||
                index === 499 || index === 999 || index === 1999 ||
                index === 4999 || index === 9999) {
                coverageData.push({
                    rank: index + 1,
                    coverage: coverage,
                    word: word
                });
            }
        }
    });

    return coverageData;
};

/**
 * Initialize the coverage chart in the given container
 * @param {HTMLElement} container - The container element
 * @param {string} focusWord - Optional word to focus on in the chart
 */
let initializeCoverageChart = function (container, focusWord) {
    if (!container) return;

    // Clear existing content
    container.innerHTML = '';

    // Create canvas element
    const canvas = document.createElement('canvas');
    canvas.id = 'coverage-chart-canvas';
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', 'Cumulative word coverage chart');
    container.appendChild(canvas);

    const coverageData = calculateCoverage();

    if (!coverageData.length) {
        container.innerHTML = '<p style="color: #fff; padding: 20px; text-align: center;">No frequency data available</p>';
        return;
    }

    // Find the focus word's rank and calculate view window
    let focusRank = null;
    let focusWordData = null;
    if (focusWord && window.freqs && window.freqs[focusWord.toLowerCase()]) {
        focusRank = window.freqs[focusWord.toLowerCase()].freq;
        // Find the data point for this word (or closest to it)
        focusWordData = coverageData.find(d => d.rank === focusRank) ||
            coverageData.reduce((prev, curr) =>
                Math.abs(curr.rank - focusRank) < Math.abs(prev.rank - focusRank) ? curr : prev
            );
    }

    // Calculate X-axis range based on focus word
    let xMin = 0;
    let xMax = window.wordlist ? window.wordlist.length : 10000;

    if (focusRank) {
        // Add 20% buffer on each side, but ensure we show at least 500 words
        const buffer = Math.max(500, Math.floor(focusRank * 0.2));
        xMin = Math.max(0, focusRank - buffer);
        xMax = Math.min(xMax, focusRank + buffer);
    }

    // Filter data to the view window for better performance
    const visibleData = coverageData.filter(d => d.rank >= xMin && d.rank <= xMax);

    // Create chart
    const ctx = canvas.getContext('2d');

    // Build datasets
    const datasets = [{
        label: 'Language Coverage %',
        data: visibleData.map(d => ({ x: d.rank, y: d.coverage })),
        borderColor: 'rgba(96, 165, 250, 1)',
        backgroundColor: 'rgba(96, 165, 250, 0.1)',
        fill: true,
        tension: 0.4,
        pointRadius: function (context) {
            // Highlight the focus word point
            if (focusWordData && context.parsed && context.parsed.x === focusWordData.rank) {
                return 8;
            }
            return 1;
        },
        pointHoverRadius: 5,
        pointBackgroundColor: function (context) {
            // Highlight the focus word point
            if (focusWordData && context.parsed && context.parsed.x === focusWordData.rank) {
                return 'rgba(251, 191, 36, 1)'; // amber color
            }
            return 'rgba(96, 165, 250, 1)';
        },
        pointBorderColor: '#fff',
        pointBorderWidth: 2
    }];

    chart = new Chart(ctx, {
        type: 'line',
        data: {
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: focusWord ? `Cumulative Word Coverage - Focused on "${focusWord}"` : 'Cumulative Word Coverage',
                    color: '#fff',
                    font: {
                        size: 18,
                        weight: 'bold'
                    },
                    padding: {
                        top: 10,
                        bottom: 20
                    }
                },
                subtitle: {
                    display: true,
                    text: focusWord && focusRank
                        ? `"${focusWord}" is ranked #${focusRank} (${focusWordData ? focusWordData.coverage.toFixed(2) : '?'}% coverage at this point)`
                        : 'How much language you would understand by learning words in order of frequency',
                    color: focusWord ? 'rgba(251, 191, 36, 0.9)' : 'rgba(255, 255, 255, 0.7)',
                    font: {
                        size: 14,
                        weight: focusWord ? '600' : 'normal'
                    },
                    padding: {
                        bottom: 20
                    }
                },
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    titleColor: '#fff',
                    bodyColor: '#fff',
                    borderColor: 'rgba(96, 165, 250, 0.5)',
                    borderWidth: 1,
                    padding: 12,
                    displayColors: false,
                    callbacks: {
                        title: function (context) {
                            const dataIndex = context[0].dataIndex;
                            const dataPoint = visibleData[dataIndex];
                            if (!dataPoint) return '';
                            const word = dataPoint.word;
                            const isFocusWord = focusWord && word.toLowerCase() === focusWord.toLowerCase();
                            return `Word #${dataPoint.rank}: "${word}"${isFocusWord ? ' ⭐' : ''}`;
                        },
                        label: function (context) {
                            return `Coverage: ${context.parsed.y.toFixed(2)}%`;
                        },
                        afterLabel: function (context) {
                            const rank = context.parsed.x;
                            return `\nLearning the top ${rank} words gives you ${context.parsed.y.toFixed(2)}% understanding`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    type: 'linear',
                    min: xMin,
                    max: xMax,
                    title: {
                        display: true,
                        text: 'Word Rank (by frequency)',
                        color: '#fff',
                        font: {
                            size: 14
                        }
                    },
                    ticks: {
                        color: 'rgba(255, 255, 255, 0.7)',
                        callback: function (value) {
                            // Format large numbers with commas
                            return value.toLocaleString();
                        }
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Cumulative Coverage (%)',
                        color: '#fff',
                        font: {
                            size: 14
                        }
                    },
                    ticks: {
                        color: 'rgba(255, 255, 255, 0.7)',
                        callback: function (value) {
                            return value.toFixed(0) + '%';
                        }
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    },
                    min: 0,
                    max: 100
                }
            },
            interaction: {
                intersect: false,
                mode: 'index'
            }
        }
    });
};

/**
 * Destroy the chart instance
 */
let destroyCoverageChart = function () {
    if (chart) {
        chart.destroy();
        chart = null;
    }
};

export { initializeCoverageChart, destroyCoverageChart };
