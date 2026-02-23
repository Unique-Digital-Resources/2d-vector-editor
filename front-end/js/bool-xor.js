/**
 * bool-xor.js - Boolean XOR operation
 * Combines shapes but excludes the overlapping area
 */

(function() {
    'use strict';
    
    // ============================================
    // GEOMETRY UTILITIES
    // ============================================
    
    /**
     * Check if a point is inside a polygon using ray casting
     */
    function pointInPolygon(point, polygon) {
        if (!polygon || polygon.length < 3) return false;
        
        let inside = false;
        const n = polygon.length;
        
        for (let i = 0, j = n - 1; i < n; j = i++) {
            const xi = polygon[i].x, yi = polygon[i].y;
            const xj = polygon[j].x, yj = polygon[j].y;
            
            if (((yi > point.y) !== (yj > point.y)) &&
                (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi)) {
                inside = !inside;
            }
        }
        
        return inside;
    }
    
    // ============================================
    // XOR OPERATION
    // ============================================
    
    /**
     * Create XOR shape
     * Returns points that are in either subject or clip, but not in both
     */
    function createXORShape(subject, clip) {
        const subjectOnly = subject.filter(p => !pointInPolygon(p, clip));
        const clipOnly = clip.filter(p => !pointInPolygon(p, subject));
        
        return [...subjectOnly, ...clipOnly];
    }
    
    /**
     * Apply XOR operation
     * @param {Array} subjectPoints - Points of the subject polygon
     * @param {Array} clipPoints - Points of the clip polygon
     * @returns {Array} Resulting polygon points
     */
    function applyXOR(subjectPoints, clipPoints) {
        return createXORShape(subjectPoints, clipPoints);
    }
    
    // ============================================
    // EXPORTS
    // ============================================
    
    window.VectorEditor = window.VectorEditor || {};
    window.VectorEditor.BoolXOR = {
        createXORShape,
        applyXOR,
        pointInPolygon
    };
    
})();