/**
 * arc-tool.js - Arc drawing tool
 *
 * Registration shim only.
 * VectorEditor.tools.arc is registered by drawing-engine.js.
 * drawing-engine.js MUST be loaded before this file.
 */

(function () {
    if (window.VectorEditor && window.VectorEditor.tools && !window.VectorEditor.tools.arc) {
        console.warn('[arc-tool] drawing-engine.js was not loaded first.');
    }
})();