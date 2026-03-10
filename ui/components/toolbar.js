/**
 * toolbar.js - Tool management and keyboard shortcuts
 */
(function () {

    const TOOL_NAMES = {
        select: 'Select/Resize', rotate: 'Rotate',
        rectangle: 'Rectangle', ellipse: 'Ellipse',
        polygon: 'Polygon', star: 'Star',
        polyline: 'Polyline', cubic: 'Cubic Bézier',
        quadratic: 'Quadratic Bézier', arc: 'Arc',
        freehand: 'Freehand'
    };

    function setTool(toolName) {
        const state  = VectorEditor.state;
        const engine = VectorEditor.drawingEngine;
        const PATH_TOOLS = engine ? engine.PATH_TOOLS : [];

        const isCurrentPath = PATH_TOOLS.includes(state.tool);
        const isNextPath    = PATH_TOOLS.includes(toolName);

        if (isCurrentPath && isNextPath && state.drawingSession && state.drawingSession.active) {
            // Switching between path tools mid-drawing: just update segmentType
            // The engine's cycleTool() already handled the qcpPhase logic.
            // If called directly (button click), also handle qcpPhase:
            const newType = engine.TOOL_TO_SEGMENT_TYPE[toolName] || 'line';
            const session = state.drawingSession;
            session.segmentType = newType;

            if (newType !== 'quadratic') {
                session.qcpPhase   = false;
                session.pendingQCP = null;
            } else if (!session.pendingQCP && !session.qcpPhase) {
                session.qcpPhase = true;
            }
        } else {
            // Clear freehand legacy state
            if (state.drawingPath) {
                state.drawingPath.remove();
                state.drawingPath = null;
            }
            state.penPoints    = [];
            state.isDrawing    = false;
            state.lastPoint    = null;
            state.freehandStartPos = null;

            // Cancel drawing session when leaving path tools
            if (engine && !isNextPath && state.drawingSession && state.drawingSession.active) {
                engine.cancelAll();
            }
        }

        state.tool = toolName;

        document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
        const btn = document.querySelector(`[data-tool="${toolName}"]`);
        if (btn) btn.classList.add('active');

        const ts = document.getElementById('toolStatus');
        if (ts) ts.textContent = TOOL_NAMES[toolName] || toolName;

        const canvas = document.getElementById('canvas');
        if (canvas) {
            const isDrawingTool = isNextPath || toolName === 'freehand' ||
                ['rectangle', 'ellipse', 'polygon', 'star'].includes(toolName);
            canvas.style.cursor = ['select', 'rotate'].includes(toolName)
                ? 'default' : isDrawingTool ? 'crosshair' : 'default';
        }

        if (VectorEditor.render && canvas) VectorEditor.render(canvas);
    }

    function initToolbar() {
        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.addEventListener('click', () => setTool(btn.dataset.tool));
        });
    }

    // ── Ctrl-alone detection for tool cycling ──────────────────────────────
    let _ctrlAlone = false;

    function initKeyboardShortcuts() {
        const canvas = document.getElementById('canvas');

        document.addEventListener('keydown', e => {
            if (e.key === 'Control' || e.key === 'Meta') {
                _ctrlAlone = true;
                return;
            }
            if (e.ctrlKey || e.metaKey) _ctrlAlone = false;
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;

            const { state, render, clearSelections, tools } = VectorEditor;
            const engine = VectorEditor.drawingEngine;

            if (e.key === 'Enter') {
                if (engine && engine.isActive()) {
                    e.preventDefault();
                    engine.finish(false);
                    if (render && canvas) render(canvas);
                    return;
                }
                if (tools && tools[state.tool] && tools[state.tool].finish) {
                    tools[state.tool].finish();
                    if (render && canvas) render(canvas);
                }
                return;
            }

            if (e.key === 'Escape') {
                if (engine && engine.isActive()) {
                    engine.cancelAll();
                    if (render && canvas) render(canvas);
                    return;
                }
                if (state.drawingPath) { state.drawingPath.remove(); state.drawingPath = null; }
                state.penPoints = []; state.isDrawing = false; state.lastPoint = null;
                state.freehandStartPos = null;
                clearSelections();
                if (render && canvas) render(canvas);
                return;
            }

            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
                e.preventDefault();
                VectorEditor.selectAllObjects();
                if (render && canvas) render(canvas);
                return;
            }

            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
                e.preventDefault();
                if (state.selectedObjectIds.length > 0) {
                    const result = VectorEditor.app.execute('duplicateObject', {
                        objectIds: state.selectedObjectIds, offset: { x: 20, y: 20 }
                    });
                    clearSelections();
                    result.newObjectIds.forEach(newId => {
                        const srcId = state.selectedObjectIds[0];
                        const srcPP = state.paperPaths[srcId];
                        if (srcPP) {
                            const clone = srcPP.clone();
                            clone.position = new paper.Point(clone.position.x + 20, clone.position.y + 20);
                            state.paperPaths[newId] = clone;
                            VectorEditor.syncPathToCore(newId);
                        }
                        VectorEditor.selectObject(newId, true);
                    });
                    if (render && canvas) render(canvas);
                }
                return;
            }

            if (!e.ctrlKey && !e.metaKey) {
                switch (e.key.toLowerCase()) {
                    case 'v': setTool('select'); break;
                    case 'o': setTool('rotate'); break;
                    case 'r': setTool('rectangle'); break;
                    case 'e': setTool('ellipse'); break;
                    case 'y': setTool('polygon'); break;
                    case 's': setTool('star'); break;
                    case 'l': setTool('polyline'); break;
                    case 'c': setTool('cubic'); break;
                    case 'q': setTool('quadratic'); break;
                    case 'a': setTool('arc'); break;
                    case 'f': setTool('freehand'); break;
                    case 'delete':
                    case 'backspace':
                        if (state.selectedObjectIds.length > 0) {
                            VectorEditor.app.execute('deleteObject', {
                                objectIds: [...state.selectedObjectIds]
                            });
                            state.selectedObjectIds.forEach(id => {
                                if (state.paperPaths[id]) {
                                    state.paperPaths[id].remove();
                                    delete state.paperPaths[id];
                                }
                            });
                            clearSelections();
                            if (render && canvas) render(canvas);
                        }
                        break;
                }
            }
        });

        // Ctrl released alone → cycle path tool
        document.addEventListener('keyup', e => {
            if ((e.key === 'Control' || e.key === 'Meta') && _ctrlAlone) {
                _ctrlAlone = false;
                const engine = VectorEditor.drawingEngine;
                if (engine && engine.isPathTool(VectorEditor.state.tool)) {
                    engine.cycleTool();
                    const canvas = document.getElementById('canvas');
                    if (canvas) VectorEditor.render(canvas);
                }
            } else {
                _ctrlAlone = false;
            }
        });
    }

    window.VectorEditor = window.VectorEditor || {};
    window.VectorEditor.setTool              = setTool;
    window.VectorEditor.initToolbar          = initToolbar;
    window.VectorEditor.initKeyboardShortcuts = initKeyboardShortcuts;
    window.VectorEditor.tools = window.VectorEditor.tools || {};

})();