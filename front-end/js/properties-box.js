/**
 * properties-box.js - Properties panel
 * Displays properties of selected objects
 */

(function() {
    'const { state } = VectorEditor;';

    // ============================================
    // PROPERTIES PANEL UPDATE
    // ============================================

    function updatePropertiesBox() {
        const propertiesPanel = document.getElementById('propertiesPanel');
        if (!propertiesPanel) return;

        const obj = state.objects.find(o => o.id === state.selectedObjectId);

        if(obj) {
            propertiesPanel.innerHTML = `
                <div class="property-row"><span class="property-label">Type</span><span class="property-value">${obj.type}</span></div>
                <div class="property-row"><span class="property-label">Points</span><span class="property-value">${obj.points.length}</span></div>
                <div class="property-row"><span class="property-label">Fill</span><span class="property-value" style="background:${obj.fill}; color:${obj.fill};">${obj.fill}</span></div>
                <div class="property-row"><span class="property-label">Stroke</span><span class="property-value">${obj.strokeWidth}px</span></div>
            `;
        } else {
            propertiesPanel.innerHTML = `<div style="color: var(--text-muted); font-size: 13px; text-align: center; padding: 20px;">Select an object</div>`;
        }
    }

    // ============================================
    // INITIALIZATION
    // ============================================

    function init() {
        // Listen for updates
        window.addEventListener('vectorEditorUpdate', updatePropertiesBox);
    }

    // ============================================
    // EXPORTS
    // ============================================

    window.VectorEditor = window.VectorEditor || {};
    window.VectorEditor.updatePropertiesBox = updatePropertiesBox;
    window.VectorEditor.initPropertiesBox = init;

})();
