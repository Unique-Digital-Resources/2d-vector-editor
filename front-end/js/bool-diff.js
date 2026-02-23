/**
 * bool-diff.js - Boolean Difference operation
 * Subtracts one shape from another
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
    
    /**
     * Find intersection point of two line segments
     */
    function lineIntersection(p1, p2, p3, p4) {
        const d1 = (p1.x - p2.x) * (p3.y - p4.y) - (p1.y - p2.y) * (p3.x - p4.x);
        const d2 = (p1.x - p2.x) * (p3.y - p4.y) - (p1.y - p2.y) * (p3.x - p4.x);
        
        if (Math.abs(d1) < 0.0001) return null;
        
        const t = ((p1.x - p3.x) * (p3.y - p4.y) - (p1.y - p3.y) * (p3.x - p4.x)) / d1;
        const u = -((p1.x - p2.x) * (p1.y - p3.y) - (p1.y - p2.y) * (p1.x - p3.x)) / d2;
        
        if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
            return {
                x: p1.x + t * (p2.x - p1.x),
                y: p1.y + t * (p2.y - p1.y)
            };
        }
        
        return null;
    }
    
    /**
     * Find intersection points between two polygons
     */
    function findPolygonIntersections(poly1, poly2) {
        const intersections = [];
        
        for (let i = 0; i < poly1.length; i++) {
            const p1 = poly1[i];
            const p2 = poly1[(i + 1) % poly1.length];
            
            for (let j = 0; j < poly2.length; j++) {
                const p3 = poly2[j];
                const p4 = poly2[(j + 1) % poly2.length];
                
                const intersection = lineIntersection(p1, p2, p3, p4);
                if (intersection) {
                    intersections.push(intersection);
                }
            }
        }
        
        return intersections;
    }
    
    // ============================================
    // DIFFERENCE OPERATION
    // ============================================
    
    /**
     * Create difference shape (subject - clip)
     * Subtracts the clip polygon from the subject polygon
     */
    function createDifferenceShape(subject, clip) {
        // Simplified: return subject points outside clip
        const outside = subject.filter(p => !pointInPolygon(p, clip));
        const intersections = findPolygonIntersections(subject, clip);
        
        if (outside.length + intersections.length < 3) {
            return null;
        }
        
        return [...outside, ...intersections];
    }
    
    /**
     * Apply difference operation
     * @param {Array} subjectPoints - Points of the subject polygon
     * @param {Array} clipPoints - Points of the clip polygon (to subtract)
     * @returns {Array|null} Resulting polygon points or null if empty
     */
    function applyDifference(subjectPoints, clipPoints) {
        return createDifferenceShape(subjectPoints, clipPoints);
    }
    
    // ============================================
    // EXPORTS
    // ============================================
    
    window.VectorEditor = window.VectorEditor || {};
    window.VectorEditor.BoolDiff = {
        createDifferenceShape,
        applyDifference,
        pointInPolygon,
        lineIntersection,
        findPolygonIntersections
    };
    
})();
