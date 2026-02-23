/**
 * array-radial.js - Radial array modifier
 * Creates multiple copies of an object in a circular pattern
 */

(function() {
    'use strict';
    
    const { state } = VectorEditor;
    
    // ============================================
    // TRANSFORMATION UTILITIES
    // ============================================
    
    /**
     * Rotate points around a center
     */
    function rotatePoints(points, centerX, centerY, angleRad) {
        const cos = Math.cos(angleRad);
        const sin = Math.sin(angleRad);
        
        return points.map(p => {
            const dx = p.x - centerX;
            const dy = p.y - centerY;
            return {
                x: centerX + dx * cos - dy * sin,
                y: centerY + dx * sin + dy * cos
            };
        });
    }
    
    /**
     * Get bounding box center
     */
    function getBBoxCenter(points) {
        const xs = points.map(p => p.x);
        const ys = points.map(p => p.y);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
        return { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
    }
    
    // ============================================
    // RADIAL ARRAY GENERATOR
    // ============================================
    
    /**
     * Generate radial array copies
     */
    function generateRadialArray(obj, params) {
        const results = [];
        const { count, angle, centerOnObject, centerX, centerY } = params;
        
        // Determine center point
        let center;
        if (centerOnObject) {
            center = getBBoxCenter(obj.points);
        } else {
            center = { x: centerX, y: centerY };
        }
        
        const angleStep = (angle * Math.PI) / 180 / Math.max(1, count - 1 || 1);
        
        for (let i = 0; i < count; i++) {
            const rotation = i === 0 && count > 1 ? 0 : angleStep * i;
            const rotatedPoints = rotatePoints(obj.points, center.x, center.y, rotation);
            
            results.push({
                points: rotatedPoints,
                edges: obj.edges,
                fill: obj.fill,
                stroke: obj.stroke,
                strokeWidth: obj.strokeWidth
            });
        }
        
        return results;
    }
    
    // ============================================
    // MODIFIER IMPLEMENTATION
    // ============================================
    
    /**
     * Create default parameters for radial array modifier
     */
    function createParams() {
        return {
            count: 3,
            angle: 360,
            centerOnObject: true,
            centerX: 0,
            centerY: 0
        };
    }
    
    /**
     * Apply radial array modifier to object
     */
    function applyModifier(obj, params, originalObj) {
        const copies = generateRadialArray(obj, params);
        
        // Return first copy as main object, store others as metadata
        const result = JSON.parse(JSON.stringify(obj));
        result.points = copies[0]?.points || obj.points;
        result.edges = copies[0]?.edges || obj.edges;
        result._arrayCopies = copies;
        
        return result;
    }
    
    /**
     * Generate UI for radial array modifier
     */
    function generateUI(params, modifier, objectId) {
        return `
            <div class="modifier-param-group">
                <label class="modifier-label">Count</label>
                <input type="number" class="modifier-input" 
                       data-param="count" data-modifier-id="${modifier.id}"
                       value="${params.count}" min="1" max="100">
            </div>
            <div class="modifier-param-group">
                <label class="modifier-label">Total Angle (°)</label>
                <input type="number" class="modifier-input" 
                       data-param="angle" data-modifier-id="${modifier.id}"
                       value="${params.angle}" min="0" max="360">
            </div>
            <div class="modifier-param-group modifier-checkbox-group">
                <label class="modifier-checkbox-label">
                    <input type="checkbox" class="modifier-checkbox" 
                           data-param="centerOnObject" 
                           data-modifier-id="${modifier.id}"
                           ${params.centerOnObject ? 'checked' : ''}>
                    <span>Center on Object</span>
                </label>
            </div>
            ${!params.centerOnObject ? `
                <div class="modifier-param-group">
                    <label class="modifier-label">Center X</label>
                    <input type="number" class="modifier-input" 
                           data-param="centerX" data-modifier-id="${modifier.id}"
                           value="${params.centerX}">
                </div>
                <div class="modifier-param-group">
                    <label class="modifier-label">Center Y</label>
                    <input type="number" class="modifier-input" 
                           data-param="centerY" data-modifier-id="${modifier.id}"
                           value="${params.centerY}">
                </div>
            ` : ''}
            <div class="modifier-info">
                <i class="mdi mdi-information-outline"></i>
                <span>Copies in a circle</span>
            </div>
        `;
    }
    
    // ============================================
    // EXPORTS
    // ============================================
    
    window.VectorEditor = window.VectorEditor || {};
    window.VectorEditor.ArrayRadial = {
        createParams,
        applyModifier,
        generateUI,
        generateRadialArray
    };
    
})();
