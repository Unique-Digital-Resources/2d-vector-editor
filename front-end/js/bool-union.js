/**
 * bool-union.js - Boolean Union operation
 * Combines two shapes into one
 */

(function() {
    'use strict';
    
    // ============================================
    // GEOMETRY UTILITIES
    // ============================================
    
    /**
     * Cross product for three points
     */
    function crossProduct(o, a, b) {
        return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
    }
    
    /**
     * Create convex hull from points (Graham scan)
     * Used to create the union shape from combined points
     */
    function createConvexHull(points) {
        if (points.length < 3) return points;
        
        // Find lowest point
        let lowest = 0;
        for (let i = 1; i < points.length; i++) {
            if (points[i].y > points[lowest].y || 
                (points[i].y === points[lowest].y && points[i].x < points[lowest].x)) {
                lowest = i;
            }
        }
        
        // Swap to first position
        [points[0], points[lowest]] = [points[lowest], points[0]];
        const pivot = points[0];
        
        // Sort by polar angle
        const sorted = points.slice(1).sort((a, b) => {
            const angleA = Math.atan2(a.y - pivot.y, a.x - pivot.x);
            const angleB = Math.atan2(b.y - pivot.y, b.x - pivot.x);
            return angleA - angleB;
        });
        
        // Build hull
        const hull = [pivot, sorted[0]];
        for (let i = 1; i < sorted.length; i++) {
            while (hull.length > 1 && crossProduct(
                hull[hull.length - 2], 
                hull[hull.length - 1], 
                sorted[i]
            ) <= 0) {
                hull.pop();
            }
            hull.push(sorted[i]);
        }
        
        return hull;
    }
    
    // ============================================
    // UNION OPERATION
    // ============================================
    
    /**
     * Create union shape
     * Combines subject and clip polygons into one shape
     */
    function createUnionShape(subject, clip) {
        // Union: combine bounds and create convex hull approximation
        return createConvexHull([...subject, ...clip]);
    }
    
    /**
     * Apply union operation
     * @param {Array} subjectPoints - Points of the subject polygon
     * @param {Array} clipPoints - Points of the clip polygon
     * @returns {Array} Resulting polygon points
     */
    function applyUnion(subjectPoints, clipPoints) {
        return createUnionShape(subjectPoints, clipPoints);
    }
    
    // ============================================
    // EXPORTS
    // ============================================
    
    window.VectorEditor = window.VectorEditor || {};
    window.VectorEditor.BoolUnion = {
        createUnionShape,
        applyUnion,
        createConvexHull,
        crossProduct
    };
    
})();