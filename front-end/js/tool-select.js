/**
 * tool-select.js - Select/Resize tool
 * Tool for selecting and resizing objects
 */

(function() {
    'const { state } = VectorEditor;';

    const toolInfo = {
        name: 'select',
        group: 'transform',
        shortcut: 'V',
        title: 'Select/Resize (V)',
        icon: 'mdi-cursor-default'
    };

    function init() {
        // Tool is initialized by toolbar.js
        // Initialize selection keyboard shortcuts
        initSelectionShortcuts();
    }

    function getCursor() {
        return 'default';
    }

    // ============================================
    // SELECTION KEYBOARD SHORTCUTS
    // ============================================

    function initSelectionShortcuts() {
        document.addEventListener('keydown', e => {
            if(e.target.tagName === 'INPUT') return;

            const { state, render, clearSelections, selectAllObjects, selectAllPointsAndEdges } = VectorEditor;
            const canvas = document.getElementById('canvas');
            
            // Only handle these shortcuts when select or rotate tool is active
            if (!['select', 'rotate'].includes(state.tool)) return;

            // Ctrl+A to select all objects
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
                e.preventDefault();
                selectAllObjects();
                if (canvas && render) render(canvas);
                return;
            }
            
            // Shift+A to select all points/edges of current object
            if (e.shiftKey && e.key.toLowerCase() === 'a') {
                e.preventDefault();
                selectAllPointsAndEdges();
                if (canvas && render) render(canvas);
                return;
            }
            
            // Escape to clear selection
            if (e.key === 'Escape') {
                clearSelections();
                if (canvas && render) render(canvas);
                return;
            }
        });
    }

    // Register tool
    window.VectorEditor = window.VectorEditor || {};
    window.VectorEditor.tools = window.VectorEditor.tools || {};
    window.VectorEditor.tools.select = {
        info: toolInfo,
        init,
        getCursor
    };

})();
