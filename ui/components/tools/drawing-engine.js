/**
 * drawing-engine.js - Unified Path Drawing Engine
 *
 * Changes from v1:
 *  - Cubic handles: cp2 is the mirror of cp1 through the chord midpoint (they face each other)
 *  - Quadratic tool: 3-phase flow — anchor → CP (handle line) → anchor → CP → …
 *    Right-click: two-level undo (in CP phase undoes CP; in anchor phase undoes anchor+segment)
 *  - finish(): stores shapeMetadata in VectorEditor.state for per-type gizmo rendering
 *  - cycleTool(): handles qcpPhase transition when switching away from/to quadratic
 */

(function () {

    const PATH_TOOLS  = ['polyline', 'cubic', 'quadratic', 'arc'];
    const TOOL_CYCLE  = ['polyline', 'cubic', 'quadratic', 'arc'];
    const TOOL_TO_SEGMENT_TYPE = {
        polyline:   'line',
        cubic:      'cubic',
        quadratic:  'quadratic',
        arc:        'arc'
    };

    const CLOSE_HIT_RADIUS = 14;

    // ─── Geometry helpers ─────────────────────────────────────────────────────

    function r(n) { return Math.round(n * 100) / 100; }
    function dist2d(a, b) { return Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2); }

    /**
     * Cubic control points — symmetric: cp2 = mirror of cp1 through chord midpoint.
     * Both handles face inward toward each other, producing a smooth balanced bow.
     */
    function getCubicCPs(p1, p2, prevDirection) {
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const d  = Math.sqrt(dx * dx + dy * dy);
        if (d < 0.001) return { cp1: { ...p1 }, cp2: { ...p2 } };

        const ux = dx / d;  // unit chord direction
        const uy = dy / d;
        const px = -uy;     // perpendicular (left of travel)
        const py =  ux;
        const bow = d * 0.22;

        let cp1x, cp1y;
        if (prevDirection) {
            // Smooth join: continue tangent from previous segment
            cp1x = p1.x + prevDirection.x * (d / 3);
            cp1y = p1.y + prevDirection.y * (d / 3);
        } else {
            // 1/3 along chord + perpendicular bow
            cp1x = p1.x + ux * (d / 3) + px * bow;
            cp1y = p1.y + uy * (d / 3) + py * bow;
        }

        // cp2 = mirror of cp1 through chord midpoint → handles face each other
        const midX = (p1.x + p2.x) / 2;
        const midY = (p1.y + p2.y) / 2;
        const cp2 = { x: 2 * midX - cp1x, y: 2 * midY - cp1y };

        return { cp1: { x: cp1x, y: cp1y }, cp2 };
    }

    /** Quadratic CP: midpoint with perpendicular offset */
    function getQuadraticCP(p1, p2) {
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const d  = Math.sqrt(dx * dx + dy * dy);
        if (d < 0.001) return { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
        const mx = (p1.x + p2.x) / 2;
        const my = (p1.y + p2.y) / 2;
        const px = -dy / d;
        const py =  dx / d;
        return { x: mx + px * d * 0.4, y: my + py * d * 0.4 };
    }

    /** SVG arc radius from chord */
    function getArcRadius(p1, p2) {
        return Math.max(1, dist2d(p1, p2) * 0.65);
    }

    // ─── Segment creation ─────────────────────────────────────────────────────

    function createSegmentData(type, p1, p2, opts = {}) {
        const seg = { type, p1: { ...p1 }, p2: { ...p2 } };
        switch (type) {
            case 'cubic': {
                const { cp1, cp2 } = getCubicCPs(p1, p2, opts.prevDirection);
                seg.cp1 = cp1; seg.cp2 = cp2;
                break;
            }
            case 'quadratic': {
                // cp must be supplied via opts.cp (explicit user-placed handle)
                // or auto-generated fallback
                seg.cp = opts.cp || getQuadraticCP(p1, p2);
                break;
            }
            case 'arc': {
                const rv = getArcRadius(p1, p2);
                seg.rx = rv; seg.ry = rv;
                seg.rotation = 0; seg.largeArc = 0; seg.sweep = 1;
                break;
            }
        }
        return seg;
    }

    // ─── SVG path building ────────────────────────────────────────────────────

    function segmentToCmd(seg) {
        switch (seg.type) {
            case 'line':
                return ` L ${r(seg.p2.x)} ${r(seg.p2.y)}`;
            case 'cubic':
                return ` C ${r(seg.cp1.x)} ${r(seg.cp1.y)} ${r(seg.cp2.x)} ${r(seg.cp2.y)} ${r(seg.p2.x)} ${r(seg.p2.y)}`;
            case 'quadratic':
                return ` Q ${r(seg.cp.x)} ${r(seg.cp.y)} ${r(seg.p2.x)} ${r(seg.p2.y)}`;
            case 'arc':
                return ` A ${r(seg.rx)} ${r(seg.ry)} ${seg.rotation} ${seg.largeArc} ${seg.sweep} ${r(seg.p2.x)} ${r(seg.p2.y)}`;
            default:
                return ` L ${r(seg.p2.x)} ${r(seg.p2.y)}`;
        }
    }

    function buildPathData(anchors, segments, closed) {
        if (!anchors.length) return '';
        let d = `M ${r(anchors[0].x)} ${r(anchors[0].y)}`;
        for (const seg of segments) d += segmentToCmd(seg);
        if (closed) d += ' Z';
        return d;
    }

    function getPrevDirection(segments) {
        if (!segments.length) return null;
        const last = segments[segments.length - 1];
        let px, py;
        if (last.type === 'cubic' && last.cp2) {
            px = last.p2.x - last.cp2.x; py = last.p2.y - last.cp2.y;
        } else {
            px = last.p2.x - last.p1.x; py = last.p2.y - last.p1.y;
        }
        const d = Math.sqrt(px * px + py * py);
        return d < 0.001 ? null : { x: px / d, y: py / d };
    }

    // ─── Closing rules ────────────────────────────────────────────────────────

    /**
     * Can the shape be closed by clicking the first anchor?
     * Counts the closing segment in the total:
     *   - 3+ total segments: always
     *   - 2 total segments: only if any segment (existing or closing) is non-line
     */
    function canClose(session) {
        const n = session.segments.length;
        // For quadratic in CP phase, the next commit would produce one more segment
        const pendingSegments = (session.segmentType === 'quadratic' && session.qcpPhase) ? 0 : 0;
        const totalAfterClose = n + 1 + pendingSegments;
        if (totalAfterClose >= 3) return true;
        if (totalAfterClose >= 2) {
            const hasNonLine = session.segments.some(s => s.type !== 'line');
            const closingIsNonLine = session.segmentType !== 'line';
            return hasNonLine || closingIsNonLine;
        }
        return false;
    }

    // ─── Paper.js import ──────────────────────────────────────────────────────

    function importToPaper(pathData, fill, stroke, strokeWidth) {
        try {
            const svgStr = `<svg xmlns="http://www.w3.org/2000/svg"><path d="${pathData}"/></svg>`;
            const imported = paper.project.importSVG(svgStr);
            if (!imported) return null;

            let pp;
            if (imported.className === 'Group' || (imported.children && imported.children.length)) {
                pp = imported.firstChild;
                if (pp) paper.project.activeLayer.addChild(pp);
                imported.remove();
            } else {
                pp = imported;
            }
            if (!pp) return null;

            pp.fillColor   = fill && fill !== 'none' ? fill : null;
            pp.strokeColor = stroke || '#ffffff';
            pp.strokeWidth = strokeWidth || 2;
            return pp;
        } catch (err) {
            console.warn('[DrawingEngine] importToPaper failed:', err);
            return null;
        }
    }

    // ─── Session accessors ────────────────────────────────────────────────────

    function getSession() { return VectorEditor.state.drawingSession; }
    function clearSession() { VectorEditor.state.drawingSession = { active: false }; }

    // ─── Public API ───────────────────────────────────────────────────────────

    /**
     * Begin a new drawing session at pos.
     * For quadratic: immediately enter CP phase (next click is the handle control point).
     */
    function start(tool, pos) {
        VectorEditor.clearSelections();
        VectorEditor.state.drawingSession = {
            active:      true,
            anchors:     [{ x: r(pos.x), y: r(pos.y) }],
            segments:    [],
            segmentType: TOOL_TO_SEGMENT_TYPE[tool] || 'line',
            mousePos:    { ...pos },
            qcpPhase:    (TOOL_TO_SEGMENT_TYPE[tool] === 'quadratic'),   // quadratic: awaiting CP
            pendingQCP:  null
        };
    }

    /**
     * Confirm the next point.
     * For quadratic, this alternates: if qcpPhase=true → stores CP; if false → creates segment.
     */
    function addAnchor(pos, explicitCP) {
        const session = getSession();
        if (!session || !session.active) return;

        if (session.segmentType === 'quadratic') {
            if (session.qcpPhase) {
                // This click places the control point (handle)
                session.pendingQCP = { x: r(pos.x), y: r(pos.y) };
                session.qcpPhase   = false;
                return;
            }
            // This click places the end anchor; use the stored CP
            const lastAnchor = session.anchors[session.anchors.length - 1];
            const cp = session.pendingQCP || explicitCP || getQuadraticCP(lastAnchor, pos);
            const seg = createSegmentData('quadratic', lastAnchor, pos, { cp });
            session.segments.push(seg);
            session.anchors.push({ x: r(pos.x), y: r(pos.y) });
            session.pendingQCP = null;
            session.qcpPhase   = true;   // next segment starts with CP phase
            return;
        }

        // Non-quadratic: normal anchor placement
        const lastAnchor = session.anchors[session.anchors.length - 1];
        const prevDir    = getPrevDirection(session.segments);
        const seg        = createSegmentData(session.segmentType, lastAnchor, pos, { prevDirection: prevDir });
        session.segments.push(seg);
        session.anchors.push({ x: r(pos.x), y: r(pos.y) });
    }

    /**
     * Two-level undo for quadratic; single-level for others.
     *
     * Quadratic:
     *   qcpPhase=false (just placed a CP): undo CP → back to qcpPhase=true
     *   qcpPhase=true  (just placed an anchor+segment): undo anchor → restore its CP, back to qcpPhase=false
     *
     * Others: remove last segment+anchor (original behaviour).
     */
    function cancelLastAnchor() {
        const session = getSession();
        if (!session || !session.active) return;

        if (session.segmentType === 'quadratic') {
            if (!session.qcpPhase) {
                // Undo CP placement only
                session.pendingQCP = null;
                session.qcpPhase   = true;
            } else {
                // Undo anchor + segment
                if (session.anchors.length <= 1) { clearSession(); return; }
                const lastSeg = session.segments[session.segments.length - 1];
                session.segments.pop();
                session.anchors.pop();
                // Restore the CP from the removed segment so user can re-position it
                session.pendingQCP = lastSeg ? { ...lastSeg.cp } : null;
                session.qcpPhase   = false;
            }
            return;
        }

        // Non-quadratic
        if (session.anchors.length <= 1) { clearSession(); return; }
        session.segments.pop();
        session.anchors.pop();
    }

    function cancelAll() { clearSession(); }

    /**
     * Commit the drawing session as a domain shape.
     * Stores shapeMetadata for per-type gizmo rendering.
     */
    function finish(closed) {
        const state   = VectorEditor.state;
        const session = getSession();

        if (!session || !session.active || session.segments.length === 0) {
            clearSession(); return null;
        }

        const pathData = buildPathData(session.anchors, session.segments, closed);
        if (!pathData) { clearSession(); return null; }

        const fill   = closed ? state.fillColor : 'none';
        const stroke = state.strokeColor;
        const sw     = state.strokeWidth;

        const pp = importToPaper(pathData, fill, stroke, sw);
        if (!pp) { clearSession(); return null; }

        const b = pp.bounds;
        const types = session.segments.map(s => s.type);
        const hasArcs = types.includes('arc');

        const allLine = types.every(t => t === 'line');
        const shapeType = allLine ? 'path'
                        : types.includes('arc') ? 'arc-path'
                        : 'bezier-path';

        const result = VectorEditor.app.execute('createShape', {
            type: shapeType, pathData,
            bounds: { x: b.x, y: b.y, width: b.width, height: b.height },
            closed,
            style: { fill, stroke, strokeWidth: sw }
        });

        if (!result || !result.objectId) { pp.remove(); clearSession(); return null; }

        state.paperPaths[result.objectId] = pp;

        // ── Store per-type metadata for gizmo rendering ──
        state.shapeMetadata[result.objectId] = {
            segmentTypes:   types,
            anchorCount:    session.anchors.length,
            ppSegmentCount: pp.segments.length,
            hasArcs,
            closed
        };

        VectorEditor.selectObject(result.objectId, false);
        clearSession();
        VectorEditor.syncPathToCore(result.objectId);
        return result.objectId;
    }

    /**
     * Cycle to the next path tool (Ctrl key).
     * Handles qcpPhase transition when entering/leaving quadratic.
     */
    function cycleTool() {
        const state    = VectorEditor.state;
        const idx      = TOOL_CYCLE.indexOf(state.tool);
        const nextTool = TOOL_CYCLE[(idx + 1) % TOOL_CYCLE.length];

        // Update session segment type (setTool will preserve the session)
        const session = getSession();
        if (session && session.active) {
            const newType = TOOL_TO_SEGMENT_TYPE[nextTool] || 'line';
            session.segmentType = newType;

            if (newType !== 'quadratic') {
                // Leaving quadratic: discard any pending CP state
                session.qcpPhase   = false;
                session.pendingQCP = null;
            } else if (!session.pendingQCP && session.qcpPhase === false) {
                // Entering quadratic mid-session from non-CP position
                session.qcpPhase = true;
            }
        }

        VectorEditor.setTool(nextTool);
    }

    function updateMouse(pos) {
        const session = getSession();
        if (session && session.active) session.mousePos = pos;
    }

    function checkCanClose() {
        const session = getSession();
        return !!(session && session.active && canClose(session));
    }

    function isActive() {
        const session = getSession();
        return !!(session && session.active);
    }

    // ─── Mouse handlers ───────────────────────────────────────────────────────

    function onMouseDown(e, svgCanvas) {
        const { state, getMousePos, render } = VectorEditor;
        const pos     = getMousePos(e, svgCanvas);
        const session = getSession();

        if (!session || !session.active) {
            start(state.tool, pos);
            render(svgCanvas);
            return;
        }

        const firstAnchor = session.anchors[0];
        const d = dist2d(pos, firstAnchor);

        // ── Attempt close ──
        if (d <= CLOSE_HIT_RADIUS && canClose(session)) {
            if (session.segmentType === 'quadratic') {
                if (session.qcpPhase) {
                    // Auto-generate CP for the closing segment
                    const lastA = session.anchors[session.anchors.length - 1];
                    session.pendingQCP = getQuadraticCP(lastA, firstAnchor);
                    session.qcpPhase   = false;
                }
                addAnchor(firstAnchor);
            } else {
                addAnchor(firstAnchor);
            }
            finish(true);
            render(svgCanvas);
            return;
        }

        addAnchor(pos);
        render(svgCanvas);
    }

    function onMouseMove(e, svgCanvas) {
        const { state, getMousePos, render } = VectorEditor;
        const pos = getMousePos(e, svgCanvas);

        state.currentMouse = pos;
        const el = document.getElementById('mousePos');
        if (el) el.textContent = `${Math.round(pos.x)}, ${Math.round(pos.y)}`;

        updateMouse(pos);
        render(svgCanvas);
    }

    function onMouseUp() {}   // anchors placed on mouseDown

    // ─── Rendering ────────────────────────────────────────────────────────────

    /**
     * Render the in-progress drawing session into an SVG parent group.
     * Called by render.js during the main render pass.
     */
    function renderDrawingSession(parent) {
        const state   = VectorEditor.state;
        const session = state.drawingSession;
        if (!session || !session.active || session.anchors.length === 0) return;

        const mouse   = session.mousePos;
        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.setAttribute('class', 'drawing-session');

        // ── Completed segments ────────────────────────────────────────────────
        if (session.segments.length > 0) {
            const d = buildPathData(session.anchors, session.segments, false);
            _svgPath(g, d, 'none', '#10b981', 2, null, null);
        }

        // ── Live preview segment ──────────────────────────────────────────────
        if (mouse && session.anchors.length > 0) {
            const lastA = session.anchors[session.anchors.length - 1];

            if (session.segmentType === 'quadratic' && session.qcpPhase) {
                // Phase 1: user is placing the CP — show handle arm (straight line to mouse)
                _svgLine(g, lastA.x, lastA.y, mouse.x, mouse.y, '#f59e0b', 1.5, '5 3');
                _svgCircle(g, mouse.x, mouse.y, 5, '#f59e0b', '#0d0d0f', 1.5);   // CP preview dot
                _svgLine(g, lastA.x, lastA.y, mouse.x, mouse.y, '#f59e0b', 1, '5 3');
            } else if (session.segmentType === 'quadratic' && !session.qcpPhase && session.pendingQCP) {
                // Phase 2: CP placed, user is placing end anchor — show actual quadratic curve
                const cp  = session.pendingQCP;
                const seg = createSegmentData('quadratic', lastA, mouse, { cp });
                const d   = `M ${r(lastA.x)} ${r(lastA.y)}${segmentToCmd(seg)}`;
                _svgPath(g, d, 'none', '#00d4aa', 2, '7 3', '0.85');
                // Show placed CP handle
                _svgLine(g, lastA.x, lastA.y, cp.x, cp.y, '#f59e0b', 1.5, '3 2');
                _svgLine(g, mouse.x,  mouse.y,  cp.x, cp.y, '#f59e0b', 1,   '3 2');
                _svgRect45(g, cp.x, cp.y, 5, '#f59e0b', '#0d0d0f');
            } else {
                // Normal tool preview
                const prevDir  = getPrevDirection(session.segments);
                const previewSeg = createSegmentData(session.segmentType, lastA, mouse, { prevDirection: prevDir });
                const d = `M ${r(lastA.x)} ${r(lastA.y)}${segmentToCmd(previewSeg)}`;
                _svgPath(g, d, 'none', '#00d4aa', 2, '7 3', '0.85');

                if (previewSeg.type === 'cubic') {
                    _svgLine(g, lastA.x,  lastA.y,  previewSeg.cp1.x, previewSeg.cp1.y, '#f59e0b', 1.5, '3 2');
                    _svgLine(g, mouse.x,  mouse.y,  previewSeg.cp2.x, previewSeg.cp2.y, '#f59e0b', 1.5, '3 2');
                    _svgRect45(g, previewSeg.cp1.x, previewSeg.cp1.y, 5, '#f59e0b', '#0d0d0f');
                    _svgRect45(g, previewSeg.cp2.x, previewSeg.cp2.y, 5, '#f59e0b', '#0d0d0f');
                } else if (previewSeg.type === 'arc') {
                    const mx = (lastA.x + mouse.x) / 2;
                    const my = (lastA.y + mouse.y) / 2;
                    _svgCross(g, mx, my, '#7c3aed');
                }
            }

            _renderToolBadge(g, mouse, session.segmentType, session.qcpPhase && session.segmentType === 'quadratic');
        }

        // ── Anchor gizmos ─────────────────────────────────────────────────────
        const closeable = canClose(session);
        session.anchors.forEach((anchor, i) => {
            const isFirst = i === 0;
            const isLast  = i === session.anchors.length - 1;
            const isCloseTarget = isFirst && closeable && session.anchors.length > 1;
            const isMouseNear   = isCloseTarget && mouse && dist2d(mouse, anchor) <= CLOSE_HIT_RADIUS;

            if (isCloseTarget) {
                const glow = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                glow.setAttribute('cx', anchor.x); glow.setAttribute('cy', anchor.y);
                glow.setAttribute('r', isMouseNear ? 14 : 10);
                glow.setAttribute('fill', 'rgba(16,185,129,0.15)');
                glow.setAttribute('stroke', '#10b981');
                glow.setAttribute('stroke-width', isMouseNear ? '2' : '1');
                glow.setAttribute('stroke-dasharray', '3 2');
                g.appendChild(glow);
            }

            _svgCircle(g, anchor.x, anchor.y,
                isCloseTarget ? 5 : (isLast ? 5 : 4),
                isCloseTarget ? (isMouseNear ? '#10b981' : '#0d0d0f') : '#18181b',
                isLast ? '#00d4aa' : '#10b981',
                isLast || isCloseTarget ? 2 : 1.5
            );
        });

        parent.appendChild(g);
    }

    // ─── SVG helpers (local) ──────────────────────────────────────────────────

    function _svgPath(g, d, fill, stroke, sw, dash, opacity) {
        const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        p.setAttribute('d', d);
        p.setAttribute('fill', fill || 'none');
        p.setAttribute('stroke', stroke);
        p.setAttribute('stroke-width', sw);
        if (dash) p.setAttribute('stroke-dasharray', dash);
        if (opacity) p.setAttribute('opacity', opacity);
        g.appendChild(p);
    }

    function _svgLine(g, x1, y1, x2, y2, stroke, sw, dash) {
        const l = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        l.setAttribute('x1', x1); l.setAttribute('y1', y1);
        l.setAttribute('x2', x2); l.setAttribute('y2', y2);
        l.setAttribute('stroke', stroke); l.setAttribute('stroke-width', sw);
        if (dash) l.setAttribute('stroke-dasharray', dash);
        l.setAttribute('opacity', '0.8');
        g.appendChild(l);
    }

    function _svgCircle(g, cx, cy, radius, fill, stroke, sw) {
        const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        c.setAttribute('cx', cx); c.setAttribute('cy', cy);
        c.setAttribute('r', radius);
        c.setAttribute('fill', fill); c.setAttribute('stroke', stroke);
        c.setAttribute('stroke-width', sw);
        g.appendChild(c);
    }

    function _svgRect45(g, cx, cy, halfSize, fill, stroke) {
        const p = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        p.setAttribute('x', cx - halfSize); p.setAttribute('y', cy - halfSize);
        p.setAttribute('width', halfSize * 2); p.setAttribute('height', halfSize * 2);
        p.setAttribute('fill', fill); p.setAttribute('stroke', stroke);
        p.setAttribute('stroke-width', '1');
        p.setAttribute('transform', `rotate(45 ${cx} ${cy})`);
        g.appendChild(p);
    }

    function _svgCross(g, cx, cy, stroke) {
        const s = 5;
        [[cx - s, cy, cx + s, cy], [cx, cy - s, cx, cy + s]].forEach(([x1, y1, x2, y2]) => {
            const l = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            l.setAttribute('x1', x1); l.setAttribute('y1', y1);
            l.setAttribute('x2', x2); l.setAttribute('y2', y2);
            l.setAttribute('stroke', stroke); l.setAttribute('stroke-width', '1.5');
            l.setAttribute('opacity', '0.7');
            g.appendChild(l);
        });
    }

    function _renderToolBadge(g, pos, segType, isCpPhase) {
        const labels = { line: 'LINE', cubic: 'CUBIC', quadratic: isCpPhase ? 'QUAD→CP' : 'QUAD', arc: 'ARC' };
        const colors = { line: '#10b981', cubic: '#f59e0b', quadratic: '#3b82f6', arc: '#7c3aed' };
        const label  = labels[segType] || segType.toUpperCase();
        const color  = colors[segType] || '#10b981';
        const w      = label.length * 6.5 + 8;

        const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        bg.setAttribute('x', pos.x + 14); bg.setAttribute('y', pos.y - 20);
        bg.setAttribute('width', w); bg.setAttribute('height', 16);
        bg.setAttribute('rx', '3'); bg.setAttribute('fill', color); bg.setAttribute('opacity', '0.85');
        g.appendChild(bg);

        const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        t.setAttribute('x', pos.x + 18); t.setAttribute('y', pos.y - 8);
        t.setAttribute('fill', '#0d0d0f'); t.setAttribute('font-size', '9');
        t.setAttribute('font-weight', '700');
        t.setAttribute('font-family', 'JetBrains Mono, monospace');
        t.setAttribute('letter-spacing', '0.5');
        t.textContent = label;
        g.appendChild(t);
    }

    // ─── Tool registrations ───────────────────────────────────────────────────

    const handler = { onMouseDown, onMouseMove, onMouseUp };

    window.VectorEditor = window.VectorEditor || {};
    window.VectorEditor.tools = window.VectorEditor.tools || {};
    PATH_TOOLS.forEach(t => { window.VectorEditor.tools[t] = handler; });

    window.VectorEditor.drawingEngine = {
        PATH_TOOLS, TOOL_CYCLE, TOOL_TO_SEGMENT_TYPE,
        isPathTool: t => PATH_TOOLS.includes(t),
        isActive, start, addAnchor, cancelLastAnchor, cancelAll,
        finish, cycleTool, updateMouse,
        canClose: checkCanClose,
        renderDrawingSession,
        segmentToCmd, createSegmentData
    };

})();