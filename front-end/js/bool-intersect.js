/**
 * bool-intersect.js - Boolean Intersection operation
 * Keeps only the overlapping area between two shapes
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
    
    /**
     * Cross product for three points
     */
    function crossProduct(o, a, b) {
        return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
    }
    
    /**
     * Create convex hull from points (Graham scan)
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
    // INTERSECTION OPERATION
    // ============================================
    
    /**
     * Create intersection shape
     * Returns only the overlapping area between subject and clip
     */
    function createIntersectionShape(subject, clip) {
        const inside = subject.filter(p => pointInPolygon(p, clip));
        const clipInside = clip.filter(p => pointInPolygon(p, subject));
        const intersections = findPolygonIntersections(subject, clip);
        
        const allPoints = [...inside, ...clipInside, ...intersections];
        
        if (allPoints.length < 3) {
            return null;
        }
        
        return createConvexHull(allPoints);
    }
    
    /**
     * Apply intersection operation
     * @param {Array} subjectPoints - Points of the subject polygon
     * @param {Array} clipPoints - Points of the clip polygon
     * @returns {Array|null} Resulting polygon points or null if no overlap
     */
    function applyIntersection(subjectPoints, clipPoints) {
        return createIntersectionShape(subjectPoints, clipPoints);
    }
    
    // ============================================
    // EXPORTS
    // ============================================
    
    window.VectorEditor = window.VectorEditor || {};
    window.VectorEditor.BoolIntersect = {
        createIntersectionShape,
        applyIntersection,
        pointInPolygon,
        lineIntersection,
        findPolygonIntersections,
        createConvexHull,
        crossProduct
    };
    
})();