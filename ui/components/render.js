/**
 * render.js  —  /ui layer
 *
 * SVG projection of application state.
 * Modifier-aware: delegates to ModifierEngine before rendering each object.
 * All changes happen through commands — this file is read-only w.r.t. state.
 */
(function () {

    /* ── helpers ────────────────────────────────────────────────────────── */

    function svg (tag, attrs) {
        const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
        for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
        return el;
    }

    /* ── main render ─────────────────────────────────────────────────────── */

    function render (svgCanvas) {
        const state   = VectorEditor.state;
        const doc     = VectorEditor.app.document;
        const objects = doc.getAllObjects();

        // Preserve <defs>
        const defs = svgCanvas.querySelector('defs');
        svgCanvas.innerHTML = '';
        if (defs) svgCanvas.appendChild(defs);

        const g = svg('g', { transform: `translate(${state.pan.x||0},${state.pan.y||0}) scale(${state.zoom||1})` });

        // ── Objects ───────────────────────────────────────────────────────
        objects.forEach(obj => {
            const modEngine = VectorEditor.ModifierEngine;
            const modPaths  = modEngine ? modEngine.computeDisplayPaths(obj.id) : null;

            if (modPaths && modPaths.length > 0) {
                modPaths.forEach(mp => {
                    g.appendChild(svg('path', {
                        d: mp.pathData || '', fill: mp.fill || 'none',
                        stroke: mp.stroke || '#fff', 'stroke-width': mp.strokeWidth || 2,
                        class: 'svg-shape', 'data-id': obj.id
                    }));
                });
            } else {
                _renderObject(g, obj);
            }
        });

        // ── Selection highlights (dashed bbox) ────────────────────────────
        state.selectedObjectIds.forEach(id => {
            const pp = state.paperPaths[id];
            if (pp) {
                const b = pp.bounds;
                g.appendChild(svg('rect', {
                    x: b.x, y: b.y, width: b.width, height: b.height,
                    fill: 'none', stroke: '#10b981', 'stroke-width': '1',
                    'stroke-dasharray': '4 4', opacity: '0.5'
                }));
            }
        });

        // ── Gizmo (resize / rotate handles) ──────────────────────────────
        if (state.selectedObjectId && state.paperPaths[state.selectedObjectId]) {
            const bbox = _selBounds();
            if (bbox) _renderGizmo(g, bbox);
        }

        // ── Pivot Point gizmo ───────────────────────────────────────────
        state.selectedObjectIds.forEach(id => {
            const registry = VectorEditor.app?.modifierRegistry;
            if (!registry) return;
            const stack = registry.getStack(id);
            for (const mod of stack) {
                if (mod.type === 'pivot-point' && mod.visible && mod.params.showGizmo !== false) {
                    const ppMod = VectorEditor.Modifiers?.['pivot-point'];
                    if (ppMod && ppMod.computePivot) {
                        const pivot = ppMod.computePivot(id, mod.params);
                        if (pivot) _renderPivotGizmo(g, pivot);
                    }
                    break;
                }
            }
        });

        // ── Freehand start indicator ──────────────────────────────────────
        if (state.isDrawing && state.freehandStartPos) {
            _renderFreehandStart(g, state.freehandStartPos, state.currentMouse);
        }

        // ── Drawing engine session preview ────────────────────────────────
        if (VectorEditor.drawingEngine && VectorEditor.drawingEngine.isActive()) {
            VectorEditor.drawingEngine.renderDrawingSession(g);
        }

        // ── Legacy freehand path preview ──────────────────────────────────
        if (state.isDrawing && state.drawingPath) {
            const d = state.drawingPath.pathData;
            if (d) g.appendChild(svg('path', { d, fill: 'none', stroke: '#00d4aa', 'stroke-width': '2', 'stroke-dasharray': '6 3' }));
        }

        // ── Pen preview ───────────────────────────────────────────────────
        if (state.penPoints && state.penPoints.length > 0) _renderPenPreview(g);

        // ── Marquee ───────────────────────────────────────────────────────
        if (state.isSelecting && state.selectionBox) {
            const b = state.selectionBox;
            const nb = {
                x: b.width  < 0 ? b.x + b.width  : b.x,
                y: b.height < 0 ? b.y + b.height : b.y,
                width: Math.abs(b.width), height: Math.abs(b.height)
            };
            g.appendChild(svg('rect', {
                x: nb.x, y: nb.y, width: nb.width, height: nb.height,
                fill: 'rgba(16,185,129,0.1)', stroke: '#10b981',
                'stroke-width': '1', 'stroke-dasharray': '4,4'
            }));
        }

        svgCanvas.appendChild(g);
        window.dispatchEvent(new CustomEvent('vectorEditorUpdate'));
    }

    /* ── single object ───────────────────────────────────────────────────── */

    function _renderObject (parent, obj) {
        const state = VectorEditor.state;
        const pp    = state.paperPaths[obj.id];
        if (!pp) return;

        const grp        = svg('g', {});
        const isSelected = VectorEditor.isObjectSelected(obj.id);

        grp.appendChild(svg('path', {
            d: pp.pathData, fill: obj.fill || 'none',
            stroke: obj.stroke || '#ffffff', 'stroke-width': obj.strokeWidth || 2,
            class: 'svg-shape', 'data-id': obj.id
        }));

        if (isSelected) {
            // Selected segment highlights
            state.selectedSegmentIndices
                .filter(s => s.objectId === obj.id)
                .forEach(({ segmentIndex }) => _renderCurveHighlight(grp, pp, segmentIndex, '#3b82f6', 3, 0.75));

            // Adjacent segment highlights for selected points
            state.selectedPointIndices
                .filter(p => p.objectId === obj.id)
                .forEach(({ pointIndex }) => {
                    const n = pp.curves?.length || 0;
                    if (!n) return;
                    _renderCurveHighlight(grp, pp, pointIndex % n, '#6366f1', 2, 0.35);
                    if (pp.closed || pointIndex > 0)
                        _renderCurveHighlight(grp, pp, (pointIndex - 1 + n) % n, '#6366f1', 2, 0.35);
                });

            // Bezier handle arms + dots for selected anchor points
            state.selectedPointIndices
                .filter(p => p.objectId === obj.id)
                .forEach(({ pointIndex }) => _renderHandles(grp, pp, pointIndex));

            // Anchor gizmos for all segments
            pp.segments.forEach((seg, i) => {
                const ptSel = VectorEditor.isPointSelected(obj.id, i);
                const segSel= state.selectedSegmentIndices.some(s =>
                    s.objectId === obj.id &&
                    (s.segmentIndex === i ||
                     s.segmentIndex === (i - 1 + Math.max(1, pp.curves?.length||1)) % Math.max(1, pp.curves?.length||1))
                );
                _renderAnchorGizmo(grp, seg.point.x, seg.point.y,
                    _pointType(obj.id, i, pp), ptSel || segSel);
            });
        }

        parent.appendChild(grp);
    }

    /* ── curve highlight ─────────────────────────────────────────────────── */

    function _renderCurveHighlight (g, pp, idx, color, width, opacity) {
        if (!pp.curves || idx >= pp.curves.length) return;
        const curve = pp.curves[idx];
        if (!curve) return;
        const s1 = curve.segment1.point, s2 = curve.segment2.point;
        const h1 = curve.segment1.handleOut, h2 = curve.segment2.handleIn;
        const curved = Math.abs(h1.x) > 0.5 || Math.abs(h1.y) > 0.5 ||
                       Math.abs(h2.x) > 0.5 || Math.abs(h2.y) > 0.5;
        const d = `M ${s1.x} ${s1.y}` + (curved
            ? ` C ${s1.x+h1.x} ${s1.y+h1.y} ${s2.x+h2.x} ${s2.y+h2.y} ${s2.x} ${s2.y}`
            : ` L ${s2.x} ${s2.y}`);
        g.appendChild(svg('path', { d, fill: 'none', stroke: color, 'stroke-width': width, opacity }));
    }

    /* ── bezier handles ──────────────────────────────────────────────────── */

    function _renderHandles (g, pp, idx) {
        const seg = pp.segments[idx];
        if (!seg) return;
        const pt = seg.point;
        for (const hk of ['handleIn', 'handleOut']) {
            const h = seg[hk];
            if (!h) continue;
            const mag = Math.hypot(h.x, h.y);
            if (mag <= 1) continue;
            const hx = pt.x + h.x, hy = pt.y + h.y;
            g.appendChild(svg('line', { x1: pt.x, y1: pt.y, x2: hx, y2: hy,
                stroke: '#f59e0b', 'stroke-width': '1.5', 'stroke-dasharray': '3 2', opacity: '0.8' }));
            const dot = svg('circle', { cx: hx, cy: hy, r: '5',
                fill: '#f59e0b', stroke: '#0d0d0f', 'stroke-width': '1.5', class: 'bezier-handle-dot' });
            g.appendChild(dot);
        }
    }

    /* ── anchor gizmo (per segment type) ────────────────────────────────── */

    function _pointType (objectId, idx, pp) {
        const meta = VectorEditor.state.shapeMetadata[objectId];
        if (!meta) {
            const seg = pp.segments[idx];
            if (!seg) return 'line';
            const hi = seg.handleIn  ? Math.hypot(seg.handleIn.x,  seg.handleIn.y)  : 0;
            const ho = seg.handleOut ? Math.hypot(seg.handleOut.x, seg.handleOut.y) : 0;
            return (hi > 2 || ho > 2) ? 'cubic' : 'line';
        }
        const n   = meta.segmentTypes.length;
        const out = idx < n ? meta.segmentTypes[idx] : null;
        const inn = meta.closed ? meta.segmentTypes[(idx - 1 + n) % n]
                  : (idx > 0 && idx - 1 < n) ? meta.segmentTypes[idx - 1] : null;
        if (out === 'arc'       || inn === 'arc')       return 'arc';
        if (out === 'cubic'     || inn === 'cubic')     return 'cubic';
        if (out === 'quadratic' || inn === 'quadratic') return 'quadratic';
        return 'line';
    }

    function _renderAnchorGizmo (g, cx, cy, type, selected) {
        const fill   = selected ? '#10b981' : '#18181b';
        const stroke = selected ? '#0d0d0f' : '#10b981';
        const sw     = selected ? '2' : '1.5';
        switch (type) {
            case 'cubic':
                g.appendChild(svg('circle', { cx, cy, r: '5', fill, stroke, 'stroke-width': sw }));
                break;
            case 'quadratic':
                g.appendChild(svg('path', { d: `M ${cx},${cy-6} L ${cx+6},${cy} L ${cx},${cy+6} L ${cx-6},${cy} Z`, fill, stroke, 'stroke-width': sw }));
                break;
            case 'arc':
                g.appendChild(svg('path', { d: `M ${cx},${cy-6} L ${cx+5},${cy+4} L ${cx-5},${cy+4} Z`, fill, stroke, 'stroke-width': sw }));
                break;
            default: // line → square
                g.appendChild(svg('rect', { x: cx-4, y: cy-4, width: 8, height: 8, fill, stroke, 'stroke-width': sw }));
        }
    }

    /* ── freehand start indicator ────────────────────────────────────────── */

    function _renderFreehandStart (g, startPos, mouse) {
        const near = mouse && Math.hypot(mouse.x - startPos.x, mouse.y - startPos.y) < 24;
        const grp  = svg('g', {});
        grp.appendChild(svg('circle', {
            cx: startPos.x, cy: startPos.y, r: near ? '14' : '8',
            fill: 'rgba(16,185,129,0.15)', stroke: '#10b981',
            'stroke-width': near ? '2' : '1', 'stroke-dasharray': '3 2'
        }));
        grp.appendChild(svg('circle', {
            cx: startPos.x, cy: startPos.y, r: '4',
            fill: near ? '#10b981' : '#0d0d0f', stroke: '#10b981', 'stroke-width': '2'
        }));
        g.appendChild(grp);
    }

    /* ── gizmo ───────────────────────────────────────────────────────────── */

    function _selBounds () {
        const state = VectorEditor.state;
        if (state.selectedObjectIds.length > 1) return VectorEditor.getMultiBoundingBox(state.selectedObjectIds);
        const pp = state.paperPaths[state.selectedObjectId];
        return pp ? VectorEditor.getBoundingBox(pp) : null;
    }

    function _renderGizmo (parent, bbox) {
        const state = VectorEditor.state;
        const grp   = svg('g', { class: 'gizmo' });

        grp.appendChild(svg('rect', {
            x: bbox.x, y: bbox.y, width: bbox.width, height: bbox.height,
            fill: 'none', stroke: '#10b981', 'stroke-width': '1', 'stroke-dasharray': '4,4'
        }));

        if (state.tool === 'select') {
            [
                { n:'nw', x: bbox.x,                  y: bbox.y },
                { n:'n',  x: bbox.x + bbox.width / 2, y: bbox.y },
                { n:'ne', x: bbox.x + bbox.width,      y: bbox.y },
                { n:'e',  x: bbox.x + bbox.width,      y: bbox.y + bbox.height / 2 },
                { n:'se', x: bbox.x + bbox.width,      y: bbox.y + bbox.height },
                { n:'s',  x: bbox.x + bbox.width / 2,  y: bbox.y + bbox.height },
                { n:'sw', x: bbox.x,                   y: bbox.y + bbox.height },
                { n:'w',  x: bbox.x,                   y: bbox.y + bbox.height / 2 }
            ].forEach(h => {
                const r = svg('rect', { x: h.x-4, y: h.y-4, width: 8, height: 8,
                    fill: '#18181b', stroke: '#10b981', 'stroke-width': '1.5', 'data-handle': h.n });
                r.style.cursor = h.n + '-resize';
                grp.appendChild(r);
            });
        }

        if (state.tool === 'rotate') {
            const rx = bbox.x + bbox.width / 2;
            const ry = bbox.y - 25;
            const rh = svg('circle', { cx: rx, cy: ry, r: '6', fill: '#18181b', stroke: '#f59e0b', 'stroke-width': '2' });
            rh.style.cursor = 'grab';
            grp.appendChild(rh);
            grp.appendChild(svg('line', { x1: rx, y1: bbox.y, x2: rx, y2: ry, stroke: '#f59e0b', 'stroke-dasharray': '2,2' }));
        }

        parent.appendChild(grp);
    }


    /* ── pivot gizmo ────────────────────────────────────────────────────── */

    function _renderPivotGizmo (parent, pivot) {
        var px = pivot.x, py = pivot.y;
        var r = 8;
        var grp = svg('g', { class: 'pivot-gizmo' });

        // Outer circle
        grp.appendChild(svg('circle', {
            cx: px, cy: py, r: r,
            fill: 'rgba(139,92,246,0.15)', stroke: '#8b5cf6',
            'stroke-width': '2'
        }));

        // Crosshair lines
        grp.appendChild(svg('line', {
            x1: px - r - 3, y1: py, x2: px + r + 3, y2: py,
            stroke: '#8b5cf6', 'stroke-width': '1.5'
        }));
        grp.appendChild(svg('line', {
            x1: px, y1: py - r - 3, x2: px, y2: py + r + 3,
            stroke: '#8b5cf6', 'stroke-width': '1.5'
        }));

        // Center dot
        grp.appendChild(svg('circle', {
            cx: px, cy: py, r: 2.5,
            fill: '#8b5cf6', stroke: '#0d0d0f', 'stroke-width': '1'
        }));

        parent.appendChild(grp);
    }

    /* ── pen preview ─────────────────────────────────────────────────────── */

    function _renderPenPreview (parent) {
        const pts = VectorEditor.state.penPoints;
        if (!pts || pts.length < 2) return;
        let d = `M ${pts[0].x} ${pts[0].y}`;
        for (let i = 1; i < pts.length; i++) d += ` L ${pts[i].x} ${pts[i].y}`;
        parent.appendChild(svg('path', { d, fill: 'none', stroke: '#00d4aa', 'stroke-width': '2', 'stroke-dasharray': '6 3' }));
        pts.forEach(p => parent.appendChild(svg('circle', { cx: p.x, cy: p.y, r: '4', fill: '#18181b', stroke: '#00d4aa', 'stroke-width': '2' })));
    }

    /* ── export ──────────────────────────────────────────────────────────── */

    window.VectorEditor       = window.VectorEditor || {};
    window.VectorEditor.render = render;

})();