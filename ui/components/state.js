/**
 * state.js  —  /ui layer
 *
 * UI-only view state.  Modifier stacks live in app.modifierRegistry
 * (application layer) — not here.  AGENT.md: UI must not hold business data.
 */
(function () {

    const state = {
        // Active tool
        tool: 'select',

        // Selection
        selectedObjectIds:    [],
        selectedPointIndices: [],
        selectedEdgeIndices:  [],
        selectedSegmentIndices: [],
        selectedObjectId:     null,
        selectedPointIndex:   null,
        selectedEdgeIndex:    null,

        // Bezier handle drag
        draggingHandle:  null,  // { objectId, segmentIndex, handleType:'in'|'out' }

        // Per-object segment-type metadata (written by drawing-engine on commit)
        shapeMetadata: {},      // objectId → { segmentTypes[], anchorCount, closed }

        // Interaction
        interaction:     null,
        dragStart:       { x: 0, y: 0 },
        resizeHandle:    null,
        initialBounds:   {},
        initialBbox:     null,
        rotationCenter:  null,

        // Legacy freehand (freehand-tool.js)
        isDrawing:        false,
        drawingPath:      null,
        penPoints:        [],
        lastPoint:        null,
        freehandStartPos: null,

        // Unified drawing session (drawing-engine.js)
        drawingSession: { active: false },

        // Active side-panel tab
        activeTab: 'objects',

        // Style defaults
        fillColor:    '#10b981',
        strokeColor:  '#ffffff',
        strokeWidth:  2,
        polygonSides: 6,
        starPoints:   5,

        // Marquee
        selectionBox: null,
        isSelecting:  false,

        // Viewport
        zoom: 1,
        pan:  { x: 0, y: 0 },
        currentMouse: { x: 0, y: 0 },

        // Paper.js instances
        paperPaths: {}
    };

    window.VectorEditor = window.VectorEditor || {};
    window.VectorEditor.state = state;

})();