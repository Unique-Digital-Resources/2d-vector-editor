/**
 * modifier-array.js - Array modifier
 * Creates multiple copies of an object in patterns (linear, radial, grid)
 */

(function() {
    'use strict';
    
    const { state } = VectorEditor;
    
    // ============================================
    // ARRAY PATTERN TYPES
    // ============================================
    
    const ARRAY_TYPES = {
        'linear': { name: 'Linear', icon: 'mdi-format-align-justify', description: 'Copies in a line' },
        'radial': { name: 'Radial', icon: 'mdi-rotate-3d-variant', description: 'Copies in a circle' },
        'grid': { name: 'Grid', icon: 'mdi-view-grid', description: 'Copies in a grid' }
    };
    
    // ============================================
    // TRANSFORMATION UTILITIES
    // ============================================
    
    /**
     * Translate points by offset
     */
    function translatePoints(points, dx, dy) {
        return points.map(p => ({ x: p.x + dx, y: p.y + dy }));
    }
    
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
     * Scale points around a center
     */
    function scalePoints(points, centerX, centerY, scaleX, scaleY) {
        return points.map(p => ({
            x: centerX + (p.x - centerX) * scaleX,
            y: centerY + (p.y - centerY) * scaleY
        }));
    }
    
    /**
     * Get center of points
     */
    function getCenter(points) {
        if (!points || points.length === 0) return { x: 0, y: 0 };
        const sum = points.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
        return { x: sum.x / points.length, y: sum.y / points.length };
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
    // ARRAY GENERATORS
    // ============================================
    
    /**
     * Generate linear array copies
     */
    function generateLinearArray(obj, params) {
        const results = [];
        const { count, offsetX, offsetY, relativeOffset, useRelativeOffset } = params;
        
        // Calculate offset
        let dx = offsetX;
        let dy = offsetY;
        
        if (useRelativeOffset && relativeOffset > 0) {
            // Use bounding box size for relative offset
            const bbox = VectorEditor.getBoundingBox(obj.points);
            dx = bbox.width * relativeOffset;
            dy = bbox.height * relativeOffset;
        }
        
        for (let i = 0; i < count; i++) {
            const translatedPoints = translatePoints(obj.points, dx * i, dy * i);
            results.push({
                points: translatedPoints,
                edges: obj.edges,
                fill: obj.fill,
                stroke: obj.stroke,
                strokeWidth: obj.strokeWidth
            });
        }
        
        return results;
    }
    
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
    
    /**
     * Generate grid array copies
     */
    function generateGridArray(obj, params) {
        const results = [];
        const { countX, countY, offsetX, offsetY, relativeOffset, useRelativeOffset } = params;
        
        // Calculate offsets
        let dx = offsetX;
        let dy = offsetY;
        
        if (useRelativeOffset && relativeOffset > 0) {
            const bbox = VectorEditor.getBoundingBox(obj.points);
            dx = bbox.width * relativeOffset;
            dy = bbox.height * relativeOffset;
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
     * Create default parameters for array modifier
     */
    function createParams() {
        return {
            arrayType: 'linear',
            
            // Linear settings
            count: 3,
            offsetX: 50,
            offsetY: 0,
            useRelativeOffset: true,
            relativeOffset: 1.2,
            
            // Radial settings
            angle: 360,
            centerOnObject: true,
            centerX: 0,
            centerY: 0,
            
            // Grid settings
            countX: 3,
            countY: 3,
            
            // General
            mergeResults: false
        };
    }
    
    /**
     * Apply array modifier to object
     */
    function applyModifier(obj, params, originalObj) {
        let copies = [];
        
        switch (params.arrayType) {
            case 'linear':
                copies = generateLinearArray(obj, params);
                break;
            case 'radial':
                copies = generateRadialArray(obj, params);
                break;
            case 'grid':
                copies = generateGridArray(obj, params);
                break;
            default:
                copies = [obj];
        }
        
        if (params.mergeResults && copies.length > 1) {
            // Merge all copies into a single object
            const mergedPoints = [];
            const mergedEdges = [];
            let pointOffset = 0;
            
            copies.forEach(copy => {
                // Add points
                copy.points.forEach(p => mergedPoints.push({ ...p }));
                
                // Add edges with adjusted indices
                copy.edges.forEach(edge => {
                    mergedEdges.push({
                        ...edge,
                        points: edge.points.map(idx => idx + pointOffset)
                    });
                });
                
                pointOffset += copy.points.length;
            });
            
            const result = JSON.parse(JSON.stringify(obj));
            result.points = mergedPoints;
            result.edges = mergedEdges;
            result._arrayCopies = copies.length;
            
            return result;
        } else {
            // Return first copy as main object, store others as metadata
            // The renderer will need to handle drawing multiple copies
            const result = JSON.parse(JSON.stringify(obj));
            result.points = copies[0]?.points || obj.points;
            result.edges = copies[0]?.edges || obj.edges;
            result._arrayCopies = copies;
            
            return result;
        }
    }
    
    /**
     * Generate UI for array modifier
     */
    function generateUI(params, modifier, objectId) {
        let specificUI = '';
        
        // Common settings
        const commonUI = `
            <div class="modifier-param-group">
                <label class="modifier-label">Array Type</label>
                <select class="modifier-select" data-param="arrayType" data-modifier-id="${modifier.id}">
                    ${Object.entries(ARRAY_TYPES).map(([key, type]) => `
                        <option value="${key}" ${params.arrayType === key ? 'selected' : ''}>
                            ${type.name}
                        </option>
                    `).join('')}
                </select>
            </div>
        `;
        
        // Type-specific settings
        switch (params.arrayType) {
            case 'linear':
                specificUI = `
                    <div class="modifier-param-group">
                        <label class="modifier-label">Count</label>
                        <input type="number" class="modifier-input" 
                               data-param="count" data-modifier-id="${modifier.id}"
                               value="${params.count}" min="1" max="100">
                    </div>
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
                            <label class="modifier-label">Relative Size</label>
                            <input type="number" class="modifier-input" 
                                   data-param="relativeOffset" data-modifier-id="${modifier.id}"
                                   value="${params.relativeOffset}" min="0" max="10" step="0.1">
                        </div>
                    ` : ''}
                `;
                break;
                
            case 'radial':
                specificUI = `
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
                `;
                break;
                
            case 'grid':
                specificUI = `
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
                            <label class="modifier-label">Relative Size</label>
                            <input type="number" class="modifier-input" 
                                   data-param="relativeOffset" data-modifier-id="${modifier.id}"
                                   value="${params.relativeOffset}" min="0" max="10" step="0.1">
                        </div>
                    ` : ''}
                `;
                break;
        }
        
        // Merge option
        const mergeUI = `
            <div class="modifier-param-group modifier-checkbox-group">
                <label class="modifier-checkbox-label">
                    <input type="checkbox" class="modifier-checkbox" 
                           data-param="mergeResults" 
                           data-modifier-id="${modifier.id}"
                           ${params.mergeResults ? 'checked' : ''}>
                    <span>Merge into single object</span>
                </label>
            </div>
        `;
        
        // Info
        const infoUI = `
            <div class="modifier-info">
                <i class="mdi mdi-information-outline"></i>
                <span>${ARRAY_TYPES[params.arrayType]?.description || ''}</span>
            </div>
        `;
        
        return commonUI + specificUI + mergeUI + infoUI;
    }
    
    // ============================================
    // REGISTER MODIFIER
    // ============================================
    
    VectorEditor.Modifiers.registerModifier('array', {
        name: 'Array',
        icon: 'mdi-view-grid-outline',
        create: createParams,
        apply: applyModifier,
        ui: generateUI
    });
    
    // ============================================
    // EVENT HANDLERS FOR UI
    // ============================================
    
    document.addEventListener('input', (e) => {
        if (e.target.classList.contains('modifier-input')) {
            const param = e.target.dataset.param;
            const modifierId = e.target.dataset.modifierId;
            const objectId = VectorEditor.state.selectedObjectId;
            
            if (param && modifierId && objectId) {
                const value = e.target.type === 'number' ? parseFloat(e.target.value) : e.target.value;
                VectorEditor.Modifiers.updateModifierParams(objectId, modifierId, { [param]: value });
            }
        }
    });
    
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
