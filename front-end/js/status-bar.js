/**
 * status-bar.js - Status bar
 * Displays current tool, object count, and mouse position
 */

(function() {
    'const { state } = VectorEditor;';

    // ============================================
    // STATUS BAR UPDATE
    // ============================================

    function updateStatusBar() {
        const objectCountEl = document.getElementById('objectCount');
        if (objectCountEl) {
            objectCountEl.textContent = state.objects.length + ' objects';
        }
    }

    // ============================================
    // INITIALIZATION
    // ============================================

    function init() {
        // Listen for updates
        window.addEventListener('vectorEditorUpdate', updateStatusBar);
    }

    // ============================================
    // EXPORTS
    // ============================================

    window.VectorEditor = window.VectorEditor || {};
    window.VectorEditor.updateStatusBar = updateStatusBar;
    window.VectorEditor.initStatusBar = init;

})();
