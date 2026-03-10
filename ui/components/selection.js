/**
 * selection.js - Selection management
 * Supports multi-select, point/edge/handle, and path segment selection.
 */
(function () {

    const getState = () => VectorEditor.state;

    function clearSelections() {
        const state = getState();
        state.selectedObjectIds = [];
        state.selectedPointIndices = [];
        state.selectedEdgeIndices = [];
        state.selectedHandleIndices = [];
        state.selectedSegmentIndices = [];
        state.selectedObjectId = null;
        state.selectedPointIndex = null;
        state.selectedEdgeIndex = null;
    }

    function isObjectSelected(objectId) {
        const state = getState();
        return state.selectedObjectIds.includes(objectId) || state.selectedObjectId === objectId;
    }

    function isPointSelected(objectId, pointIndex) {
        const state = getState();
        return state.selectedPointIndices.some(p => p.objectId === objectId && p.pointIndex === pointIndex);
    }

    function isSegmentSelected(objectId, segmentIndex) {
        const state = getState();
        return state.selectedSegmentIndices.some(s => s.objectId === objectId && s.segmentIndex === segmentIndex);
    }

    function selectObject(objectId, addToSelection = false) {
        const state = getState();
        if (!addToSelection) {
            clearSelections();
        }
        if (!state.selectedObjectIds.includes(objectId)) {
            state.selectedObjectIds.push(objectId);
        }
        state.selectedObjectId = objectId;
    }

    function selectPoint(objectId, pointIndex, addToSelection = false) {
        const state = getState();
        if (!addToSelection) {
            clearSelections();
        }
        if (!state.selectedPointIndices.some(p => p.objectId === objectId && p.pointIndex === pointIndex)) {
            state.selectedPointIndices.push({ objectId, pointIndex });
        }
        state.selectedObjectId = objectId;
        state.selectedPointIndex = pointIndex;
        if (!state.selectedObjectIds.includes(objectId)) {
            state.selectedObjectIds.push(objectId);
        }
    }

    /**
     * Select a path segment (the curve between anchor[segIdx] and anchor[segIdx+1]).
     * Also selects its two endpoint anchors.
     */
    function selectSegment(objectId, segmentIndex, addToSelection = false) {
        const state = getState();
        if (!addToSelection) {
            clearSelections();
        }

        if (!state.selectedObjectIds.includes(objectId)) {
            state.selectedObjectIds.push(objectId);
        }
        state.selectedObjectId = objectId;

        if (!state.selectedSegmentIndices.some(s => s.objectId === objectId && s.segmentIndex === segmentIndex)) {
            state.selectedSegmentIndices.push({ objectId, segmentIndex });
        }

        // Also select both endpoint anchors
        const pp = state.paperPaths[objectId];
        if (pp) {
            const n = pp.segments.length;
            const p2Idx = (segmentIndex + 1) % n;
            if (!state.selectedPointIndices.some(p => p.objectId === objectId && p.pointIndex === segmentIndex)) {
                state.selectedPointIndices.push({ objectId, pointIndex: segmentIndex });
            }
            if (!state.selectedPointIndices.some(p => p.objectId === objectId && p.pointIndex === p2Idx)) {
                state.selectedPointIndices.push({ objectId, pointIndex: p2Idx });
            }
        }
    }

    function toggleObjectSelection(objectId) {
        const state = getState();
        const idx = state.selectedObjectIds.indexOf(objectId);
        if (idx >= 0) {
            state.selectedObjectIds.splice(idx, 1);
            state.selectedPointIndices = state.selectedPointIndices.filter(p => p.objectId !== objectId);
            state.selectedSegmentIndices = state.selectedSegmentIndices.filter(s => s.objectId !== objectId);
            if (state.selectedObjectId === objectId) {
                state.selectedObjectId = state.selectedObjectIds[0] || null;
                state.selectedPointIndex = null;
            }
        } else {
            selectObject(objectId, true);
        }
    }

    function togglePointSelection(objectId, pointIndex) {
        const state = getState();
        const idx = state.selectedPointIndices.findIndex(p => p.objectId === objectId && p.pointIndex === pointIndex);
        if (idx >= 0) {
            state.selectedPointIndices.splice(idx, 1);
            if (state.selectedPointIndex === pointIndex && state.selectedObjectId === objectId) {
                state.selectedPointIndex = state.selectedPointIndices[0]?.pointIndex || null;
            }
        } else {
            selectPoint(objectId, pointIndex, true);
        }
    }

    function selectAllObjects() {
        const state = getState();
        clearSelections();
        const doc = VectorEditor.app.document;
        doc.getAllObjects().forEach(obj => {
            selectObject(obj.id, true);
        });
    }

    function selectInBox(box, addToSelection = false) {
        const state = getState();
        if (!addToSelection) {
            clearSelections();
        }
        const doc = VectorEditor.app.document;
        const boxRect = new paper.Rectangle(box.x, box.y, box.width, box.height);

        doc.getAllObjects().forEach(obj => {
            const pp = state.paperPaths[obj.id];
            if (pp) {
                const b = pp.bounds;
                const objRect = new paper.Rectangle(b.x, b.y, b.width, b.height);
                if (boxRect.intersects(objRect)) {
                    if (!state.selectedObjectIds.includes(obj.id)) {
                        state.selectedObjectIds.push(obj.id);
                    }
                }
            }
        });

        if (state.selectedObjectIds.length > 0) {
            state.selectedObjectId = state.selectedObjectIds[0];
        }
    }

    // --- Exports ---
    window.VectorEditor = window.VectorEditor || {};
    window.VectorEditor.clearSelections = clearSelections;
    window.VectorEditor.isObjectSelected = isObjectSelected;
    window.VectorEditor.isPointSelected = isPointSelected;
    window.VectorEditor.isSegmentSelected = isSegmentSelected;
    window.VectorEditor.selectObject = selectObject;
    window.VectorEditor.selectPoint = selectPoint;
    window.VectorEditor.selectSegment = selectSegment;
    window.VectorEditor.toggleObjectSelection = toggleObjectSelection;
    window.VectorEditor.togglePointSelection = togglePointSelection;
    window.VectorEditor.selectAllObjects = selectAllObjects;
    window.VectorEditor.selectInBox = selectInBox;

})();