/**
 * status-bar.js  —  /ui layer
 *
 * Status bar at the bottom of the editor.
 * Shows: logo · current tool · contextual shortcut hints · mouse coords · object count · zoom
 *
 * Contextual hints replace what used to be the top-bar info area —
 * they change based on active tool so the user always has guidance.
 *
 * UI projection only. Read-only w.r.t. application state.
 */
(function () {

    /* ── Contextual hints per tool ────────────────────────────────────────
       Each entry: [ shortcut/gesture, description ]
       Shown as a scrolling inline strip in the status bar centre.
    ──────────────────────────────────────────────────────────────────────── */

    const TOOL_HINTS = {
        'select': [
            ['Click', 'Select object'],
            ['Shift+Click', 'Multi-select'],
            ['Ctrl+Click', 'Toggle selection'],
            ['Drag', 'Move / marquee'],
            ['Ctrl+D', 'Duplicate'],
            ['Del', 'Delete'],
            ['Tab', 'Cycle tool'],
            ['O', 'Switch to Rotate'],
            ['Dbl-click', 'Toggle rotate mode'],
        ],
        'rotate': [
            ['Drag handle', 'Rotate around centre'],
            ['V', 'Back to Select'],
            ['Tab', 'Cycle tool'],
        ],
        'rectangle':  _drawHints('Drag to draw'),
        'ellipse':    _drawHints('Drag to draw'),
        'polygon':    _drawHints('Drag to draw'),
        'star':       _drawHints('Drag to draw'),
        'freehand':   [
            ['Drag', 'Draw freehand'],
            ['Release', 'Finish stroke'],
            ['Near start', 'Auto-close path'],
            ['Esc', 'Cancel'],
        ],
        'polyline': [
            ['Click', 'Add anchor point'],
            ['Enter / Dbl-click', 'Finish path'],
            ['Right-click', 'Undo last point'],
            ['Esc', 'Cancel'],
        ],
        'cubic': [
            ['Click', 'Add anchor'],
            ['Click+Drag', 'Curve handle'],
            ['Enter / Dbl-click', 'Finish'],
            ['Right-click', 'Undo last'],
            ['Esc', 'Cancel'],
        ],
        'quadratic': [
            ['Click', 'Place anchor'],
            ['Click', 'Place control point'],
            ['Enter / Dbl-click', 'Finish'],
            ['Right-click', 'Undo last'],
            ['Esc', 'Cancel'],
        ],
        'arc': [
            ['Click', 'Start arc'],
            ['Click', 'Set through-point'],
            ['Click', 'Finish arc segment'],
            ['Enter / Dbl-click', 'Close path'],
            ['Esc', 'Cancel'],
        ],
    };

    function _drawHints (action) {
        return [
            [action, ''],
            ['Esc', 'Cancel'],
            ['Tab', 'Cycle tool'],
        ];
    }

    /* Global shortcuts always appended */
    const GLOBAL_HINTS = [
        ['Ctrl+Scroll', 'Zoom'],
        ['Scroll', 'Pan'],
        ['Space+Drag', 'Pan'],
        ['V', 'Select'],
        ['O', 'Rotate'],
        ['R', 'Rect'],
        ['E', 'Ellipse'],
        ['Y', 'Polygon'],
        ['S', 'Star'],
        ['L', 'Polyline'],
        ['C', 'Cubic'],
        ['Q', 'Quadratic'],
        ['A', 'Arc'],
        ['F', 'Freehand'],
        ['Tab', 'Next tool'],
    ];

    /* ── Render the hint strip ──────────────────────────────────────────── */

    function _renderHints (tool) {
        const el = document.getElementById('statusHints');
        if (!el) return;

        const toolHints = TOOL_HINTS[tool] || [];
        const hints     = [...toolHints, ...GLOBAL_HINTS.slice(0, 6)];

        el.innerHTML = hints.map(([key, desc]) => `
            <span class="status-hint">
                <kbd class="status-kbd">${key}</kbd>
                ${desc ? `<span class="status-hint-desc">${desc}</span>` : ''}
            </span>
        `).join('<span class="status-hint-sep">·</span>');
    }

    /* ── Mouse position display ─────────────────────────────────────────── */

    function _updateMouse (pos) {
        const el = document.getElementById('mousePos');
        if (el) el.textContent = `${Math.round(pos.x)}, ${Math.round(pos.y)}`;
    }

    /* ── Object count ───────────────────────────────────────────────────── */

    function _updateObjectCount () {
        const el  = document.getElementById('objectCount');
        const doc = VectorEditor.app?.document;
        if (!el || !doc) return;
        const n   = doc.getAllObjects?.()?.length ?? 0;
        const sel = VectorEditor.state.selectedObjectIds?.length ?? 0;
        el.textContent = sel > 0 ? `${n} obj · ${sel} sel` : `${n} objects`;
    }

    /* ── Tool name display ──────────────────────────────────────────────── */

    function _updateTool (tool) {
        const el = document.getElementById('toolStatus');
        if (el) el.textContent = _toolLabel(tool);
        _renderHints(tool);
    }

    function _toolLabel (tool) {
        const LABELS = {
            'select': 'Select', 'rotate': 'Rotate',
            'rectangle': 'Rectangle', 'ellipse': 'Ellipse',
            'polygon': 'Polygon', 'star': 'Star',
            'polyline': 'Polyline', 'freehand': 'Freehand',
            'cubic': 'Cubic Bézier', 'quadratic': 'Quadratic Bézier', 'arc': 'Arc'
        };
        return LABELS[tool] || tool;
    }

    /* ── Zoom display ───────────────────────────────────────────────────── */

    function _updateZoom () {
        const el = document.getElementById('zoomLevel');
        if (el) el.textContent = `${Math.round((VectorEditor.state.zoom || 1) * 100)}%`;
    }

    /* ── Init ────────────────────────────────────────────────────────────── */

    function initStatusBar () {
        /* React to canvas renders */
        window.addEventListener('vectorEditorUpdate', () => {
            _updateObjectCount();
            _updateZoom();
            _updateTool(VectorEditor.state.tool);
        });

        /* Listen for mouse position updates from board-events */
        window.addEventListener('vectorEditorMouseMove', e => {
            _updateMouse(e.detail);
        });

        /* Initial render */
        _updateTool(VectorEditor.state.tool || 'select');
        _updateObjectCount();
        _updateZoom();
    }

    /* ── Public helpers (called from board-events.js) ─────────────────────── */

    function updateMousePosition (pos) { _updateMouse(pos); }
    function updateTool (tool)          { _updateTool(tool); }

    window.VectorEditor = window.VectorEditor || {};
    window.VectorEditor.initStatusBar       = initStatusBar;
    window.VectorEditor.updateMousePosition = updateMousePosition;
    window.VectorEditor.updateToolStatus    = updateTool;

})();