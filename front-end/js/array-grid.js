/**
 * array-grid.js - Grid array modifier
 * Creates multiple copies of an object in a grid pattern
 */

(function() {
    'use strict';
    
    const { state } = VectorEditor;
    
    // ============================================
    // TRANSFORMATION UTILITIES
    // ============================================
    
    /**
     * Translate points by offset
     */
    function translatePoints(points, dx, dy) {
        return points.map(p => ({ x: p.x + dx, y: p.y + dy }));
    }
    
    // ============================================
    // GRID ARRAY GENERATOR
    // ============================================
    
    /**
     * Generate grid array copies
     */
    function generateGridArray(obj, params) {
        const results = [];
        const { countX, countY, offsetX, offsetY, relativeOffsetX, relativeOffsetY, useRelativeOffset } = params;
        
        // Get bounding box for relative calculations
        const bbox = VectorEditor.getBoundingBox(obj.points);
        
        // Calculate offsets
        let dx, dy;
        
        if (useRelativeOffset) {
            // Use relative offset as multiplier of object's bounding box dimensions
            dx = bbox.width * (relativeOffsetX || 0);
            dy = bbox.height * (relativeOffsetY || 0);
        } else {
            // Use absolute offset values
            dx = offsetX || 0;
            dy = offsetY || 0;
        }
        
        for (let row = 0; row < countY; row++) {
            for (let col = 0; col < countX; col++) {
                const translatedPoints = translatePoints(
                    obj.points, 
                    dx * col, 
                    dy * row
                );
                
                results.push({
                    points: translatedPoints,
                    edges: obj.edges,
                    fill: obj.fill,
                    stroke: obj.stroke,
                    strokeWidth: obj.strokeWidth
                });
            }
        }
        
        return results;
    }
    
    // ============================================
    // MODIFIER IMPLEMENTATION
    // ============================================
    
    /**
     * Create default parameters for grid array modifier
     */
    function createParams() {
        return {
            countX: 3,
            countY: 3,
            offsetX: 50,
            offsetY: 50,
            useRelativeOffset: true,
            relativeOffsetX: 1.2,
            relativeOffsetY: 1.2
        };
    }
    
    /**
     * Apply grid array modifier to object
     */
    function applyModifier(obj, params, originalObj) {
        const copies = generateGridArray(obj, params);
        
        // Return first copy as main object, store others as metadata
        const result = JSON.parse(JSON.stringify(obj));
        result.points = copies[0]?.points || obj.points;
        result.edges = copies[0]?.edges || obj.edges;
        result._arrayCopies = copies;
        
        return result;
    }
    
    /**
     * Generate UI for grid array modifier
     */
    function generateUI(params, modifier, objectId) {
        return `
            <div class="modifier-param-group">
                <label class="modifier-label">Count X</label>
                <input type="number" class="modifier-input" 
                       data-param="countX" data-modifier-id="${modifier.id}"
                       value="${params.countX}" min="1" max="50">
            </div>
            <div class="modifier-param-group">
                <label class="modifier-label">Count Y</label>
                <input type="number" class="modifier-input" 
                       data-param="countY" data-modifier-id="${modifier.id}"
                       value="${params.countY}" min="1" max="50">
            </div>
            <div class="modifier-param-group modifier-checkbox-group">
                <label class="modifier-checkbox-label">
                    <input type="checkbox" class="modifier-checkbox" 
                           data-param="useRelativeOffset" 
                           data-modifier-id="${modifier.id}"
                           ${params.useRelativeOffset ? 'checked' : ''}>
                    <span>Relative Offset</span>
                </label>
            </div>
            ${params.useRelativeOffset ? `
                <div class="modifier-param-group">
                    <label class="modifier-label">Relative X</label>
                    <input type="number" class="modifier-input" 
                           data-param="relativeOffsetX" data-modifier-id="${modifier.id}"
                           value="${params.relativeOffsetX}" min="-10" max="10" step="0.1">
                </div>
                <div class="modifier-param-group">
                    <label class="modifier-label">Relative Y</label>
                    <input type="number" class="modifier-input" 
                           data-param="relativeOffsetY" data-modifier-id="${modifier.id}"
                           value="${params.relativeOffsetY}" min="-10" max="10" step="0.1">
                </div>
            ` : `
                <div class="modifier-param-group">
                    <label class="modifier-label">Offset X</label>
                    <input type="number" class="modifier-input" 
                           data-param="offsetX" data-modifier-id="${modifier.id}"
                           value="${params.offsetX}" step="1">
                </div>
                <div class="modifier-param-group">
                    <label class="modifier-label">Offset Y</label>
                    <input type="number" class="modifier-input" 
                           data-param="offsetY" data-modifier-id="${modifier.id}"
                           value="${params.offsetY}" step="1">
                </div>
            `}
        `;
    }
    
    // ============================================
    // EXPORTS
    // ============================================
    
    window.VectorEditor = window.VectorEditor || {};
    window.VectorEditor.ArrayGrid = {
        createParams,
        applyModifier,
        generateUI,
        generateGridArray
    };
    
})();
