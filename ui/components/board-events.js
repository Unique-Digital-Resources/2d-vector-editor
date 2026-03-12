/**
 * board-events.js - Canvas event handling
 *
 * Changes from v1:
 *  - mousedown priority:
 *      1. bezier handle dots  → interaction='bezier-handle'
 *      2. gizmo resize handles
 *      3. rotation handle
 *      4. anchor points
 *      5. path segments (stroke)  → selectSegment cascade
 *      6. object fill
 *      7. marquee
 *  - mousemove: handles 'bezier-handle' interaction
 *  - mouseup:   clears draggingHandle
 *  - contextmenu during drawing → cancelLastAnchor (right-click undo)
 */

(function () {

    function initBoard(svgCanvas) {
        VectorEditor.initPaper();
        VectorEditor.App.bootstrap();

        // ── MOUSE DOWN ──────────────────────────────────────────────────────────
        svgCanvas.addEventListener('mousedown', e => {
            if (e.button !== 0) return;

            const {
                state, getMousePos,
                hitTestObject, hitTestSegment, hitTestPathSegment,
                hitTestGizmoHandle, hitTestRotationHandle, hitTestBezierHandle,
                clearSelections, selectObject, selectPoint, selectSegment,
                toggleObjectSelection, togglePointSelection,
                render, tools, drawingEngine
            } = VectorEditor;

            // Delegate to drawing tools (engine or freehand)
            if (tools && tools[state.tool] && tools[state.tool].onMouseDown) {
                tools[state.tool].onMouseDown(e, svgCanvas);
                return;
            }

            const pos    = getMousePos(e, svgCanvas);
            state.dragStart = { ...pos };
            const isCtrl  = e.ctrlKey || e.metaKey;
            const isShift = e.shiftKey;

            // ── 1. Bezier handle dots (highest priority) ──────────────────────
            if (state.selectedPointIndices.length > 0) {
                const handleHit = hitTestBezierHandle(pos);
                if (handleHit) {
                    state.interaction   = 'bezier-handle';
                    state.draggingHandle = handleHit;
                    return;
                }
            }

            // ── 2. Gizmo resize handles ───────────────────────────────────────
            if (state.selectedObjectId && state.tool === 'select') {
                const bbox = getSelectionBBox();
                if (bbox) {
                    const handle = hitTestGizmoHandle(pos, bbox);
                    if (handle) {
                        state.interaction  = 'resize';
                        state.resizeHandle = handle;
                        state.initialBbox  = { ...bbox };
                        storeInitialTransforms();
                        return;
                    }
                }
            }

            // ── 3. Rotation handle ────────────────────────────────────────────
            if (state.selectedObjectId && state.tool === 'rotate') {
                const bbox = getSelectionBBox();
                if (bbox && hitTestRotationHandle(pos, bbox)) {
                    state.interaction     = 'rotate';
                    state.rotationCenter  = {
                        x: bbox.x + bbox.width / 2,
                        y: bbox.y + bbox.height / 2
                    };
                    storeInitialTransforms();
                    return;
                }
            }

            // ── 4. Anchor points ───────────────────────────────────────────────
            let segmentHit = null;
            for (const objId of state.selectedObjectIds) {
                const segIdx = hitTestSegment(pos, objId);
                if (segIdx !== null) {
                    segmentHit = { objectId: objId, segmentIndex: segIdx };
                    break;
                }
            }

            if (segmentHit) {
                if (isCtrl) {
                    togglePointSelection(segmentHit.objectId, segmentHit.segmentIndex);
                } else {
                    selectPoint(segmentHit.objectId, segmentHit.segmentIndex, isShift);
                }
                state.interaction = 'point';
                storeInitialTransforms();
                render(svgCanvas);
                return;
            }

            // ── 5. Path segment stroke (curve between two anchors) ─────────────
            if (state.selectedObjectIds.length > 0) {
                for (const objId of state.selectedObjectIds) {
                    const curveIdx = hitTestPathSegment(pos, objId);
                    if (curveIdx !== null) {
                        if (isCtrl || isShift) {
                            selectSegment(objId, curveIdx, true);
                        } else {
                            selectSegment(objId, curveIdx, false);
                        }
                        state.interaction = 'segment';
                        storeInitialTransforms();
                        render(svgCanvas);
                        return;
                    }
                }
            }

            // ── 6. Object fill ────────────────────────────────────────────────
            const hitObj = hitTestObject(pos);
            if (hitObj) {
                if (isCtrl) {
                    toggleObjectSelection(hitObj.id);
                } else if (isShift) {
                    selectObject(hitObj.id, true);
                } else {
                    // Check if clicking on a path segment of ANY object (even unselected)
                    const curveIdx = hitTestPathSegment(pos, hitObj.id);
                    if (curveIdx !== null) {
                        selectSegment(hitObj.id, curveIdx, false);
                        render(svgCanvas);
                        return;
                    }
                    selectObject(hitObj.id, false);
                }
                state.interaction = 'move';
                storeInitialTransforms();
                render(svgCanvas);
                return;
            }

            // ── 7. Empty area → marquee / clear ───────────────────────────────
            if (['select', 'rotate'].includes(state.tool)) {
                state.isSelecting = true;
                state.selectionBox = { x: pos.x, y: pos.y, width: 0, height: 0 };
                if (!isCtrl && !isShift) clearSelections();
            } else {
                clearSelections();
            }
            render(svgCanvas);
        });

        // ── MOUSE MOVE ──────────────────────────────────────────────────────────
        svgCanvas.addEventListener('mousemove', e => {
            const { state, getMousePos, render, tools } = VectorEditor;

            if (tools && tools[state.tool] && tools[state.tool].onMouseMove) {
                tools[state.tool].onMouseMove(e, svgCanvas);
                return;
            }

            const pos = getMousePos(e, svgCanvas);
            state.currentMouse = pos;

            const el = document.getElementById('mousePos');
            if (el) el.textContent = `${Math.round(pos.x)}, ${Math.round(pos.y)}`;

            if (state.isSelecting && state.selectionBox) {
                state.selectionBox.width  = pos.x - state.dragStart.x;
                state.selectionBox.height = pos.y - state.dragStart.y;
                render(svgCanvas);
                return;
            }

            if (!state.interaction) return;

            const dx = pos.x - state.dragStart.x;
            const dy = pos.y - state.dragStart.y;

            // ── Bezier handle dragging ─────────────────────────────────────────
            if (state.interaction === 'bezier-handle' && state.draggingHandle) {
                const { objectId, segmentIndex, handleType } = state.draggingHandle;
                const pp  = state.paperPaths[objectId];
                if (pp) {
                    const seg    = pp.segments[segmentIndex];
                    const anchor = seg.point;
                    // Relative position from anchor
                    const relX = pos.x - anchor.x;
                    const relY = pos.y - anchor.y;
                    if (handleType === 'in') {
                        pp.segments[segmentIndex].handleIn = new paper.Point(relX, relY);
                    } else {
                        pp.segments[segmentIndex].handleOut = new paper.Point(relX, relY);
                    }
                    syncPathToCore(objectId);
                }
                render(svgCanvas);
                return;
            }

            if (state.interaction === 'move') {
                state.selectedObjectIds.forEach(objId => {
                    const pp       = state.paperPaths[objId];
                    const initData = state.initialBounds[objId];
                    if (pp && initData) {
                        pp.position = new paper.Point(initData.cx + dx, initData.cy + dy);
                        syncPathToCore(objId);
                    }
                });
                render(svgCanvas);
            } else if (state.interaction === 'point') {
                state.selectedPointIndices.forEach(({ objectId, pointIndex }) => {
                    const pp       = state.paperPaths[objectId];
                    const initData = state.initialBounds[objectId];
                    if (pp && initData && initData.segments && initData.segments[pointIndex]) {
                        const initPt = initData.segments[pointIndex];
                        pp.segments[pointIndex].point = new paper.Point(
                            initPt.x + dx,
                            initPt.y + dy
                        );
                        syncPathToCore(objectId);
                    }
                });
                render(svgCanvas);
            } else if (state.interaction === 'segment') {
                state.selectedSegmentIndices.forEach(({ objectId, segmentIndex }) => {
                    const pp       = state.paperPaths[objectId];
                    const initData = state.initialBounds[objectId];
                    if (!pp || !initData || !initData.segments) return;
                    
                    const n = pp.segments.length;
                    const seg1Idx = segmentIndex;
                    const seg2Idx = (segmentIndex + 1) % n;
                    
                    if (initData.segments[seg1Idx] && initData.segments[seg2Idx]) {
                        const initPt1 = initData.segments[seg1Idx];
                        const initPt2 = initData.segments[seg2Idx];
                        
                        pp.segments[seg1Idx].point = new paper.Point(initPt1.x + dx, initPt1.y + dy);
                        pp.segments[seg2Idx].point = new paper.Point(initPt2.x + dx, initPt2.y + dy);
                        
                        syncPathToCore(objectId);
                    }
                });
                render(svgCanvas);
            } else if (state.interaction === 'resize') {
                handleResize(dx, dy);
                render(svgCanvas);
            } else if (state.interaction === 'rotate') {
                handleRotation(pos);
                render(svgCanvas);
            }
        });

        // ── MOUSE UP ────────────────────────────────────────────────────────────
        svgCanvas.addEventListener('mouseup', e => {
            const { state, getMousePos, selectInBox, render, tools } = VectorEditor;

            if (tools && tools[state.tool] && tools[state.tool].onMouseUp) {
                tools[state.tool].onMouseUp(e, svgCanvas);
                return;
            }

            if (state.isSelecting && state.selectionBox) {
                const box = state.selectionBox;
                const nb  = {
                    x: box.width  < 0 ? box.x + box.width  : box.x,
                    y: box.height < 0 ? box.y + box.height : box.y,
                    width:  Math.abs(box.width),
                    height: Math.abs(box.height)
                };
                if (nb.width > 5 || nb.height > 5) {
                    selectInBox(nb, e.ctrlKey || e.metaKey || e.shiftKey);
                }
                state.isSelecting  = false;
                state.selectionBox = null;
                render(svgCanvas);
                return;
            }

            // Clear all interaction state
            state.interaction    = null;
            state.draggingHandle = null;
            state.initialBounds  = {};
            state.initialBbox    = null;
            render(svgCanvas);
        });

        // ── CONTEXT MENU (right-click) ──────────────────────────────────────────
        svgCanvas.addEventListener('contextmenu', e => {
            e.preventDefault();
            const { state, getMousePos, hitTestObject, selectObject, render, drawingEngine } = VectorEditor;

            // During path drawing: right-click = undo last point
            if (drawingEngine && drawingEngine.isActive()) {
                drawingEngine.cancelLastAnchor();
                render(svgCanvas);
                return;
            }

            const pos = getMousePos(e, svgCanvas);
            const hit = hitTestObject(pos);
            if (hit) {
                selectObject(hit.id, false);
                render(svgCanvas);
                const cm = document.getElementById('contextMenu');
                if (cm) {
                    cm.style.left = e.clientX + 'px';
                    cm.style.top  = e.clientY + 'px';
                    cm.classList.add('visible');
                }
            }
        });

        // ── DOUBLE CLICK ────────────────────────────────────────────────────────
        svgCanvas.addEventListener('dblclick', e => {
            const { state, getMousePos, hitTestObject, render, tools } = VectorEditor;

            if (tools && tools[state.tool] && tools[state.tool].finish) {
                tools[state.tool].finish();
                render(svgCanvas);
                return;
            }

            if (!['select', 'rotate'].includes(state.tool)) return;

            const pos    = getMousePos(e, svgCanvas);
            const hitObj = hitTestObject(pos);
            if (hitObj && state.selectedObjectId === hitObj.id) {
                VectorEditor.setTool(state.tool === 'select' ? 'rotate' : 'select');
            }
        });

        // ── WHEEL ───────────────────────────────────────────────────────────────
        svgCanvas.addEventListener('wheel', e => {
            e.preventDefault();
            const { state, render } = VectorEditor;
            if (e.ctrlKey) {
                const delta = e.deltaY > 0 ? 0.9 : 1.1;
                state.zoom = Math.max(0.1, Math.min(10, state.zoom * delta));
            } else {
                state.pan.x -= e.deltaX;
                state.pan.y -= e.deltaY;
            }
            render(svgCanvas);
        }, { passive: false });
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    function getSelectionBBox() {
        const state = VectorEditor.state;
        if (state.selectedObjectIds.length > 1) {
            return VectorEditor.getMultiBoundingBox(state.selectedObjectIds);
        }
        if (state.selectedObjectId) {
            const pp = state.paperPaths[state.selectedObjectId];
            if (pp) return VectorEditor.getBoundingBox(pp);
        }
        return null;
    }

    function storeInitialTransforms() {
        const state = VectorEditor.state;
        state.initialBounds = {};
        state.selectedObjectIds.forEach(objId => {
            const pp = state.paperPaths[objId];
            if (pp) {
                const segments = pp.segments.map(seg => ({
                    x: seg.point.x, y: seg.point.y,
                    handleInX: seg.handleIn.x, handleInY: seg.handleIn.y,
                    handleOutX: seg.handleOut.x, handleOutY: seg.handleOut.y
                }));
                state.initialBounds[objId] = {
                    cx: pp.position.x, cy: pp.position.y,
                    bounds: { ...pp.bounds }, segments
                };
            }
        });
    }

    function handleResize(dx, dy) {
        const state = VectorEditor.state;
        const oldB  = state.initialBbox;
        if (!oldB) return;

        let newB = { ...oldB };
        switch (state.resizeHandle) {
            case 'e':  newB.width  = oldB.width + dx; break;
            case 'w':  newB.x = oldB.x + dx; newB.width  = oldB.width  - dx; break;
            case 's':  newB.height = oldB.height + dy; break;
            case 'n':  newB.y = oldB.y + dy; newB.height = oldB.height - dy; break;
            case 'se': newB.width = oldB.width + dx; newB.height = oldB.height + dy; break;
            case 'nw': newB.x = oldB.x + dx; newB.width = oldB.width - dx; newB.y = oldB.y + dy; newB.height = oldB.height - dy; break;
            case 'ne': newB.width = oldB.width + dx; newB.y = oldB.y + dy; newB.height = oldB.height - dy; break;
            case 'sw': newB.x = oldB.x + dx; newB.width = oldB.width - dx; newB.height = oldB.height + dy; break;
        }

        if (Math.abs(newB.width)  < 1) newB.width  = newB.width  < 0 ? -1 : 1;
        if (Math.abs(newB.height) < 1) newB.height = newB.height < 0 ? -1 : 1;

        const scaleX = newB.width  / oldB.width;
        const scaleY = newB.height / oldB.height;

        state.selectedObjectIds.forEach(objId => {
            const pp       = state.paperPaths[objId];
            const initData = state.initialBounds[objId];
            if (!pp || !initData) return;

            initData.segments.forEach((seg, i) => {
                const rx = seg.x - oldB.x;
                const ry = seg.y - oldB.y;
                pp.segments[i].point     = new paper.Point(newB.x + rx * scaleX, newB.y + ry * scaleY);
                pp.segments[i].handleIn  = new paper.Point(seg.handleInX  * scaleX, seg.handleInY  * scaleY);
                pp.segments[i].handleOut = new paper.Point(seg.handleOutX * scaleX, seg.handleOutY * scaleY);
            });

            syncPathToCore(objId);
        });
    }

    function handleRotation(pos) {
        const state  = VectorEditor.state;
        const center = state.rotationCenter;
        if (!center) return;

        const angle      = Math.atan2(pos.y - center.y, pos.x - center.x);
        const startAngle = Math.atan2(state.dragStart.y - center.y, state.dragStart.x - center.x);
        const rot = angle - startAngle;
        const cos = Math.cos(rot);
        const sin = Math.sin(rot);

        state.selectedObjectIds.forEach(objId => {
            const pp       = state.paperPaths[objId];
            const initData = state.initialBounds[objId];
            if (!pp || !initData) return;

            initData.segments.forEach((seg, i) => {
                const ox = seg.x - center.x;
                const oy = seg.y - center.y;
                pp.segments[i].point     = new paper.Point(
                    center.x + ox * cos - oy * sin,
                    center.y + ox * sin + oy * cos
                );
                pp.segments[i].handleIn  = new paper.Point(
                    seg.handleInX  * cos - seg.handleInY  * sin,
                    seg.handleInX  * sin + seg.handleInY  * cos
                );
                pp.segments[i].handleOut = new paper.Point(
                    seg.handleOutX * cos - seg.handleOutY * sin,
                    seg.handleOutX * sin + seg.handleOutY * cos
                );
            });

            syncPathToCore(objId);
        });
    }

    function syncPathToCore(objectId) {
        const state = VectorEditor.state;
        const pp    = state.paperPaths[objectId];
        if (!pp) return;
        const doc = VectorEditor.app.document;
        const obj = doc.getObject(objectId);
        if (!obj) return;
        const b = pp.bounds;
        obj.updatePathData(pp.pathData, { x: b.x, y: b.y, width: b.width, height: b.height });
    }

    // --- Exports ---
    window.VectorEditor = window.VectorEditor || {};
    window.VectorEditor.initBoard    = initBoard;
    window.VectorEditor.syncPathToCore = syncPathToCore;

})();