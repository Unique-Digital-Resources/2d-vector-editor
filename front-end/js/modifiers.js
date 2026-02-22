/**
 * modifiers.js - Main modifier management system
 * Blender-like modifier stack for vector objects
 */

(function() {
    'use strict';
    
    const { state } = VectorEditor;
    
    // ============================================
    // MODIFIER REGISTRY
    // ============================================
    
    // Registry of available modifier types
    const modifierRegistry = {};
    
    /**
     * Register a modifier type
     * @param {string} type - Unique modifier type identifier
     * @param {object} config - Modifier configuration
     */
    function registerModifier(type, config) {
        modifierRegistry[type] = {
            type,
            name: config.name || type,
            icon: config.icon || 'mdi-puzzle',
            create: config.create || (() => ({})),
            apply: config.apply || ((obj, params) => obj),
            ui: config.ui || (() => ''),
            ...config
        };
    }
    
    /**
     * Get all registered modifier types
     */
    function getModifierTypes() {
        return Object.values(modifierRegistry);
    }
    
    /**
     * Get a modifier config by type
     */
    function getModifierConfig(type) {
        return modifierRegistry[type] || null;
    }
    
    // ============================================
    // MODIFIER MANAGEMENT
    // ============================================
    
    /**
     * Add a modifier to an object
     * @param {string} objectId - Target object ID
     * @param {string} modifierType - Type of modifier to add
     * @returns {object} The created modifier instance
     */
    function addModifier(objectId, modifierType) {
        const obj = state.objects.find(o => o.id === objectId);
        if (!obj) return null;
        
        const config = getModifierConfig(modifierType);
        if (!config) return null;
        
        // Initialize modifiers array if not exists
        if (!obj.modifiers) {
            obj.modifiers = [];
        }
        
        // Create modifier instance
        const modifier = {
            id: 'mod_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            type: modifierType,
            name: config.name,
            enabled: true,
            collapsed: false,
            params: config.create()
        };
        
        obj.modifiers.push(modifier);
        
        // Trigger update
        triggerModifierUpdate(objectId);
        
        return modifier;
    }
    
    /**
     * Remove a modifier from an object
     * @param {string} objectId - Target object ID
     * @param {string} modifierId - Modifier instance ID to remove
     */
    function removeModifier(objectId, modifierId) {
        const obj = state.objects.find(o => o.id === objectId);
        if (!obj || !obj.modifiers) return;
        
        const index = obj.modifiers.findIndex(m => m.id === modifierId);
        if (index >= 0) {
            obj.modifiers.splice(index, 1);
            triggerModifierUpdate(objectId);
        }
    }
    
    /**
     * Move a modifier to a new position in the stack
     * @param {string} objectId - Target object ID
     * @param {string} modifierId - Modifier instance ID
     * @param {number} newIndex - New position in the stack
     */
    function reorderModifier(objectId, modifierId, newIndex) {
        const obj = state.objects.find(o => o.id === objectId);
        if (!obj || !obj.modifiers) return;
        
        const currentIndex = obj.modifiers.findIndex(m => m.id === modifierId);
        if (currentIndex < 0) return;
        
        // Clamp new index
        newIndex = Math.max(0, Math.min(newIndex, obj.modifiers.length - 1));
        
        if (currentIndex !== newIndex) {
            const [modifier] = obj.modifiers.splice(currentIndex, 1);
            obj.modifiers.splice(newIndex, 0, modifier);
            triggerModifierUpdate(objectId);
        }
    }
    
    /**
     * Toggle modifier enabled state
     */
    function toggleModifierEnabled(objectId, modifierId) {
        const obj = state.objects.find(o => o.id === objectId);
        if (!obj || !obj.modifiers) return;
        
        const modifier = obj.modifiers.find(m => m.id === modifierId);
        if (modifier) {
            modifier.enabled = !modifier.enabled;
            triggerModifierUpdate(objectId);
        }
    }
    
    /**
     * Toggle modifier collapsed state
     */
    function toggleModifierCollapsed(objectId, modifierId) {
        const obj = state.objects.find(o => o.id === objectId);
        if (!obj || !obj.modifiers) return;
        
        const modifier = obj.modifiers.find(m => m.id === modifierId);
        if (modifier) {
            modifier.collapsed = !modifier.collapsed;
            renderModifiersPanel();
        }
    }
    
    /**
     * Update modifier parameters
     */
    function updateModifierParams(objectId, modifierId, params) {
        const obj = state.objects.find(o => o.id === objectId);
        if (!obj || !obj.modifiers) return;
        
        const modifier = obj.modifiers.find(m => m.id === modifierId);
        if (modifier) {
            Object.assign(modifier.params, params);
            triggerModifierUpdate(objectId);
        }
    }
    
    // ============================================
    // MODIFIER APPLICATION
    // ============================================
    
    /**
     * Apply all modifiers to an object and return the result
     * @param {object} obj - Source object
     * @returns {object} Modified copy of the object
     */
    function applyModifiers(obj) {
        if (!obj || !obj.modifiers || obj.modifiers.length === 0) {
            return obj;
        }
        
        // Start with a deep copy of the original object
        let result = JSON.parse(JSON.stringify(obj));
        
        // Store reference to original
        result._original = obj;
        
        // Apply each enabled modifier in order
        for (const modifier of obj.modifiers) {
            if (!modifier.enabled) continue;
            
            const config = getModifierConfig(modifier.type);
            if (config && config.apply) {
                try {
                    result = config.apply(result, modifier.params, obj);
                } catch (e) {
                    console.error(`Error applying modifier ${modifier.type}:`, e);
                }
            }
        }
        
        return result;
    }
    
    /**
     * Get the display object (with modifiers applied) for rendering
     */
    function getDisplayObject(obj) {
        return applyModifiers(obj);
    }
    
    // ============================================
    // UI RENDERING
    // ============================================
    
    /**
     * Render the modifiers panel
     */
    function renderModifiersPanel() {
        const panel = document.getElementById('modifiersPanel');
        if (!panel) return;
        
        const obj = state.objects.find(o => o.id === state.selectedObjectId);
        
        if (!obj) {
            panel.innerHTML = `
                <div class="modifiers-empty">
                    <i class="mdi mdi-puzzle-outline"></i>
                    <span>Select an object to manage modifiers</span>
                </div>
            `;
            return;
        }
        
        // Build the panel HTML
        let html = `
            <div class="modifiers-header">
                <span class="modifiers-title">Modifiers</span>
                <div class="modifier-add-wrapper">
                    <select class="modifier-dropdown" id="modifierDropdown">
                        <option value="">Add Modifier...</option>
                        ${getModifierTypes().map(m => `
                            <option value="${m.type}">${m.name}</option>
                        `).join('')}
                    </select>
                </div>
            </div>
            <div class="modifiers-list" id="modifiersList">
        `;
        
        // Render each modifier card
        if (obj.modifiers && obj.modifiers.length > 0) {
            obj.modifiers.forEach((modifier, index) => {
                html += renderModifierCard(obj.id, modifier, index);
            });
        } else {
            html += `
                <div class="modifiers-empty-list">
                    <span>No modifiers applied</span>
                </div>
            `;
        }
        
        html += '</div>';
        
        panel.innerHTML = html;
        
        // Attach event listeners
        attachModifierEvents(obj.id);
    }
    
    /**
     * Render a single modifier card
     */
    function renderModifierCard(objectId, modifier, index) {
        const config = getModifierConfig(modifier.type);
        if (!config) return '';
        
        const enabledClass = modifier.enabled ? '' : 'disabled';
        const collapsedClass = modifier.collapsed ? 'collapsed' : '';
        
        return `
            <div class="modifier-card ${enabledClass} ${collapsedClass}" 
                 data-modifier-id="${modifier.id}" 
                 data-modifier-index="${index}">
                <div class="modifier-card-header" draggable="true">
                    <div class="modifier-drag-handle" title="Drag to reorder">
                        <i class="mdi mdi-drag-vertical"></i>
                    </div>
                    <div class="modifier-icon">
                        <i class="mdi ${config.icon}"></i>
                    </div>
                    <span class="modifier-name">${modifier.name}</span>
                    <div class="modifier-actions">
                        <button class="modifier-btn toggle-enabled ${modifier.enabled ? 'active' : ''}" 
                                title="${modifier.enabled ? 'Disable' : 'Enable'}">
                            <i class="mdi mdi-eye${modifier.enabled ? '' : '-off'}"></i>
                        </button>
                        <button class="modifier-btn toggle-collapse" title="${modifier.collapsed ? 'Expand' : 'Collapse'}">
                            <i class="mdi mdi-chevron-${modifier.collapsed ? 'down' : 'up'}"></i>
                        </button>
                        <button class="modifier-btn delete-modifier" title="Delete">
                            <i class="mdi mdi-delete"></i>
                        </button>
                    </div>
                </div>
                <div class="modifier-card-content">
                    ${modifier.collapsed ? '' : config.ui(modifier.params, modifier, objectId)}
                </div>
            </div>
        `;
    }
    
    /**
     * Attach event listeners to modifier UI
     */
    function attachModifierEvents(objectId) {
        const dropdown = document.getElementById('modifierDropdown');
        if (dropdown) {
            dropdown.addEventListener('change', (e) => {
                if (e.target.value) {
                    addModifier(objectId, e.target.value);
                    e.target.value = '';
                }
            });
        }
        
        const list = document.getElementById('modifiersList');
        if (list) {
            // Modifier card events
            list.querySelectorAll('.modifier-card').forEach(card => {
                const modifierId = card.dataset.modifierId;
                
                // Toggle enabled
                card.querySelector('.toggle-enabled')?.addEventListener('click', (e) => {
                    e.stopPropagation();
                    toggleModifierEnabled(objectId, modifierId);
                });
                
                // Toggle collapse
                card.querySelector('.toggle-collapse')?.addEventListener('click', (e) => {
                    e.stopPropagation();
                    toggleModifierCollapsed(objectId, modifierId);
                });
                
                // Delete
                card.querySelector('.delete-modifier')?.addEventListener('click', (e) => {
                    e.stopPropagation();
                    removeModifier(objectId, modifierId);
                });
            });
            
            // Drag and drop for reordering - attach to headers only
            list.querySelectorAll('.modifier-card-header').forEach(header => {
                header.addEventListener('dragstart', handleDragStart);
                header.addEventListener('dragend', handleDragEnd);
            });
            
            // Allow dropping on cards
            list.querySelectorAll('.modifier-card').forEach(card => {
                card.addEventListener('dragover', handleDragOver);
                card.addEventListener('drop', handleDrop);
            });
        }
    }
    
    // ============================================
    // DRAG AND DROP
    // ============================================
    
    let draggedModifier = null;
    
    function handleDragStart(e) {
        // Get the parent card element
        draggedModifier = this.closest('.modifier-card');
        draggedModifier.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', draggedModifier.dataset.modifierId);
    }
    
    function handleDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        
        const draggedCard = draggedModifier;
        const targetCard = this.classList.contains('modifier-card') ? this : this.closest('.modifier-card');
        
        if (targetCard && draggedCard && targetCard !== draggedCard) {
            const list = document.getElementById('modifiersList');
            const cards = [...list.querySelectorAll('.modifier-card')];
            const draggedIndex = cards.indexOf(draggedCard);
            const targetIndex = cards.indexOf(targetCard);
            
            if (draggedIndex < targetIndex) {
                targetCard.parentNode.insertBefore(draggedCard, targetCard.nextSibling);
            } else {
                targetCard.parentNode.insertBefore(draggedCard, targetCard);
            }
        }
    }
    
    function handleDrop(e) {
        e.preventDefault();
        
        const draggedCard = draggedModifier;
        const targetCard = this.classList.contains('modifier-card') ? this : this.closest('.modifier-card');
        
        if (targetCard && draggedCard && targetCard !== draggedCard) {
            const list = document.getElementById('modifiersList');
            const cards = [...list.querySelectorAll('.modifier-card')];
            const newIndex = cards.indexOf(targetCard);
            
            reorderModifier(
                state.selectedObjectId,
                draggedCard.dataset.modifierId,
                newIndex
            );
        }
    }
    
    function handleDragEnd() {
        const draggedCard = draggedModifier;
        if (draggedCard) {
            draggedCard.classList.remove('dragging');
        }
        draggedModifier = null;
    }
    
    // ============================================
    // UPDATE HANDLING
    // ============================================
    
    /**
     * Trigger a modifier update and re-render
     */
    function triggerModifierUpdate(objectId) {
        renderModifiersPanel();
        
        // Trigger canvas re-render
        const { render } = VectorEditor;
        const canvas = document.getElementById('canvas');
        if (canvas && render) {
            render(canvas);
        }
        
        // Dispatch custom event
        window.dispatchEvent(new CustomEvent('modifierUpdate', { 
            detail: { objectId } 
        }));
    }
    
    /**
     * Initialize the modifiers system
     */
    function init() {
        // Listen for selection changes
        window.addEventListener('vectorEditorUpdate', renderModifiersPanel);
        
        // Initial render
        renderModifiersPanel();
    }
    
    // ============================================
    // EXPORTS
    // ============================================
    
    window.VectorEditor = window.VectorEditor || {};
    window.VectorEditor.Modifiers = {
        // Registration
        registerModifier,
        getModifierTypes,
        getModifierConfig,
        
        // Management
        addModifier,
        removeModifier,
        reorderModifier,
        toggleModifierEnabled,
        toggleModifierCollapsed,
        updateModifierParams,
        
        // Application
        applyModifiers,
        getDisplayObject,
        
        // UI
        renderModifiersPanel,
        
        // Init
        init
    };
    
})();
