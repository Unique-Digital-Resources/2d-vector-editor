/**
 * properties-tab.js  —  /ui layer
 *
 * Renders object transform + appearance controls in the Properties tab pane.
 * Replaces both the old `settings-bar` (top strip) and `properties-bar` (right panel).
 *
 * All mutations → app.execute() or direct Paper.js + syncPathToCore().
 * UI projection only — no business logic.
 */
(function () {

    /* ── build DOM ───────────────────────────────────────────────────────── */

    function _buildUI () {
        const pane = document.getElementById('vtabPropertiesPane');
        if (!pane) return;

        pane.innerHTML = `
        <!-- Transform -->
        <div class="prop-section-label">Transform</div>
        <div class="prop-section">
            <div class="prop-row">
                <label class="prop-lbl">X</label>
                <input id="propX" type="number" class="prop-input" step="1">
                <label class="prop-lbl">Y</label>
                <input id="propY" type="number" class="prop-input" step="1">
            </div>
            <div class="prop-row">
                <label class="prop-lbl">W</label>
                <input id="propW" type="number" class="prop-input" step="1" min="1">
                <label class="prop-lbl">H</label>
                <input id="propH" type="number" class="prop-input" step="1" min="1">
            </div>
        </div>

        <!-- Appearance -->
        <div class="prop-section-label">Appearance</div>
        <div class="prop-section">
            <div class="prop-row">
                <label class="prop-lbl">Fill</label>
                <div class="prop-swatch-wrap"><input type="color" id="propFill" value="#10b981"></div>
                <button id="propFillNone" class="prop-none-btn" title="No fill">✕</button>
            </div>
            <div class="prop-row">
                <label class="prop-lbl">Stroke</label>
                <div class="prop-swatch-wrap"><input type="color" id="propStroke" value="#ffffff"></div>
            </div>
            <div class="prop-row">
                <label class="prop-lbl">Width</label>
                <input id="propStrokeWidth" type="number" class="prop-input" min="0" max="50" value="2">
            </div>
        </div>

        <!-- Info -->
        <div class="prop-section-label">Info</div>
        <div class="prop-section">
            <div class="prop-kv"><span class="prop-key">Type</span><span class="prop-val" id="infoType">—</span></div>
            <div class="prop-kv"><span class="prop-key">ID</span><span class="prop-val" id="infoId">—</span></div>
            <div class="prop-kv"><span class="prop-key">Segs</span><span class="prop-val" id="infoSegs">—</span></div>
        </div>

        <div id="propEmpty" class="vtab-empty">Select an object</div>
        `;

        _bindEvents();
    }

    /* ── event bindings ──────────────────────────────────────────────────── */

    function _bindEvents () {
        const state = VectorEditor.state;

        /* transform inputs */
        ['propX','propY','propW','propH'].forEach(id => {
            document.getElementById(id)?.addEventListener('change', _applyTransform);
        });

        /* fill */
        document.getElementById('propFill')?.addEventListener('input', e => {
            state.fillColor = e.target.value;
            _applyStyle({ fill: e.target.value });
        });
        document.getElementById('propFillNone')?.addEventListener('click', () => {
            _applyStyle({ fill: 'none' });
        });

        /* stroke */
        document.getElementById('propStroke')?.addEventListener('input', e => {
            state.strokeColor = e.target.value;
            _applyStyle({ stroke: e.target.value });
        });

        /* stroke width */
        document.getElementById('propStrokeWidth')?.addEventListener('change', e => {
            const w = parseFloat(e.target.value) || 0;
            state.strokeWidth = w;
            _applyStyle({ strokeWidth: w });
        });
    }

    function _applyTransform () {
        const state = VectorEditor.state;
        if (!state.selectedObjectId) return;
        const pp = state.paperPaths[state.selectedObjectId];
        if (!pp) return;

        const nx = parseFloat(document.getElementById('propX')?.value) || 0;
        const ny = parseFloat(document.getElementById('propY')?.value) || 0;
        const nw = parseFloat(document.getElementById('propW')?.value) || 0;
        const nh = parseFloat(document.getElementById('propH')?.value) || 0;

        const b  = pp.bounds;
        pp.position = new paper.Point(pp.position.x + (nx - b.x), pp.position.y + (ny - b.y));
        if (nw > 0 && nh > 0 && b.width > 0 && b.height > 0) {
            pp.scale(nw / b.width, nh / b.height);
        }

        VectorEditor.syncPathToCore(state.selectedObjectId);
        const canvas = document.getElementById('canvas');
        if (canvas) VectorEditor.render(canvas);
    }

    function _applyStyle (style) {
        const state = VectorEditor.state;
        if (!state.selectedObjectIds.length) return;

        VectorEditor.app.execute('updateStyle', {
            objectIds: state.selectedObjectIds, style
        });

        state.selectedObjectIds.forEach(id => {
            const pp = state.paperPaths[id];
            if (!pp) return;
            if (style.fill        !== undefined) pp.fillColor   = style.fill === 'none' ? null : style.fill;
            if (style.stroke      !== undefined) pp.strokeColor = style.stroke;
            if (style.strokeWidth !== undefined) pp.strokeWidth = style.strokeWidth;
        });

        const canvas = document.getElementById('canvas');
        if (canvas) VectorEditor.render(canvas);
    }

    /* ── refresh display ──────────────────────────────────────────────────── */

    function _refresh () {
        const state  = VectorEditor.state;
        const hasSel = !!state.selectedObjectId;

        const empty    = document.getElementById('propEmpty');
        const sections = document.querySelectorAll('#vtabPropertiesPane .prop-section, #vtabPropertiesPane .prop-section-label');

        sections.forEach(el => el.style.display = hasSel ? '' : 'none');
        if (empty) empty.style.display = hasSel ? 'none' : '';

        if (!hasSel) return;

        const doc = VectorEditor.app?.document;
        const obj = doc?.getObject(state.selectedObjectId);
        const pp  = state.paperPaths[state.selectedObjectId];
        if (!obj || !pp) return;

        const b = pp.bounds;
        _set('propX', Math.round(b.x));
        _set('propY', Math.round(b.y));
        _set('propW', Math.round(b.width));
        _set('propH', Math.round(b.height));

        const fillEl = document.getElementById('propFill');
        if (fillEl) fillEl.value = (obj.fill && obj.fill !== 'none') ? obj.fill : '#000000';

        const strokeEl = document.getElementById('propStroke');
        if (strokeEl) strokeEl.value = obj.stroke || '#ffffff';

        _set('propStrokeWidth', obj.strokeWidth ?? 2);

        _setText('infoType', obj.type);
        _setText('infoId',   obj.id.substring(0, 14));
        _setText('infoSegs', pp.segments?.length ?? '—');

        if (state.selectedObjectIds.length > 1) {
            _setText('infoType', `${state.selectedObjectIds.length} objects`);
        }
    }

    function _set (id, val) {
        const el = document.getElementById(id);
        if (el) el.value = val;
    }
    function _setText (id, val) {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
    }

    /* ── init ─────────────────────────────────────────────────────────────── */

    function initPropertiesTab () {
        _buildUI();
        window.addEventListener('vectorEditorUpdate', _refresh);
    }

    /* compat aliases */
    function initPropertiesBar () { initPropertiesTab(); }
    function updatePropertiesBar () { _refresh(); }

    /* ── export ───────────────────────────────────────────────────────────── */

    window.VectorEditor = window.VectorEditor || {};
    window.VectorEditor.initPropertiesTab  = initPropertiesTab;
    window.VectorEditor.initPropertiesBar  = initPropertiesBar;
    window.VectorEditor.updatePropertiesBar= updatePropertiesBar;

})();