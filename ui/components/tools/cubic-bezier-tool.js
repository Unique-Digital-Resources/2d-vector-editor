/**
 * cubic-bezier-tool.js - Cubic Bézier drawing tool
 *
 * Registration shim only.
 * VectorEditor.tools.cubic is registered by drawing-engine.js.
 * drawing-engine.js MUST be loaded before this file.
 */

(function () {
    if (window.VectorEditor && window.VectorEditor.tools && !window.VectorEditor.tools.cubic) {
        console.warn('[cubic-bezier-tool] drawing-engine.js was not loaded first.');
    }
})();