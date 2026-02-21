/**
 * board.js - Canvas rendering and interaction handling
 * Where paths/edges series and shapes are drawn
 */

(function() {

    // ============================================
    // RENDERING
    // ============================================

    function render(canvas) {
        const { state, getArcCurveCommand } = VectorEditor;
        
        const defs = canvas.querySelector('defs');
        canvas.innerHTML = '';
        canvas.appendChild(defs);

        state.objects.forEach(obj => renderObject(canvas, obj));

        // Render selections for all selected objects
        state.selectedObjectIds.forEach(objId => {
            const obj = state.objects.find(o => o.id === objId);
            if (obj) {
                renderSelection(canvas, obj);
            }
        });
        
        // Render gizmo for primary selected object
        if (state.selectedObjectId) {
            const obj = state.objects.find(o => o.id === state.selectedObjectId);
            if (obj) {
                renderGizmo(canvas, obj);
            }
        }
        
        if (['polyline', 'arc'].includes(state.tool)) {
            renderDrawingPreview(canvas);
        }
        
        // Render selection box if active
        if (state.selectionBox && state.isSelecting) {
            renderSelectionBox(canvas, state.selectionBox);
        }

        // Trigger UI update event
        window.dispatchEvent(new CustomEvent('vectorEditorUpdate'));
    }

    function renderObject(canvas, obj, isPreview = false) {
        const { getArcCurveCommand } = VectorEditor;
        
        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        let d = '';
        
        if (obj.points.length > 0) {
            d = `M ${obj.points[0].x} ${obj.points[0].y} `;
            
            obj.edges.forEach((edge) => {
                const p2 = obj.points[edge.points[1]];
                d += getArcCurveCommand(obj.points[edge.points[0]], p2, edge) + ' ';
            });
        }
        
        if (obj.closed) d += 'Z';

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', d);
        path.setAttribute('fill', obj.fill || 'none');
        path.setAttribute('stroke', obj.stroke);
        path.setAttribute('stroke-width', obj.strokeWidth);
        if(isPreview) path.setAttribute('opacity', '0.6');
        g.appendChild(path);
        canvas.appendChild(g);
    }

    function renderDrawingPreview(canvas) {
        const { state, dist, getArcParamsFromAngle, getArcCurveCommand } = VectorEditor;
        
        if (!state.drawingPoints || state.drawingPoints.length === 0) return;

        const pts = state.drawingPoints;
        const mouse = state.currentMouse;

        if (pts.length > 0) {
            const lineGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            lineGroup.setAttribute('stroke', state.strokeColor);
            lineGroup.setAttribute('stroke-width', state.strokeWidth);
            lineGroup.setAttribute('fill', 'none');

            let d = `M ${pts[0].x} ${pts[0].y} `;
            
            // Render existing edges
            if (state.drawingEdges) {
                state.drawingEdges.forEach((edge) => {
                    const p2 = pts[edge.points[1]];
                    d += getArcCurveCommand(pts[edge.points[0]], p2, edge) + ' ';
                });
            }
            
            // Render rubber band
            const lastPt = pts[pts.length - 1];
            if (state.tool === 'arc') {
                const params = getArcParamsFromAngle(lastPt, mouse, state.arcAngle, state.arcSweep);
                d += getArcCurveCommand(lastPt, mouse, params);
            } else {
                d += `L ${mouse.x} ${mouse.y}`;
            }
            
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('d', d);
            path.setAttribute('opacity', '0.8');
            path.setAttribute('stroke-dasharray', '5,5');
            lineGroup.appendChild(path);
            canvas.appendChild(lineGroup);
        }

        // Render points
        pts.forEach((p, i) => {
            const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            c.setAttribute('cx', p.x); c.setAttribute('cy', p.y); c.setAttribute('r', 4);
            c.setAttribute('fill', '#18181b'); c.setAttribute('stroke', '#10b981'); c.setAttribute('stroke-width', '2');
            canvas.appendChild(c);

            // Closing logic highlight
            if (i === 0 && pts.length >= 2) {
                let canClose = false;
                if (pts.length > 2) canClose = true;
                else if (pts.length === 2) {
                     const hasExistingArc = state.drawingEdges.some(e => e.type === 'arc');
                     const isCurrentArc = state.tool === 'arc';
                     if (hasExistingArc || isCurrentArc) canClose = true;
                }

                if (canClose && dist(mouse, p) < 15) {
                    c.setAttribute('r', 8); c.setAttribute('fill', '#10b981'); c.setAttribute('opacity', '0.5');
                }
            }
        });
    }

    function renderSelection(canvas, obj) {
        const { state, getArcCurveCommand, isEdgeSelected, isPointSelected, isObjectSelected } = VectorEditor;
        
        const objIsSelected = isObjectSelected(obj.id);
        
        obj.edges.forEach((edge, i) => {
            const p1 = obj.points[edge.points[0]];
            const p2 = obj.points[edge.points[1]];
            const edgeIsSelected = isEdgeSelected(obj.id, i);
            
            if (edge.type === 'arc') {
                const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                path.setAttribute('d', `M ${p1.x} ${p1.y} ` + getArcCurveCommand(p1, p2, edge));
                path.setAttribute('fill', 'none');
                path.setAttribute('stroke', edgeIsSelected ? '#f59e0b' : (objIsSelected ? '#10b981' : '#3b82f6'));
                path.setAttribute('stroke-width', edgeIsSelected ? 6 : 4);
                path.setAttribute('stroke-linecap', 'round');
                path.setAttribute('opacity', '0.5');
                path.setAttribute('data-edge-index', i);
                path.setAttribute('data-object-id', obj.id);
                path.style.cursor = 'move';
                canvas.appendChild(path);
            } else {
                const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                line.setAttribute('x1', p1.x); line.setAttribute('y1', p1.y);
                line.setAttribute('x2', p2.x); line.setAttribute('y2', p2.y);
                line.setAttribute('stroke', edgeIsSelected ? '#f59e0b' : (objIsSelected ? '#10b981' : '#3b82f6'));
                line.setAttribute('stroke-width', edgeIsSelected ? 6 : 4);
                line.setAttribute('stroke-linecap', 'round');
                line.setAttribute('opacity', '0.5');
                line.setAttribute('data-edge-index', i);
                line.setAttribute('data-object-id', obj.id);
                line.style.cursor = 'move';
                canvas.appendChild(line);
            }
        });

        obj.points.forEach((p, i) => {
            const pointIsSelected = isPointSelected(obj.id, i);
            const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            c.setAttribute('cx', p.x); c.setAttribute('cy', p.y); c.setAttribute('r', 5);
            c.setAttribute('fill', pointIsSelected ? '#f59e0b' : '#18181b');
            c.setAttribute('stroke', pointIsSelected ? '#f59e0b' : (objIsSelected ? '#10b981' : '#3b82f6'));
            c.setAttribute('stroke-width', '2');
            c.setAttribute('data-point-index', i);
            c.setAttribute('data-object-id', obj.id);
            c.style.cursor = 'move';
            canvas.appendChild(c);
        });
    }
    
    function renderSelectionBox(canvas, box) {
        // Normalize the box to handle all drag directions
        const normalizedBox = {
            x: box.width < 0 ? box.x + box.width : box.x,
            y: box.height < 0 ? box.y + box.height : box.y,
            width: Math.abs(box.width),
            height: Math.abs(box.height)
        };
        
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', normalizedBox.x);
        rect.setAttribute('y', normalizedBox.y);
        rect.setAttribute('width', normalizedBox.width);
        rect.setAttribute('height', normalizedBox.height);
        rect.setAttribute('fill', 'rgba(16, 185, 129, 0.1)');
        rect.setAttribute('stroke', '#10b981');
        rect.setAttribute('stroke-width', '1');
        rect.setAttribute('stroke-dasharray', '4,4');
        canvas.appendChild(rect);
    }

    function renderGizmo(canvas, obj) {
        const { state, getTransformedBoundingBox } = VectorEditor;
        
        const bbox = getTransformedBoundingBox(obj);
        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', bbox.x); rect.setAttribute('y', bbox.y);
        rect.setAttribute('width', bbox.width); rect.setAttribute('height', bbox.height);
        rect.setAttribute('fill', 'none'); rect.setAttribute('stroke', '#10b981');
        rect.setAttribute('stroke-width', '1'); rect.setAttribute('stroke-dasharray', '4,4');
        g.appendChild(rect);

        if (state.tool === 'select') {
            const handles = [
                { n: 'nw', x: bbox.x, y: bbox.y }, { n: 'n', x: bbox.x + bbox.width/2, y: bbox.y },
                { n: 'ne', x: bbox.x + bbox.width, y: bbox.y }, { n: 'e', x: bbox.x + bbox.width, y: bbox.y + bbox.height/2 },
                { n: 'se', x: bbox.x + bbox.width, y: bbox.y + bbox.height }, { n: 's', x: bbox.x + bbox.width/2, y: bbox.y + bbox.height },
                { n: 'sw', x: bbox.x, y: bbox.y + bbox.height }, { n: 'w', x: bbox.x, y: bbox.y + bbox.height/2 }
            ];
            handles.forEach(h => {
                const r = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                r.setAttribute('x', h.x-4); r.setAttribute('y', h.y-4);
                r.setAttribute('width', 8); r.setAttribute('height', 8);
                r.setAttribute('fill', '#18181b'); r.setAttribute('stroke', '#10b981');
                r.setAttribute('stroke-width', '1.5');
                r.setAttribute('data-handle', h.n);
                r.style.cursor = h.n + '-resize';
                g.appendChild(r);
            });
        }

        if (state.tool === 'rotate') {
             const rotHandle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
             rotHandle.setAttribute('cx', bbox.x + bbox.width/2);
             rotHandle.setAttribute('cy', bbox.y - 25);
             rotHandle.setAttribute('r', 6);
             rotHandle.setAttribute('fill', '#18181b'); rotHandle.setAttribute('stroke', '#f59e0b'); rotHandle.setAttribute('stroke-width', '2');
             rotHandle.style.cursor = 'grab';
             g.appendChild(rotHandle);
             
             const l = document.createElementNS('http://www.w3.org/2000/svg', 'line');
             l.setAttribute('x1', bbox.x + bbox.width/2); l.setAttribute('y1', bbox.y);
             l.setAttribute('x2', bbox.x + bbox.width/2); l.setAttribute('y2', bbox.y - 25);
             l.setAttribute('stroke', '#f59e0b'); l.setAttribute('stroke-dasharray', '2,2');
             g.appendChild(l);
        }
        canvas.appendChild(g);
    }

    function renderPreview(canvas, pos) {
        const { state, createRectangle, createCircle, createPolygon } = VectorEditor;
        
        if (!state.isDrawing) return;
        const dx = pos.x - state.dragStart.x;
        const dy = pos.y - state.dragStart.y;
        let previewObj = null;

        if (state.tool === 'rectangle') previewObj = createRectangle(Math.min(pos.x, state.dragStart.x), Math.min(pos.y, state.dragStart.y), Math.abs(dx), Math.abs(dy));
        else if (state.tool === 'circle') previewObj = createCircle(state.dragStart.x, state.dragStart.y, Math.sqrt(dx*dx+dy*dy));
        else if (state.tool === 'polygon') previewObj = createPolygon(state.dragStart.x, state.dragStart.y, Math.sqrt(dx*dx+dy*dy), state.polygonSides);

        if (previewObj) renderObject(canvas, previewObj, true);
    }

    // ============================================
    // DRAWING FINALIZATION
    // ============================================

    function finishDrawing(canvas, closed) {
        const { state, generateId, getArcParamsFromAngle, selectObject } = VectorEditor;
        
        if (!state.drawingPoints || state.drawingPoints.length < 2) {
            state.drawingPoints = null;
            state.drawingEdges = null;
            render(canvas);
            return;
        }

        const id = generateId();
        const pts = state.drawingPoints;
        const edges = state.drawingEdges;

        if (closed) {
            const lastIdx = pts.length - 1;
            const edgeDef = {
                points: [lastIdx, 0],
                type: state.tool === 'arc' ? 'arc' : 'line'
            };
            if (state.tool === 'arc') {
                 const params = getArcParamsFromAngle(pts[lastIdx], pts[0], state.arcAngle, state.arcSweep);
                 Object.assign(edgeDef, params);
            }
            edges.push(edgeDef);
        }

        const obj = {
            id, 
            type: 'path', 
            name: closed ? 'Shape' : 'Path',
            points: JSON.parse(JSON.stringify(pts)),
            edges: JSON.parse(JSON.stringify(edges)),
            closed,
            fill: closed ? state.fillColor : 'none',
            stroke: state.strokeColor,
            strokeWidth: state.strokeWidth
        };

        state.objects.push(obj);
        selectObject(obj.id, false);
        state.drawingPoints = null;
        state.drawingEdges = null;
        render(canvas);
    }

    // ============================================
    // EVENT HANDLING
    // ============================================

    function initBoard(canvas) {
        // Mouse down handler
        canvas.addEventListener('mousedown', e => {
            if (e.button !== 0) return;

            const { 
                state, getMousePos, dist, getTransformedBoundingBox, 
                getArcParamsFromAngle, hitTestObject, hitTestEdge, 
                hitTestHandle, hitTestPoint, createRectangle, 
                createCircle, createPolygon, setTool,
                clearSelections, selectObject, selectPoint, selectPointRange,
                selectEdge, selectEdgeRange,
                toggleObjectSelection, togglePointSelection, toggleEdgeSelection,
                isObjectSelected, isPointSelected, isEdgeSelected
            } = VectorEditor;

            const pos = getMousePos(e, canvas);
            state.dragStart = pos;
            state.initialPoints = {};
            state.initialEdges = {};
            
            // Check modifier keys for multi-selection
            const isCtrlClick = e.ctrlKey || e.metaKey;
            const isShiftClick = e.shiftKey;

            // --- Drawing Tools Logic ---
            if (['polyline', 'arc'].includes(state.tool)) {
                if (!state.drawingPoints) {
                    state.drawingPoints = [];
                    state.drawingEdges = [];
                }
                
                const pts = state.drawingPoints;
                
                // Check for closing
                if (pts.length >= 2 && dist(pos, pts[0]) < 15) {
                    let canClose = false;
                    
                    if (pts.length > 2) canClose = true;
                    
                    if (pts.length === 2) {
                        const existingIsArc = state.drawingEdges.length > 0 && state.drawingEdges[0].type === 'arc';
                        const currentIsArc = state.tool === 'arc';
                        
                        if (existingIsArc || currentIsArc) canClose = true;
                    }

                    if (canClose) {
                        finishDrawing(canvas, true);
                        return;
                    }
                }

                const newPt = {x: pos.x, y: pos.y};
                
                if (pts.length > 0) {
                    const lastIdx = pts.length - 1;
                    const edgeDef = {
                        points: [lastIdx, lastIdx + 1],
                        type: state.tool === 'arc' ? 'arc' : 'line'
                    };
                    if (state.tool === 'arc') {
                        const params = getArcParamsFromAngle(pts[lastIdx], newPt, state.arcAngle, state.arcSweep);
                        Object.assign(edgeDef, params);
                    }
                    state.drawingEdges.push(edgeDef);
                }

                state.drawingPoints.push(newPt);
                render(canvas);
                return;
            }

            const selObj = state.objects.find(o => o.id === state.selectedObjectId);

            if (selObj && state.tool === 'select') {
                const bbox = getTransformedBoundingBox(selObj);
                const handle = hitTestHandle(pos, bbox);
                if (handle) {
                    state.interaction = 'resize';
                    state.resizeHandle = handle;
                    state.initialBbox = bbox;
                    state.initialPoints[selObj.id] = JSON.parse(JSON.stringify(selObj.points));
                    state.initialEdges[selObj.id] = JSON.parse(JSON.stringify(selObj.edges));
                    return;
                }
            }

            if (selObj && state.tool === 'rotate') {
                const bbox = getTransformedBoundingBox(selObj);
                const rotPos = { x: bbox.x + bbox.width/2, y: bbox.y - 25 };
                if (dist(pos, rotPos) < 10) {
                    state.interaction = 'rotate';
                    state.initialPoints[selObj.id] = JSON.parse(JSON.stringify(selObj.points));
                    state.initialEdges[selObj.id] = JSON.parse(JSON.stringify(selObj.edges));
                    state.rotationCenter = { x: bbox.x + bbox.width/2, y: bbox.y + bbox.height/2 };
                    return;
                }
            }

            // --- Point hit testing with multi-selection ---
            // Check all selected objects for point hits
            let pointHit = null;
            for (const objId of state.selectedObjectIds) {
                const obj = state.objects.find(o => o.id === objId);
                if (obj) {
                    const ptIdx = hitTestPoint(pos, obj);
                    if (ptIdx !== null) {
                        pointHit = { obj, ptIdx };
                        break;
                    }
                }
            }
            
            if (pointHit) {
                const { obj, ptIdx } = pointHit;
                if (isCtrlClick) {
                    togglePointSelection(obj.id, ptIdx);
                } else if (isShiftClick && state.selectedPointIndex !== null && state.selectedObjectId === obj.id) {
                    // Range selection for points
                    selectPointRange(obj.id, state.selectedPointIndex, ptIdx);
                } else {
                    selectPoint(obj.id, ptIdx, isShiftClick);
                }
                state.interaction = 'point';
                // Store initial points for all selected objects
                state.selectedObjectIds.forEach(objId => {
                    const o = state.objects.find(ob => ob.id === objId);
                    if (o) state.initialPoints[objId] = JSON.parse(JSON.stringify(o.points));
                });
                render(canvas);
                return;
            }

            // --- Edge hit testing with multi-selection ---
            let edgeHit = null;
            for (const objId of state.selectedObjectIds) {
                const obj = state.objects.find(o => o.id === objId);
                if (obj) {
                    const edgeIdx = hitTestEdge(pos, obj);
                    if (edgeIdx !== null) {
                        edgeHit = { obj, edgeIdx };
                        break;
                    }
                }
            }
            
            if (edgeHit) {
                const { obj, edgeIdx } = edgeHit;
                const edge = obj.edges[edgeIdx];
                
                if (isCtrlClick) {
                    toggleEdgeSelection(obj.id, edgeIdx);
                } else if (isShiftClick && state.selectedEdgeIndex !== null && state.selectedObjectId === obj.id) {
                    // Range selection for edges
                    selectEdgeRange(obj.id, state.selectedEdgeIndex, edgeIdx);
                } else {
                    selectEdge(obj.id, edgeIdx, isShiftClick);
                }
                
                if (edge.type === 'arc') {
                    state.interaction = 'adjust-arc';
                    state.initialEdges[obj.id] = JSON.parse(JSON.stringify(obj.edges));
                } else {
                    state.interaction = 'edge';
                    // Store initial points for all selected objects
                    state.selectedObjectIds.forEach(objId => {
                        const o = state.objects.find(ob => ob.id === objId);
                        if (o) state.initialPoints[objId] = JSON.parse(JSON.stringify(o.points));
                    });
                }
                render(canvas);
                return;
            }

            // --- Object hit testing with multi-selection ---
            const hitObj = hitTestObject(pos);
            if (hitObj) {
                if (isCtrlClick) {
                    toggleObjectSelection(hitObj.id);
                } else if (isShiftClick) {
                    selectObject(hitObj.id, true);
                } else {
                    // Double-click to toggle between select/rotate
                    if (state.selectedObjectId === hitObj.id) {
                        if (state.tool === 'select') setTool('rotate');
                        else if (state.tool === 'rotate') setTool('select');
                    } else {
                        selectObject(hitObj.id, false);
                    }
                }
                state.interaction = 'move';
                // Store initial points for all selected objects
                state.selectedObjectIds.forEach(objId => {
                    const o = state.objects.find(ob => ob.id === objId);
                    if (o) state.initialPoints[objId] = JSON.parse(JSON.stringify(o.points));
                });
                render(canvas);
            } else {
                // --- Start marquee selection ---
                if (['select', 'rotate'].includes(state.tool)) {
                    state.isSelecting = true;
                    state.selectionBox = { x: pos.x, y: pos.y, width: 0, height: 0 };
                    if (!isCtrlClick && !isShiftClick) {
                        clearSelections();
                    }
                } else if (['rectangle', 'circle', 'polygon'].includes(state.tool)) {
                    state.isDrawing = true;
                    clearSelections();
                } else {
                    clearSelections();
                }
                render(canvas);
            }
        });

        // Mouse move handler
        canvas.addEventListener('mousemove', e => {
            const { state, getMousePos, dist, selectInBox } = VectorEditor;
            
            const pos = getMousePos(e, canvas);
            state.currentMouse = pos;
            
            // Update status bar
            const mousePosEl = document.getElementById('mousePos');
            if (mousePosEl) mousePosEl.textContent = `${Math.round(pos.x)}, ${Math.round(pos.y)}`;

            if (['polyline', 'arc'].includes(state.tool) && state.drawingPoints) {
                render(canvas);
                return;
            }

            if (state.isDrawing) {
                render(canvas);
                renderPreview(canvas, pos);
                return;
            }
            
            // Handle marquee selection
            if (state.isSelecting && state.selectionBox) {
                const box = state.selectionBox;
                box.width = pos.x - state.dragStart.x;
                box.height = pos.y - state.dragStart.y;
                render(canvas);
                return;
            }

            const obj = state.objects.find(o => o.id === state.selectedObjectId);
            if (!obj || !state.interaction) return;

            const dx = pos.x - state.dragStart.x;
            const dy = pos.y - state.dragStart.y;

            if (state.interaction === 'move') {
                // Move all selected objects
                state.selectedObjectIds.forEach(objId => {
                    const selObj = state.objects.find(o => o.id === objId);
                    if (selObj && state.initialPoints[objId]) {
                        const initialPts = state.initialPoints[objId];
                        for(let i=0; i<selObj.points.length; i++) {
                            selObj.points[i].x = initialPts[i].x + dx;
                            selObj.points[i].y = initialPts[i].y + dy;
                        }
                    }
                });
                render(canvas);
            } 
            else if (state.interaction === 'point') {
                // Move all selected points
                state.selectedPointIndices.forEach(({objectId, pointIndex}) => {
                    const selObj = state.objects.find(o => o.id === objectId);
                    if (selObj && state.initialPoints[objectId]) {
                        selObj.points[pointIndex].x = state.initialPoints[objectId][pointIndex].x + dx;
                        selObj.points[pointIndex].y = state.initialPoints[objectId][pointIndex].y + dy;
                    }
                });
                render(canvas);
            }
            else if (state.interaction === 'edge') {
                // Move all selected edges
                state.selectedEdgeIndices.forEach(({objectId, edgeIndex}) => {
                    const selObj = state.objects.find(o => o.id === objectId);
                    if (selObj && state.initialPoints[objectId]) {
                        const edge = selObj.edges[edgeIndex];
                        edge.points.forEach(ptIdx => {
                            selObj.points[ptIdx].x = state.initialPoints[objectId][ptIdx].x + dx;
                            selObj.points[ptIdx].y = state.initialPoints[objectId][ptIdx].y + dy;
                        });
                    }
                });
                render(canvas);
            }
            else if (state.interaction === 'adjust-arc') {
                const edge = obj.edges[state.selectedEdgeIndex];
                const p1 = obj.points[edge.points[0]];
                const p2 = obj.points[edge.points[1]];
                
                const vx = p2.x - p1.x;
                const vy = p2.y - p1.y;
                const ux = pos.x - p1.x;
                const uy = pos.y - p1.y;
                const cross = vx * uy - vy * ux;
                
                const isLeft = cross > 0;
                const expectedSweep = isLeft ? 0 : 1;
                
                if (edge.sweep !== expectedSweep) {
                    edge.sweep = expectedSweep;
                }
                
                const d = dist(p1, p2);
                if(d > 0) {
                    const distLine = cross / d; 
                    const bulge = Math.abs(distLine);
                    const h = Math.max(1, bulge);
                    const R = (d*d)/(8*h) + h/2;
                    
                    edge.rx = R;
                    edge.ry = R;
                    edge.largeArc = 0; 
                }
                
                render(canvas);
            }
            else if (state.interaction === 'resize') {
                const oldB = state.initialBbox;
                let newB = { ...oldB };

                switch(state.resizeHandle) {
                    case 'e': newB.width = oldB.width + dx; break;
                    case 'w': newB.x = oldB.x + dx; newB.width = oldB.width - dx; break;
                    case 's': newB.height = oldB.height + dy; break;
                    case 'n': newB.y = oldB.y + dy; newB.height = oldB.height - dy; break;
                    case 'se': newB.width = oldB.width + dx; newB.height = oldB.height + dy; break;
                    case 'nw': newB.x = oldB.x + dx; newB.width = oldB.width - dx; newB.y = oldB.y + dy; newB.height = oldB.height - dy; break;
                    case 'ne': newB.width = oldB.width + dx; newB.y = oldB.y + dy; newB.height = oldB.height - dy; break;
                    case 'sw': newB.x = oldB.x + dx; newB.width = oldB.width - dx; newB.height = oldB.height + dy; break;
                }

                const scaleX = newB.width / oldB.width;
                const scaleY = newB.height / oldB.height;

                for(let i=0; i<obj.points.length; i++) {
                    const pOld = state.initialPoints[obj.id][i];
                    const rx = pOld.x - oldB.x;
                    const ry = pOld.y - oldB.y;
                    obj.points[i].x = newB.x + rx * scaleX;
                    obj.points[i].y = newB.y + ry * scaleY;
                }

                obj.edges.forEach((edge, i) => {
                    if (edge.type === 'arc') {
                        const oldEdge = state.initialEdges[obj.id][i];
                        edge.rx = Math.abs((oldEdge.rx || 0) * scaleX);
                        edge.ry = Math.abs((oldEdge.ry || 0) * scaleY);
                        
                        if ((scaleX < 0) !== (scaleY < 0)) {
                            edge.sweep = oldEdge.sweep === 1 ? 0 : 1;
                        } else {
                            edge.sweep = oldEdge.sweep;
                        }
                    }
                });

                render(canvas);
            }
            else if (state.interaction === 'rotate') {
                const center = state.rotationCenter;
                const angle = Math.atan2(pos.y - center.y, pos.x - center.x);
                const startAngle = Math.atan2(state.dragStart.y - center.y, state.dragStart.x - center.x);
                const rot = angle - startAngle;

                const cos = Math.cos(rot), sin = Math.sin(rot);
                obj.points.forEach((p, i) => {
                    const ox = state.initialPoints[obj.id][i].x - center.x;
                    const oy = state.initialPoints[obj.id][i].y - center.y;
                    p.x = center.x + ox * cos - oy * sin;
                    p.y = center.y + ox * sin + oy * cos;
                });
                render(canvas);
            }
        });

        // Mouse up handler
        canvas.addEventListener('mouseup', e => {
            const { state, getMousePos, createRectangle, createCircle, createPolygon, selectInBox } = VectorEditor;
            
            const pos = getMousePos(e, canvas);
            
            // Handle marquee selection completion
            if (state.isSelecting && state.selectionBox) {
                const box = state.selectionBox;
                // Normalize box (handle negative width/height)
                const normalizedBox = {
                    x: box.width < 0 ? box.x + box.width : box.x,
                    y: box.height < 0 ? box.y + box.height : box.y,
                    width: Math.abs(box.width),
                    height: Math.abs(box.height)
                };
                
                if (normalizedBox.width > 5 || normalizedBox.height > 5) {
                    const isCtrlClick = e.ctrlKey || e.metaKey;
                    const isShiftClick = e.shiftKey;
                    selectInBox(normalizedBox, isCtrlClick || isShiftClick);
                }
                
                state.isSelecting = false;
                state.selectionBox = null;
                render(canvas);
                return;
            }
            
            if (state.isDrawing) {
                const dx = pos.x - state.dragStart.x;
                const dy = pos.y - state.dragStart.y;
                if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
                    let obj;
                    const x = Math.min(pos.x, state.dragStart.x);
                    const y = Math.min(pos.y, state.dragStart.y);
                    const w = Math.abs(dx);
                    const h = Math.abs(dy);
                    
                    if (state.tool === 'rectangle') obj = createRectangle(x, y, w, h);
                    else if (state.tool === 'circle') obj = createCircle(state.dragStart.x, state.dragStart.y, Math.sqrt(dx*dx+dy*dy));
                    else if (state.tool === 'polygon') obj = createPolygon(state.dragStart.x, state.dragStart.y, Math.sqrt(dx*dx+dy*dy), state.polygonSides);
                    
                    if (obj) {
                        state.objects.push(obj);
                        selectObject(obj.id, false);
                    }
                }
            }

            state.isDrawing = false;
            state.interaction = null;
            state.initialPoints = {};
            state.initialEdges = {};
            
            render(canvas);
        });

        // Context menu handler
        canvas.addEventListener('contextmenu', e => {
            const { state, getMousePos, hitTestObject, selectObject } = VectorEditor;
            
            e.preventDefault();
            
            if (['polyline', 'arc'].includes(state.tool) && state.drawingPoints && state.drawingPoints.length > 0) {
                state.drawingPoints.pop();
                if(state.drawingEdges.length > 0) state.drawingEdges.pop();
                if (state.drawingPoints.length === 0) {
                    state.drawingPoints = null;
                    state.drawingEdges = null;
                }
                render(canvas);
                return;
            }

            const pos = getMousePos(e, canvas);
            const hit = hitTestObject(pos);
            if(hit) {
                selectObject(hit.id, false);
                render(canvas);
                
                const contextMenu = document.getElementById('contextMenu');
                if (contextMenu) {
                    contextMenu.style.left = e.clientX + 'px';
                    contextMenu.style.top = e.clientY + 'px';
                    contextMenu.classList.add('visible');
                }
            }
        });
    }

    // ============================================
    // EXPORTS
    // ============================================

    window.VectorEditor = window.VectorEditor || {};
    window.VectorEditor.render = render;
    window.VectorEditor.renderObject = renderObject;
    window.VectorEditor.renderPreview = renderPreview;
    window.VectorEditor.finishDrawing = finishDrawing;
    window.VectorEditor.initBoard = initBoard;

})();
