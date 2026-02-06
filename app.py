# app.py - Flask backend with river labeling algorithm
from flask import Flask, render_template, request, jsonify, send_file
import numpy as np
from shapely import wkt
from shapely.geometry import Polygon, Point
from scipy.ndimage import distance_transform_edt
from skimage.morphology import medial_axis
import matplotlib
matplotlib.use('Agg')  # Important for server
import matplotlib.pyplot as plt
from matplotlib.patches import Polygon as MplPolygon
import io
import base64
import json

app = Flask(__name__)

class RiverLabeler:
    """Simple river labeling using distance transform"""
    
    def __init__(self):
        self.padding = 5
    
    def place_label(self, coordinates, label_text, font_size):
        """
        Main function: Place label on river
        
        Args:
            coordinates: List of [x,y] points like [[0,0], [10,10], ...]
            label_text: Text to place
            font_size: Font size in points
        
        Returns:
            Dictionary with placement info
        """
        # Create polygon from coordinates
        if len(coordinates) < 3:
            return {"error": "Need at least 3 points"}
        
        river_poly = Polygon(coordinates)
        
        # Estimate text dimensions
        text_width = len(label_text) * font_size * 0.6
        text_height = font_size
        
        # Find optimal position
        result = self._find_widest_point(river_poly, text_width, text_height)
        
        # Add extra info
        result['text'] = label_text
        result['font_size'] = font_size
        result['polygon_coords'] = coordinates
        
        return result
    
    def _find_widest_point(self, polygon, text_width, text_height):
        """Find the widest part of the river"""
        
        # Get bounds
        minx, miny, maxx, maxy = polygon.bounds
        width = int(maxx - minx) + 20
        height = int(maxy - miny) + 20
        
        # Convert to raster
        raster = self._polygon_to_raster(polygon, width, height, minx, miny)
        
        # Distance transform
        distances = distance_transform_edt(raster)
        
        # Find maximum distance point (widest part)
        max_dist = distances.max()
        widest_idx = np.unravel_index(distances.argmax(), distances.shape)
        
        # Convert back to original coordinates
        optimal_x = widest_idx[1] + minx
        optimal_y = widest_idx[0] + miny
        
        # Naive centroid for comparison
        centroid = polygon.centroid
        naive_x, naive_y = centroid.x, centroid.y
        
        # Check if text fits
        fits = max_dist * 2 >= max(text_width, text_height) + self.padding
        
        return {
            'optimal_x': float(optimal_x),
            'optimal_y': float(optimal_y),
            'naive_x': float(naive_x),
            'naive_y': float(naive_y),
            'fits_inside': bool(fits),
            'max_width': float(max_dist * 2),
            'improvement': float(np.sqrt((optimal_x-naive_x)**2 + (optimal_y-naive_y)**2))
        }
    
    def _polygon_to_raster(self, polygon, width, height, offset_x, offset_y):
        """Convert polygon to binary raster"""
        from matplotlib.path import Path
        
        raster = np.zeros((height, width), dtype=bool)
        coords = np.array(polygon.exterior.coords)
        coords[:, 0] -= offset_x
        coords[:, 1] -= offset_y
        
        y, x = np.mgrid[:height, :width]
        points = np.vstack((x.flatten(), y.flatten())).T
        path = Path(coords)
        mask = path.contains_points(points)
        
        return mask.reshape(height, width)
    
    def create_visualization(self, result):
        """Create before/after comparison image"""
        
        coords = result['polygon_coords']
        polygon = Polygon(coords)
        
        # Create figure with 2 subplots
        fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 6))
        
        # Plot 1: Naive (centroid)
        self._plot_method(ax1, polygon, result['naive_x'], result['naive_y'],
                         result['text'], result['font_size'], "Naive (Centroid)", 'red')
        
        # Plot 2: Optimal (our method)
        self._plot_method(ax2, polygon, result['optimal_x'], result['optimal_y'],
                         result['text'], result['font_size'], "Optimal (Distance Transform)", 'green')
        
        plt.tight_layout()
        
        # Convert to base64 for web display
        buf = io.BytesIO()
        plt.savefig(buf, format='png', dpi=100, bbox_inches='tight')
        buf.seek(0)
        img_base64 = base64.b64encode(buf.read()).decode('utf-8')
        plt.close()
        
        return img_base64
    
    def _plot_method(self, ax, polygon, x, y, text, font_size, title, color):
        """Helper to plot one method"""
        # Draw polygon
        xs, ys = polygon.exterior.xy
        ax.fill(xs, ys, color='lightblue', edgecolor='blue', linewidth=2)
        
        # Draw label
        ax.text(x, y, text, fontsize=font_size, ha='center', va='center',
               color=color, fontweight='bold',
               bbox=dict(boxstyle='round', facecolor='yellow', alpha=0.8))
        
        # Draw point
        ax.plot(x, y, 'o', color=color, markersize=8)
        
        ax.set_title(title, fontsize=14, fontweight='bold')
        ax.set_aspect('equal')
        ax.axis('off')

# Initialize labeler
labeler = RiverLabeler()

@app.route('/')
def index():
    """Serve the main page"""
    return render_template('index.html')

@app.route('/api/place-label', methods=['POST'])
def place_label_api():
    """API endpoint for label placement"""
    try:
        data = request.json
        
        # Extract data
        coordinates = data.get('coordinates', [])
        label_text = data.get('label_text', 'RIVER')
        font_size = int(data.get('font_size', 24))
        
        # Process
        result = labeler.place_label(coordinates, label_text, font_size)
        
        # Create visualization
        if 'error' not in result:
            result['image'] = labeler.create_visualization(result)
        
        return jsonify(result)
    
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/health')
def health():
    """Health check endpoint"""
    return jsonify({'status': 'ok'})

if __name__ == '__main__':
    print("="*60)
    print("🗺️  RIVER LABELING APP STARTING")
    print("="*60)
    print("Open your browser and go to: http://localhost:5000")
    print("="*60)
    app.run(debug=True, port=5000)
