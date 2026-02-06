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
    alert('✓ River closed! Now click "Place Label" to see the magic happen.');
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
    document.getElementById('visualizationSection').style.display = 'none';
}

/**
 * Call backend API to place label
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
    document.getElementById('results').style.display = 'none';
    document.getElementById('visualizationSection').style.display = 'none';
    document.getElementById('placeLabelBtn').disabled = true;
    
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
        document.getElementById('placeLabelBtn').disabled = false;
        
        if (result.error) {
            alert('❌ Error: ' + result.error);
            return;
        }
        
        // Display results
        displayResults(result);
        
    } catch (error) {
        document.getElementById('loading').style.display = 'none';
        document.getElementById('placeLabelBtn').disabled = false;
        alert('❌ Error connecting to server: ' + error.message);
        console.error('Error:', error);
    }
}

/**
 * Display results in the UI
 * @param {Object} result - API response data
 */
function displayResults(result) {
    // Show results section
    const resultsDiv = document.getElementById('results');
    resultsDiv.style.display = 'block';
    
    // Calculate improvement percentage
    const improvementPercent = result.improvement > 0 
        ? ((result.improvement / Math.max(result.optimal_x, result.optimal_y)) * 100).toFixed(1)
        : 0;
    
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
        document.getElementById('resultImage').src = 'data:image/png;base64,' + result.image;
        
        // Scroll to results
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
 * Initialize the app
 */
function init() {
    console.log('🗺️ River Labeling Tool initialized');
    console.log('Ready to draw rivers!');
}

// Run initialization when page loads
window.addEventListener('load', init);
// Toggle algorithm explanation
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
