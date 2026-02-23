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
            relativeOffsetX: 1.2,
            relativeOffsetY: 0,
            
            // Radial settings
            angle: 360,
            centerOnObject: true,
            centerX: 0,
            centerY: 0,
            
            // Grid settings
            countX: 3,
            countY: 3
        };
    }
    
    /**
     * Apply array modifier to object
     */
    function applyModifier(obj, params, originalObj) {
        let copies = [];
        
        switch (params.arrayType) {
            case 'linear':
                copies = VectorEditor.ArrayLinear.generateLinearArray(obj, params);
                break;
            case 'radial':
                copies = VectorEditor.ArrayRadial.generateRadialArray(obj, params);
                break;
            case 'grid':
                copies = VectorEditor.ArrayGrid.generateGridArray(obj, params);
                break;
            default:
                copies = [obj];
        }
        
        // Return first copy as main object, store others as metadata
        const result = JSON.parse(JSON.stringify(obj));
        result.points = copies[0]?.points || obj.points;
        result.edges = copies[0]?.edges || obj.edges;
        result._arrayCopies = copies;
        
        return result;
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
                specificUI = VectorEditor.ArrayLinear.generateUI(params, modifier, objectId);
                break;
                
            case 'radial':
                specificUI = VectorEditor.ArrayRadial.generateUI(params, modifier, objectId);
                break;
                
            case 'grid':
                specificUI = VectorEditor.ArrayGrid.generateUI(params, modifier, objectId);
                break;
        }
        
        // Info
        const infoUI = `
            <div class="modifier-info">
                <i class="mdi mdi-information-outline"></i>
                <span>${ARRAY_TYPES[params.arrayType]?.description || ''}</span>
            </div>
        `;
        
        return commonUI + specificUI + infoUI;
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
