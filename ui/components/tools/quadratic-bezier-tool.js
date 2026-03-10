/**
 * quadratic-bezier-tool.js - Quadratic Bézier drawing tool
 *
 * Registration shim only.
 * VectorEditor.tools.quadratic is registered by drawing-engine.js.
 * drawing-engine.js MUST be loaded before this file.
 */

(function () {
    if (window.VectorEditor && window.VectorEditor.tools && !window.VectorEditor.tools.quadratic) {
        console.warn('[quadratic-bezier-tool] drawing-engine.js was not loaded first.');
    }
})();