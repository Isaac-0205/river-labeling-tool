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

# Add this after your existing RiverLabeler class

class MultiAlgorithmLabeler:
    """
    Compare multiple label placement algorithms
    """
    
    def compare_algorithms(self, coordinates, label_text, font_size):
        """
        Run all algorithms and compare results
        """
        polygon = Polygon(coordinates)
        text_width = len(label_text) * font_size * 0.6
        text_height = font_size
        
        results = {
            'text': label_text,
            'font_size': font_size,
            'polygon_coords': coordinates
        }
        
        # Algorithm 1: Naive Centroid
        centroid = polygon.centroid
        results['centroid'] = {
            'name': 'Centroid (Naive)',
            'x': float(centroid.x),
            'y': float(centroid.y),
            'distance_to_edge': float(polygon.boundary.distance(centroid)),
            'method': 'Geometric center only'
        }
        
        # Algorithm 2: Distance Transform (your existing method)
        labeler = RiverLabeler()
        dt_result = labeler._find_widest_point(polygon, text_width, text_height)
        results['distance_transform'] = {
            'name': 'Distance Transform (Ours)',
            'x': dt_result['optimal_x'],
            'y': dt_result['optimal_y'],
            'distance_to_edge': float(dt_result['max_width']) / 2,
            'method': 'Maximum distance from all edges'
        }
        
        # Algorithm 3: Weighted Centroid (bonus - quick implementation)
        # Find centroid of points with distance > threshold
        minx, miny, maxx, maxy = polygon.bounds
        width = int(maxx - minx) + 20
        height = int(maxy - miny) + 20
        
        raster = labeler._polygon_to_raster(polygon, width, height, minx, miny)
        distances = distance_transform_edt(raster)
        
        # Find all points with distance > 50th percentile (guard empty interior)
        interior = distances[distances > 0]
        if len(interior) > 0:
            threshold = np.percentile(interior, 50)
            good_points = np.argwhere(distances > threshold)
        else:
            good_points = np.array([])
        
        if len(good_points) > 0:
            weighted_y = good_points[:, 0].mean() + miny
            weighted_x = good_points[:, 1].mean() + minx
        else:
            weighted_y = centroid.y
            weighted_x = centroid.x
        
        weighted_point = Point(weighted_x, weighted_y)
        results['weighted'] = {
            'name': 'Weighted Centroid',
            'x': float(weighted_x),
            'y': float(weighted_y),
            'distance_to_edge': float(polygon.boundary.distance(weighted_point)),
            'method': 'Average of safe interior points'
        }
        
        # Calculate winner
        winner = max(
            ['centroid', 'distance_transform', 'weighted'],
            key=lambda k: results[k]['distance_to_edge']
        )
        results['winner'] = winner
        
        # Create comparison visualization
        results['comparison_image'] = self._create_comparison_viz(polygon, results)
        
        return results
    
    def _create_comparison_viz(self, polygon, results):
        """Create 3-panel comparison visualization"""
        fig, axes = plt.subplots(1, 3, figsize=(18, 5))
        
        methods = ['centroid', 'distance_transform', 'weighted']
        colors = ['red', 'green', 'blue']
        
        for idx, (method, color) in enumerate(zip(methods, colors)):
            ax = axes[idx]
            data = results[method]
            
            # Draw polygon
            xs, ys = polygon.exterior.xy
            ax.fill(xs, ys, color='lightblue', edgecolor='blue', linewidth=2, alpha=0.5)
            
            # Draw label
            winner_marker = '⭐ ' if results['winner'] == method else ''
            ax.text(data['x'], data['y'], results['text'],
                   fontsize=results['font_size'], ha='center', va='center',
                   color=color, fontweight='bold',
                   bbox=dict(boxstyle='round', facecolor='yellow', alpha=0.8))
            
            # Draw point
            ax.plot(data['x'], data['y'], 'o', color=color, markersize=10)
            
            # Title with distance
            ax.set_title(f"{winner_marker}{data['name']}\n"
                        f"Edge Distance: {data['distance_to_edge']:.1f}pt",
                        fontsize=12, fontweight='bold')
            ax.set_aspect('equal')
            ax.axis('off')
        
        plt.suptitle('Algorithm Comparison: Which Places Label Better?',
                    fontsize=16, fontweight='bold', y=0.98)
        plt.tight_layout()
        
        # Convert to base64
        buf = io.BytesIO()
        plt.savefig(buf, format='png', dpi=120, bbox_inches='tight')
        buf.seek(0)
        img_base64 = base64.b64encode(buf.read()).decode('utf-8')
        plt.close()
        
        return img_base64

# Initialize multi-algorithm labeler
multi_labeler = MultiAlgorithmLabeler()

# Add new API endpoint (POST for comparison; GET so the route is clearly registered)
@app.route('/api/compare-algorithms', methods=['GET', 'POST'])
def compare_algorithms_api():
    """API endpoint for algorithm comparison. Use POST with JSON body."""
    if request.method == 'GET':
        return jsonify({
            'message': 'Use POST with JSON: coordinates, label_text, font_size',
            'example': {'coordinates': [[0, 0], [100, 50], [200, 0]], 'label_text': 'RIVER', 'font_size': 24}
        })
    try:
        data = request.json or {}
        coordinates = data.get('coordinates', [])
        # Normalize: accept [{x,y}] from frontend or [[x,y]], ensure numbers
        if not coordinates:
            return jsonify({'error': 'No coordinates provided.'}), 400
        if isinstance(coordinates[0], dict):
            coordinates = [[float(p['x']), float(p['y'])] for p in coordinates]
        else:
            coordinates = [[float(p[0]), float(p[1])] for p in coordinates]
        label_text = (data.get('label_text') or 'RIVER').strip() or 'RIVER'
        font_size = int(data.get('font_size', 24))
        if font_size < 1 or font_size > 200:
            font_size = 24
        if len(coordinates) < 3:
            return jsonify({'error': 'Need at least 3 points to form a river polygon.'}), 400
        
        # Compare algorithms
        results = multi_labeler.compare_algorithms(coordinates, label_text, font_size)
        
        return jsonify(results)
    
    except Exception as e:
        return jsonify({'error': str(e)}), 400

print("Registered routes:")
for rule in app.url_map.iter_rules():
    print(rule)

if __name__ == '__main__':
    print("="*60)
    print("RIVER LABELING APP STARTING")
    print("="*60)
    print("Open your browser and go to: http://localhost:5000")
    print("="*60)
    app.run(debug=True, port=5000)