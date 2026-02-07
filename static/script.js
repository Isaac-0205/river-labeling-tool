// script.js - River Labeling Tool Frontend Logic
// Handles canvas drawing, API calls, and user interactions

const canvas = document.getElementById('riverCanvas');
const ctx = canvas.getContext('2d');

let points = [];
let isRiverClosed = false;

// Sample river data for quick testing
const sampleRivers = {
    elbe: {
        name: "ELBE",
        points: [
            [50, 150], [100, 140], [150, 145], [200, 155], [250, 150],
            [300, 140], [350, 145], [400, 160], [450, 180], [500, 200],
            [520, 230], [530, 270], [520, 310], [500, 340], [470, 360],
            [430, 370], [390, 365], [350, 350], [320, 330], [300, 310],
            [290, 280], [295, 250], [310, 220], [320, 200], [310, 180],
            [290, 170], [260, 175], [230, 185], [200, 180], [170, 170],
            [140, 165], [110, 160], [80, 155], [50, 150]
        ]
    },
    rhine: {
        name: "RHINE",
        points: [
            [280, 50], [290, 100], [295, 150], [300, 200], [305, 250],
            [310, 300], [315, 350], [320, 400], [340, 400], [335, 350],
            [330, 300], [325, 250], [320, 200], [315, 150], [310, 100],
            [300, 50], [280, 50]
        ]
    },
    danube: {
        name: "DANUBE",
        points: [
            [50, 250], [100, 245], [150, 250], [200, 255], [250, 250],
            [300, 245], [350, 250], [400, 255], [450, 260], [500, 265],
            [550, 270], [560, 280], [550, 285], [500, 280], [450, 275],
            [400, 270], [350, 265], [300, 260], [250, 265], [200, 270],
            [150, 265], [100, 260], [50, 255], [50, 250]
        ]
    }
};

// Canvas click handler - add points when drawing
canvas.addEventListener('click', (e) => {
    if (isRiverClosed) {
        alert('⚠️ River is already closed. Click "Clear" to start a new one.');
        return;
    }
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    points.push([x, y]);
    drawRiver();
});

/**
 * Draw the river polygon on canvas
 */
function drawRiver() {
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    if (points.length === 0) return;
    
    // Draw points
    ctx.fillStyle = '#667eea';
    points.forEach(p => {
        ctx.beginPath();
        ctx.arc(p[0], p[1], 5, 0, 2 * Math.PI);
        ctx.fill();
    });
    
    // Draw connecting lines
    ctx.strokeStyle = '#667eea';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    
    for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i][0], points[i][1]);
    }
    
    // If river is closed, fill it
    if (isRiverClosed) {
        ctx.closePath();
        ctx.fillStyle = 'rgba(102, 126, 234, 0.2)';
        ctx.fill();
    }
    
    ctx.stroke();
}

/**
 * Clear canvas and reset state
 */
function clearCanvas() {
    points = [];
    isRiverClosed = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    document.getElementById('results').style.display = 'none';
    document.getElementById('comparisonResults').style.display = 'none';
    document.getElementById('visualizationSection').style.display = 'none';
    document.getElementById('labelText').value = 'RIVER';
    document.getElementById('fontSize').value = 24;
}

/**
 * Close the river polygon
 */
function closeRiver() {
    if (points.length < 3) {
        alert('⚠️ Need at least 3 points to make a river!');
        return;
    }
    
    isRiverClosed = true;
    drawRiver();
    alert('✓ River closed! Now click "Place Label" or "Compare Algorithms".');
}

/**
 * Load a sample river for quick testing
 * @param {string} riverName - Key from sampleRivers object
 */
function loadSampleRiver(riverName) {
    if (!riverName) return;
    
    const river = sampleRivers[riverName];
    if (!river) {
        alert('❌ Sample river not found!');
        return;
    }
    
    points = JSON.parse(JSON.stringify(river.points)); // Deep copy
    isRiverClosed = true;
    document.getElementById('labelText').value = river.name;
    drawRiver();
    
    // Reset results
    document.getElementById('results').style.display = 'none';
    document.getElementById('comparisonResults').style.display = 'none';
    document.getElementById('visualizationSection').style.display = 'none';
}

/**
 * Call backend API to place label (single algorithm)
 */
async function placeLabel() {
    if (!isRiverClosed) {
        alert('⚠️ Please close the river first by clicking "Close River"!');
        return;
    }
    
    // Get inputs
    const labelText = document.getElementById('labelText').value.trim();
    const fontSize = parseInt(document.getElementById('fontSize').value);
    
    // Validation
    if (!labelText) {
        alert('⚠️ Please enter a river name!');
        return;
    }
    
    if (fontSize < 12 || fontSize > 48) {
        alert('⚠️ Font size must be between 12 and 48 pt!');
        return;
    }
    
    // Show loading state
    document.getElementById('loading').style.display = 'block';
    const loadingText = document.getElementById('loadingText');
    const loadingStep = document.getElementById('loadingStep');
    if (loadingText) loadingText.textContent = 'Placing label...';
    if (loadingStep) loadingStep.textContent = '';
    document.getElementById('results').style.display = 'none';
    document.getElementById('comparisonResults').style.display = 'none';
    document.getElementById('visualizationSection').style.display = 'none';
    document.getElementById('placeLabelBtn').disabled = true;
    document.getElementById('compareBtn').disabled = true;
    
    setTimeout(() => { const s = document.getElementById('loadingStep'); if (s) s.textContent = 'Computing optimal position...'; }, 200);
    
    try {
        // Call API
        const response = await fetch('/api/place-label', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                coordinates: points,
                label_text: labelText,
                font_size: fontSize
            })
        });
        
        if (!response.ok) {
            throw new Error(`Server error: ${response.status}`);
        }
        
        const result = await response.json();
        
        // Hide loading
        document.getElementById('loading').style.display = 'none';
        const step = document.getElementById('loadingStep');
        if (step) step.textContent = '';
        document.getElementById('placeLabelBtn').disabled = false;
        document.getElementById('compareBtn').disabled = false;
        
        if (result.error) {
            alert('❌ Error: ' + result.error);
            return;
        }
        
        // Display results
        displayResults(result);
        
    } catch (error) {
        document.getElementById('loading').style.display = 'none';
        const step = document.getElementById('loadingStep');
        if (step) step.textContent = '';
        document.getElementById('placeLabelBtn').disabled = false;
        document.getElementById('compareBtn').disabled = false;
        alert('❌ Error connecting to server: ' + error.message);
        console.error('Error:', error);
    }
}

/**
 * Compare multiple algorithms
 */
async function compareAlgorithms() {
    if (!isRiverClosed) {
        alert('⚠️ Please close the river first by clicking "Close River"!');
        return;
    }
    
    const labelText = document.getElementById('labelText').value.trim();
    const fontSize = parseInt(document.getElementById('fontSize').value);
    
    if (!labelText) {
        alert('⚠️ Please enter a river name!');
        return;
    }
    
    if (fontSize < 12 || fontSize > 48) {
        alert('⚠️ Font size must be between 12 and 48 pt!');
        return;
    }
    
    // Show loading
    document.getElementById('loading').style.display = 'block';
    const loadingText = document.getElementById('loadingText');
    const loadingStep = document.getElementById('loadingStep');
    if (loadingText) loadingText.textContent = 'Analyzing river geometry...';
    if (loadingStep) loadingStep.textContent = '';
    document.getElementById('results').style.display = 'none';
    document.getElementById('comparisonResults').style.display = 'none';
    document.getElementById('visualizationSection').style.display = 'none';
    document.getElementById('compareBtn').disabled = true;
    document.getElementById('placeLabelBtn').disabled = true;
    
    // Simulate progress steps
    setTimeout(() => { const s = document.getElementById('loadingStep'); if (s) s.textContent = 'Step 1/3: Computing distance transform...'; }, 100);
    setTimeout(() => { const s = document.getElementById('loadingStep'); if (s) s.textContent = 'Step 2/3: Finding optimal positions...'; }, 300);
    setTimeout(() => { const s = document.getElementById('loadingStep'); if (s) s.textContent = 'Step 3/3: Comparing algorithms...'; }, 600);
    
    try {
        const response = await fetch('/api/compare-algorithms', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                coordinates: points,
                label_text: labelText,
                font_size: fontSize
            })
        });
        
        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(result.error || `Server error: ${response.status}`);
        }
        
        document.getElementById('loading').style.display = 'none';
        const step = document.getElementById('loadingStep');
        if (step) step.textContent = '';
        document.getElementById('compareBtn').disabled = false;
        document.getElementById('placeLabelBtn').disabled = false;
        
        if (result.error) {
            alert('❌ Error: ' + result.error);
            return;
        }
        
        displayComparisonResults(result);
        
    } catch (error) {
        document.getElementById('loading').style.display = 'none';
        const step = document.getElementById('loadingStep');
        if (step) step.textContent = '';
        document.getElementById('compareBtn').disabled = false;
        document.getElementById('placeLabelBtn').disabled = false;
        alert('❌ Error: ' + error.message);
        console.error('Error:', error);
    }
}

/**
 * Display single algorithm results
 * @param {Object} result - API response data
 */
function displayResults(result) {
    // Show results section
    const resultsDiv = document.getElementById('results');
    resultsDiv.style.display = 'block';
    
    // Create metrics HTML
    const html = `
        <div class="metric">
            <span class="metric-label">Optimal Position:</span>
            <span class="metric-value">(${result.optimal_x.toFixed(1)}, ${result.optimal_y.toFixed(1)})</span>
        </div>
        <div class="metric">
            <span class="metric-label">Naive Position:</span>
            <span class="metric-value">(${result.naive_x.toFixed(1)}, ${result.naive_y.toFixed(1)})</span>
        </div>
        <div class="metric">
            <span class="metric-label">Improvement:</span>
            <span class="metric-value">${result.improvement.toFixed(1)} pixels</span>
        </div>
        <div class="metric">
            <span class="metric-label">Max River Width:</span>
            <span class="metric-value">${result.max_width.toFixed(1)} pt</span>
        </div>
        <div class="metric">
            <span class="metric-label">Fits Inside:</span>
            <span class="metric-value ${result.fits_inside ? 'success' : 'warning'}">
                ${result.fits_inside ? '✓ Yes' : '⚠ No (Too Large)'}
            </span>
        </div>
    `;
    
    document.getElementById('resultContent').innerHTML = html;
    
    // Show visualization image
    if (result.image) {
        document.getElementById('visualizationSection').style.display = 'block';
        document.getElementById('visualizationSection').querySelector('h2').textContent = 
            '3. Comparison: Naive vs Optimal';
        document.getElementById('resultImage').src = 'data:image/png;base64,' + result.image;
        
        // Scroll to results
        document.getElementById('visualizationSection').scrollIntoView({ 
            behavior: 'smooth', 
            block: 'start' 
        });
    }
}

/**
 * Display algorithm comparison results
 */
function displayComparisonResults(result) {
    const resultsDiv = document.getElementById('comparisonResults');
    resultsDiv.style.display = 'block';
    
    // Create comparison table
    const html = `
        <table class="comparison-results-table">
            <thead>
                <tr>
                    <th>Algorithm</th>
                    <th>Method</th>
                    <th>Distance to Edge</th>
                    <th>Winner?</th>
                </tr>
            </thead>
            <tbody>
                <tr class="${result.winner === 'centroid' ? 'winner-row' : ''}">
                    <td><strong>Centroid (Naive)</strong></td>
                    <td>${result.centroid.method}</td>
                    <td>${result.centroid.distance_to_edge.toFixed(1)} pt</td>
                    <td>${result.winner === 'centroid' ? '⭐ Winner' : ''}</td>
                </tr>
                <tr class="${result.winner === 'distance_transform' ? 'winner-row' : ''}">
                    <td><strong>Distance Transform (Ours)</strong></td>
                    <td>${result.distance_transform.method}</td>
                    <td>${result.distance_transform.distance_to_edge.toFixed(1)} pt</td>
                    <td>${result.winner === 'distance_transform' ? '⭐ Winner' : ''}</td>
                </tr>
                <tr class="${result.winner === 'weighted' ? 'winner-row' : ''}">
                    <td><strong>Weighted Centroid</strong></td>
                    <td>${result.weighted.method}</td>
                    <td>${result.weighted.distance_to_edge.toFixed(1)} pt</td>
                    <td>${result.winner === 'weighted' ? '⭐ Winner' : ''}</td>
                </tr>
            </tbody>
        </table>
        
        <div class="winner-announcement">
            <h4>🏆 Winner: ${result[result.winner].name}</h4>
            <p>Maximum distance from edges = Safest placement!</p>
        </div>
    `;
    
    document.getElementById('comparisonContent').innerHTML = html;
    
    // Confetti celebration after results show
    setTimeout(celebrateSuccess, 500);
    
    // Show comparison image
    if (result.comparison_image) {
        document.getElementById('visualizationSection').style.display = 'block';
        document.getElementById('visualizationSection').querySelector('h2').textContent = 
            '3. Visual Comparison: All 3 Algorithms';
        document.getElementById('resultImage').src = 'data:image/png;base64,' + result.comparison_image;
        
        document.getElementById('visualizationSection').scrollIntoView({ 
            behavior: 'smooth', 
            block: 'start' 
        });
    }
}

/**
 * Download the comparison image
 */
function downloadImage() {
    const img = document.getElementById('resultImage');
    const labelText = document.getElementById('labelText').value.trim();
    
    // Create download link
    const link = document.createElement('a');
    link.download = `${labelText.toLowerCase()}_river_labeling_comparison.png`;
    link.href = img.src;
    link.click();
    
    // Show feedback
    setTimeout(() => {
        alert('✓ Image downloaded successfully!');
    }, 100);
}

/**
 * Toggle algorithm explanation
 */
function toggleAlgoInfo() {
    const algoInfo = document.getElementById('algoInfo');
    const btn = event.target;
    
    if (algoInfo.style.display === 'none') {
        algoInfo.style.display = 'block';
        btn.textContent = '📚 Hide Algorithm Explanation';
        algoInfo.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
        algoInfo.style.display = 'none';
        btn.textContent = '📚 How Does It Work? (Click to Learn)';
    }
}

/**
 * Initialize the app
 */
function init() {
    console.log('🗺️ River Labeling Tool initialized');
    console.log('Ready to draw rivers!');
}

// Run initialization when page loads
window.addEventListener('load', init);

// ========== Success Animation ==========
function celebrateSuccess() {
    const colors = ['#667eea', '#28a745', '#ffc107', '#17a2b8'];
    
    for (let i = 0; i < 50; i++) {
        setTimeout(() => {
            createConfetti();
        }, i * 30);
    }
}

function createConfetti() {
    const confetti = document.createElement('div');
    confetti.style.position = 'fixed';
    confetti.style.width = '10px';
    confetti.style.height = '10px';
    confetti.style.backgroundColor = ['#667eea', '#28a745', '#ffc107'][Math.floor(Math.random() * 3)];
    confetti.style.left = Math.random() * 100 + '%';
    confetti.style.top = '-10px';
    confetti.style.borderRadius = '50%';
    confetti.style.pointerEvents = 'none';
    confetti.style.zIndex = '9999';
    confetti.style.opacity = '0.8';
    
    document.body.appendChild(confetti);
    
    const fallDuration = 2000 + Math.random() * 1000;
    const endLeft = parseFloat(confetti.style.left) + (Math.random() - 0.5) * 100;
    
    confetti.animate([
        { top: '-10px', left: confetti.style.left },
        { top: '100vh', left: endLeft + '%', opacity: 0 }
    ], {
        duration: fallDuration,
        easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)'
    });
    
    setTimeout(() => confetti.remove(), fallDuration);
}

// ========== Keyboard Shortcuts ==========
document.addEventListener('keydown', (e) => {
    const inInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);
    
    // Space = Close River (skip when typing)
    if (!inInput && e.code === 'Space' && !isRiverClosed && points.length >= 3) {
        e.preventDefault();
        closeRiver();
    }
    
    // Enter = Compare Algorithms (skip when typing)
    if (!inInput && e.code === 'Enter' && isRiverClosed) {
        e.preventDefault();
        compareAlgorithms();
    }
    
    // Escape = Clear
    if (e.code === 'Escape') {
        e.preventDefault();
        clearCanvas();
    }
    
    // Numbers 1-3 = Load samples (skip when typing)
    if (!inInput && e.code === 'Digit1') loadSampleRiver('elbe');
    if (!inInput && e.code === 'Digit2') loadSampleRiver('rhine');
    if (!inInput && e.code === 'Digit3') loadSampleRiver('danube');
});
