/**
 * modifier-bool.js - Boolean modifier
 * Performs boolean operations between objects (union, difference, intersection)
 * Uses extracted operation modules: bool-diff.js, bool-intersect.js, bool-union.js, bool-xor.js
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
     * Approximate boolean operation result
     * This creates a visual approximation for demonstration
     */
    function approximateBooleanOp(subjectPolygon, clipPolygon, operation) {
        let resultPoints = [];
        
        switch (operation) {
            case 'union':
                // Use extracted BoolUnion module
                resultPoints = VectorEditor.BoolUnion.applyUnion(subjectPolygon, clipPolygon);
                break;
                
            case 'difference':
                // Use extracted BoolDiff module
                resultPoints = VectorEditor.BoolDiff.applyDifference(subjectPolygon, clipPolygon);
                break;
                
            case 'intersection':
                // Use extracted BoolIntersect module
                resultPoints = VectorEditor.BoolIntersect.applyIntersection(subjectPolygon, clipPolygon);
                break;
                
            case 'xor':
                // Use extracted BoolXOR module
                resultPoints = VectorEditor.BoolXOR.applyXOR(subjectPolygon, clipPolygon);
                break;
        }
        
        return resultPoints;
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
