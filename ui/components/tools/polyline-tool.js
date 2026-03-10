/**
 * polyline-tool.js - Polyline (straight line segments) drawing tool
 *
 * This file is now a registration shim only.
 * All drawing logic lives in drawing-engine.js which registers
 * VectorEditor.tools.polyline automatically.
 *
 * Kept for compatibility in case any external code references this file.
 * drawing-engine.js MUST be loaded before this file.
 */

(function () {
    // drawing-engine.js registers VectorEditor.tools.polyline already.
    // Nothing to do here; this file is a no-op placeholder.

    // Verify the engine registered the tool
    if (window.VectorEditor && window.VectorEditor.tools && !window.VectorEditor.tools.polyline) {
        console.warn('[polyline-tool] drawing-engine.js was not loaded first. Polyline tool may not function.');
    }
})();