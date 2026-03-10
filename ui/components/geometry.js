/**
 * geometry.js - Paper.js initialization and geometry utilities
 * Sets up hidden Paper.js canvas, provides math helpers
 */

(function() {

    let paperInitialized = false;

    function initPaper() {
        if (paperInitialized) return;

        const hiddenCanvas = document.createElement('canvas');
        hiddenCanvas.id = 'paper-canvas';
        hiddenCanvas.width = 1;
        hiddenCanvas.height = 1;
        hiddenCanvas.style.display = 'none';
        document.body.appendChild(hiddenCanvas);

        paper.setup(hiddenCanvas);
        paperInitialized = true;

        const state = VectorEditor.state;
        state.paperScope = paper;
        state.paperProject = paper.project;

        // Create layers
        state.paperLayer = paper.project.activeLayer;
        state.overlayLayer = new paper.Layer();
        state.overlayLayer.name = 'overlay';
        state.paperLayer.activate();
    }

    // --- Utilities ---

    const generateId = () => 'shape_' + (++VectorEditor.state.objectCounter) + '_' + Math.random().toString(36).substr(2, 6);

    function getMousePos(e, svgCanvas) {
        const rect = svgCanvas.getBoundingClientRect();
        const state = VectorEditor.state;
        const zoom = state.zoom || 1;
        const pan = state.pan || { x: 0, y: 0 };
        return {
            x: (e.clientX - rect.left - pan.x) / zoom,
            y: (e.clientY - rect.top - pan.y) / zoom
        };
    }

    const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
    const dist = (p1, p2) => Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);

    function getBoundingBox(paperPath) {
        if (!paperPath) return { x: 0, y: 0, width: 0, height: 0 };
        const b = paperPath.bounds;
        return { x: b.x, y: b.y, width: b.width, height: b.height };
    }

    function getMultiBoundingBox(objectIds) {
        const state = VectorEditor.state;
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

        objectIds.forEach(id => {
            const pp = state.paperPaths[id];
            if (pp) {
                const b = pp.bounds;
                minX = Math.min(minX, b.x);
                minY = Math.min(minY, b.y);
                maxX = Math.max(maxX, b.x + b.width);
                maxY = Math.max(maxY, b.y + b.height);
            }
        });

        if (minX === Infinity) return { x: 0, y: 0, width: 0, height: 0 };
        return {
            x: minX, y: minY,
            width: Math.max(1, maxX - minX),
            height: Math.max(1, maxY - minY)
        };
    }

    // --- Exports ---

    window.VectorEditor = window.VectorEditor || {};
    window.VectorEditor.initPaper = initPaper;
    window.VectorEditor.generateId = generateId;
    window.VectorEditor.getMousePos = getMousePos;
    window.VectorEditor.clamp = clamp;
    window.VectorEditor.dist = dist;
    window.VectorEditor.getBoundingBox = getBoundingBox;
    window.VectorEditor.getMultiBoundingBox = getMultiBoundingBox;

})();
