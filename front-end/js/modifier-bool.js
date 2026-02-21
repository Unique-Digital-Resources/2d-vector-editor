/**
 * modifier-bool.js - Boolean modifier
 * Performs boolean operations between objects (union, difference, intersection)
 */

(function() {
    'use strict';
    
    const { state } = VectorEditor;
    
    // ============================================
    // BOOLEAN OPERATION TYPES
    // ============================================
    
    const BOOLEAN_OPERATIONS = {
        'union': { name: 'Union', icon: 'mdi-vector-union', description: 'Combine shapes' },
        'difference': { name: 'Difference', icon: 'mdi-vector-difference', description: 'Subtract from shape' },
        'intersection': { name: 'Intersection', icon: 'mdi-vector-intersection', description: 'Common area only' },
        'xor': { name: 'XOR', icon: 'mdi-vector-combine', description: 'Exclude overlap' }
    };
    
    // ============================================
    // GEOMETRY UTILITIES FOR BOOLEAN OPS
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
     * Get polygon edges as line segments
     */
    function getPolygonEdges(points, edges) {
        if (!edges) {
            // Default: connect points sequentially
            const result = [];
            for (let i = 0; i < points.length; i++) {
                result.push([points[i], points[(i + 1) % points.length]]);
            }
            return result;
        }
        
        return edges.map(edge => [
            points[edge.points[0]],
            points[edge.points[1]]
        ]);
    }
    
    /**
     * Simple polygon clipping (Sutherland-Hodgman style)
     * This is a simplified implementation for demonstration
     */
    function clipPolygon(subjectPolygon, clipPolygon, operation) {
        // For a full implementation, you would use a library like Paper.js or Clipper
        // This is a simplified version that handles basic cases
        
        if (!subjectPolygon || subjectPolygon.length < 3 || !clipPolygon || clipPolygon.length < 3) {
            return subjectPolygon;
        }
        
        // Simple bounding box check
        const subjectBbox = getPolygonBounds(subjectPolygon);
        const clipBbox = getPolygonBounds(clipPolygon);
        
        // Check if polygons overlap
        const overlaps = !(subjectBbox.maxX < clipBbox.minX || 
                          subjectBbox.minX > clipBbox.maxX ||
                          subjectBbox.maxY < clipBbox.minY || 
                          subjectBbox.minY > clipBbox.maxY);
        
        if (!overlaps) {
            switch (operation) {
                case 'union':
                    return subjectPolygon; // No overlap, return original
                case 'difference':
                    return subjectPolygon; // No overlap, nothing to subtract
                case 'intersection':
                    return null; // No overlap, no intersection
                case 'xor':
                    return subjectPolygon; // No overlap, return original
            }
        }
        
        // For demonstration, return a merged/approximated result
        // In production, use a proper polygon clipping library
        return approximateBooleanOp(subjectPolygon, clipPolygon, operation);
    }
    
    /**
     * Get bounding box of polygon
     */
    function getPolygonBounds(points) {
        const xs = points.map(p => p.x);
        const ys = points.map(p => p.y);
        return {
            minX: Math.min(...xs),
            maxX: Math.max(...xs),
            minY: Math.min(...ys),
            maxY: Math.max(...ys)
        };
    }
    
    /**
     * Approximate boolean operation result
     * This creates a visual approximation for demonstration
     */
    function approximateBooleanOp(subjectPolygon, clipPolygon, operation) {
        const subjectBounds = getPolygonBounds(subjectPolygon);
        const clipBounds = getPolygonBounds(clipPolygon);
        
        // Create result points based on operation type
        let resultPoints = [];
        
        switch (operation) {
            case 'union':
                // Union: combine bounds and create convex hull approximation
                resultPoints = createConvexHull([...subjectPolygon, ...clipPolygon]);
                break;
                
            case 'difference':
                // Difference: keep subject but mark clipped area
                resultPoints = subjectPolygon.filter(p => !pointInPolygon(p, clipPolygon));
                if (resultPoints.length < 3) {
                    // If all points are inside clip polygon, return empty
                    return null;
                }
                // Add intersection points
                resultPoints = createDifferenceShape(subjectPolygon, clipPolygon);
                break;
                
            case 'intersection':
                // Intersection: keep only overlapping area
                resultPoints = subjectPolygon.filter(p => pointInPolygon(p, clipPolygon));
                if (resultPoints.length < 3) {
                    // Try the other way
                    resultPoints = clipPolygon.filter(p => pointInPolygon(p, subjectPolygon));
                }
                if (resultPoints.length < 3) {
                    return null;
                }
                resultPoints = createIntersectionShape(subjectPolygon, clipPolygon);
                break;
                
            case 'xor':
                // XOR: combine but exclude overlap
                resultPoints = createXORShape(subjectPolygon, clipPolygon);
                break;
        }
        
        return resultPoints;
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
    
    /**
     * Cross product for three points
     */
    function crossProduct(o, a, b) {
        return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
    }
    
    /**
     * Create difference shape (subject - clip)
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
     * Create intersection shape
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
     * Create XOR shape
     */
    function createXORShape(subject, clip) {
        const subjectOnly = subject.filter(p => !pointInPolygon(p, clip));
        const clipOnly = clip.filter(p => !pointInPolygon(p, subject));
        
        return [...subjectOnly, ...clipOnly];
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
    // MODIFIER IMPLEMENTATION
    // ============================================
    
    /**
     * Create default parameters for boolean modifier
     */
    function createParams() {
        return {
            operation: 'difference',
            targetObjectId: null,
            showTarget: false
        };
    }
    
    /**
     * Apply boolean modifier to object
     */
    function applyModifier(obj, params, originalObj) {
        if (!params.targetObjectId) {
            return obj;
        }
        
        const targetObj = state.objects.find(o => o.id === params.targetObjectId);
        if (!targetObj) {
            return obj;
        }
        
        // Get points as simple polygons
        const subjectPoints = obj.points;
        const targetPoints = targetObj.points;
        
        // Perform boolean operation
        const resultPoints = clipPolygon(subjectPoints, targetPoints, params.operation);
        
        if (!resultPoints || resultPoints.length < 3) {
            // Return original if operation fails
            return obj;
        }
        
        // Create result object
        const result = JSON.parse(JSON.stringify(obj));
        result.points = resultPoints;
        
        // Generate new edges for the result
        result.edges = [];
        for (let i = 0; i < resultPoints.length; i++) {
            result.edges.push({ points: [i, (i + 1) % resultPoints.length] });
        }
        
        return result;
    }
    
    /**
     * Generate UI for boolean modifier
     */
    function generateUI(params, modifier, objectId) {
        const objects = state.objects.filter(o => o.id !== objectId);
        
        return `
            <div class="modifier-param-group">
                <label class="modifier-label">Operation</label>
                <select class="modifier-select" data-param="operation" data-modifier-id="${modifier.id}">
                    ${Object.entries(BOOLEAN_OPERATIONS).map(([key, op]) => `
                        <option value="${key}" ${params.operation === key ? 'selected' : ''}>
                            ${op.name}
                        </option>
                    `).join('')}
                </select>
            </div>
            <div class="modifier-param-group">
                <label class="modifier-label">Target Object</label>
                <select class="modifier-select" data-param="targetObjectId" data-modifier-id="${modifier.id}">
                    <option value="">-- Select Object --</option>
                    ${objects.map(o => `
                        <option value="${o.id}" ${params.targetObjectId === o.id ? 'selected' : ''}>
                            ${o.name || o.type} (${o.id})
                        </option>
                    `).join('')}
                </select>
            </div>
            <div class="modifier-param-group modifier-checkbox-group">
                <label class="modifier-checkbox-label">
                    <input type="checkbox" class="modifier-checkbox" 
                           data-param="showTarget" 
                           data-modifier-id="${modifier.id}"
                           ${params.showTarget ? 'checked' : ''}>
                    <span>Show target object</span>
                </label>
            </div>
            <div class="modifier-info">
                <i class="mdi mdi-information-outline"></i>
                <span>${BOOLEAN_OPERATIONS[params.operation]?.description || ''}</span>
            </div>
        `;
    }
    
    // ============================================
    // REGISTER MODIFIER
    // ============================================
    
    VectorEditor.Modifiers.registerModifier('boolean', {
        name: 'Boolean',
        icon: 'mdi-vector-difference-ba',
        create: createParams,
        apply: applyModifier,
        ui: generateUI
    });
    
    // ============================================
    // EVENT HANDLERS FOR UI
    // ============================================
    
    document.addEventListener('change', (e) => {
        if (e.target.classList.contains('modifier-select') || 
            e.target.classList.contains('modifier-checkbox')) {
            
            const param = e.target.dataset.param;
            const modifierId = e.target.dataset.modifierId;
            const objectId = VectorEditor.state.selectedObjectId;
            
            if (param && modifierId && objectId) {
                const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
                VectorEditor.Modifiers.updateModifierParams(objectId, modifierId, { [param]: value });
            }
        }
    });
    
})();
