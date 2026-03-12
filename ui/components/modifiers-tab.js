/**
 * modifiers-tab.js  —  /ui layer
 *
 * Changes from previous version:
 *   • Selecting from dropdown IMMEDIATELY creates the modifier (no "Add" button).
 *   • 'boolean' is ONE card — subtype (union/intersect/difference/xor) chosen inside.
 *   • Modifier params update → realtime canvas re-render.
 *   • Drag-and-drop reorder via app.execute('moveModifierBefore').
 *
 * AGENT.md §3: all mutations → app.execute().
 */
(function () {

    /* ── Modifier catalogue ─────────────────────────────────────────────────
       Only two types exposed in the UI (AddModifier command allows 'array'|'boolean').
       Boolean subtype is a param, not a separate type.
    ────────────────────────────────────────────────────────────────────────── */

    const DEFS = {
        'array': {
            label:   'Array',
            icon:    'mdi-grid',
            color:   '#10b981',
            default: {
                mode: 'grid', columns: 3, rows: 1, gapX: 40, gapY: 40,
                scaleX: 1, scaleY: 1, count: 6, radius: 100, startAngle: 0, autoRotate: true
            }
        },
        'boolean': {
            label:   'Boolean',
            icon:    'mdi-set-all',
            color:   '#f59e0b',
            default: {
                subType: 'union',
                targetObjectId: ''
            }
        }
    };

    /* Sub-type display info */
    const BOOL_TYPES = [
        { id: 'union',      label: 'Union',        icon: 'mdi-set-all',    desc: 'A ∪ B' },
        { id: 'intersect',  label: 'Intersect',    icon: 'mdi-set-center', desc: 'A ∩ B' },
        { id: 'difference', label: 'Difference',   icon: 'mdi-set-left',   desc: 'A − B' },
        { id: 'xor',        label: 'XOR',          icon: 'mdi-set-none',   desc: 'A △ B' },
    ];

    /* ── Scaffold ──────────────────────────────────────────────────────────── */

    function _buildScaffold () {
        const pane = document.getElementById('vtabModifiersPane');
        if (!pane) return;

        pane.innerHTML = `
        <div class="mod-add-bar">
            <select id="modTypeSelect" class="mod-type-select">
                <option value="">— Add Modifier —</option>
                ${Object.entries(DEFS).map(([k, d]) =>
                    `<option value="${k}">${d.label}</option>`
                ).join('')}
            </select>
        </div>
        <div id="modStackContainer" class="mod-stack-container"></div>
        `;

        /* Instant-add: selecting an option immediately creates the modifier */
        document.getElementById('modTypeSelect')?.addEventListener('change', e => {
            const type = e.target.value;
            if (!type) return;

            const objectId = VectorEditor.state.selectedObjectId;
            if (!objectId) {
                alert('Select an object first.');
                e.target.value = '';
                return;
            }

            VectorEditor.app.execute('addModifier', {
                objectId,
                type,
                params: { ...DEFS[type].default }
            });

            /* Reset the dropdown so user can add another modifier of same type */
            e.target.value = '';

            _renderStack(objectId);
            _doRender();
        });
    }

    /* ── Render the full modifier stack ───────────────────────────────────── */

    function _renderStack (objectId) {
        const container = document.getElementById('modStackContainer');
        if (!container) return;
        container.innerHTML = '';

        if (!objectId) {
            container.innerHTML = '<div class="vtab-empty">Select an object</div>';
            return;
        }

        const stack = VectorEditor.app.modifierRegistry.getStack(objectId); // newest-first

        if (stack.length === 0) {
            container.innerHTML = '<div class="vtab-empty">No modifiers — pick one above</div>';
            return;
        }

        stack.forEach((mod, idx) => {
            container.appendChild(_buildCard(mod, objectId, idx, stack.length));
        });
    }

    /* ── Build one modifier card ────────────────────────────────────────────── */

    function _buildCard (mod, objectId, idx, total) {
        const def  = DEFS[mod.type] || { label: mod.type, icon: 'mdi-cog', color: '#71717a' };

        const card = document.createElement('div');
        card.className    = 'mod-card' + (mod.collapsed ? ' mod-collapsed' : '');
        card.dataset.modId= mod.id;
        card.draggable    = true;

        /* ── Header ─────────────────────────────────────────────────────── */
        const header = document.createElement('div');
        header.className = 'mod-header';
        header.style.setProperty('--mod-col', def.color);

        /* Dynamic title: for boolean, show the subtype label */
        let titleStr = def.label;
        if (mod.type === 'boolean') {
            const sub = BOOL_TYPES.find(b => b.id === (mod.params.subType || 'union'));
            titleStr  = `Boolean — ${sub ? sub.label : 'Union'}`;
        }

        header.innerHTML = `
            <span class="mod-drag-grip" title="Drag to reorder">
                <i class="mdi mdi-drag-vertical"></i>
            </span>
            <i class="mdi ${def.icon} mod-type-icon"></i>
            <span class="mod-title">${titleStr}</span>
            <span class="mod-badge">${idx === 0 ? 'top' : idx === total - 1 ? 'base' : ''}</span>
            <button class="mod-hbtn mod-vis" title="${mod.visible ? 'Disable' : 'Enable'}">
                <i class="mdi ${mod.visible ? 'mdi-eye-outline' : 'mdi-eye-off-outline'}"></i>
            </button>
            <button class="mod-hbtn mod-up"   title="Move up"    ${idx === 0           ? 'disabled' : ''}>
                <i class="mdi mdi-chevron-up"></i>
            </button>
            <button class="mod-hbtn mod-down" title="Move down"  ${idx === total - 1   ? 'disabled' : ''}>
                <i class="mdi mdi-chevron-down"></i>
            </button>
            <button class="mod-hbtn mod-collapse" title="Collapse">
                <i class="mdi ${mod.collapsed ? 'mdi-chevron-right' : 'mdi-chevron-down'}"></i>
            </button>
            <button class="mod-hbtn mod-apply" title="Apply (make destructive)">
                <i class="mdi mdi-check"></i>
            </button>
            <button class="mod-hbtn mod-del" title="Remove modifier">
                <i class="mdi mdi-close"></i>
            </button>
        `;

        /* ── Body ───────────────────────────────────────────────────────── */
        const body = document.createElement('div');
        body.className    = 'mod-body';
        body.style.display= mod.collapsed ? 'none' : 'block';
        body.innerHTML    = _buildParams(mod, objectId);

        card.appendChild(header);
        card.appendChild(body);

        /* ── Header button events ─────────────────────────────────────── */

        header.querySelector('.mod-vis')?.addEventListener('click', e => {
            e.stopPropagation();
            VectorEditor.app.execute('toggleModifierVisibility', { objectId, modifierId: mod.id });
            _renderStack(objectId);
            _doRender();
        });

        header.querySelector('.mod-up')?.addEventListener('click', e => {
            e.stopPropagation();
            VectorEditor.app.execute('reorderModifier', { objectId, modifierId: mod.id, direction: 'up' });
            _renderStack(objectId);
            _doRender();
        });

        header.querySelector('.mod-down')?.addEventListener('click', e => {
            e.stopPropagation();
            VectorEditor.app.execute('reorderModifier', { objectId, modifierId: mod.id, direction: 'down' });
            _renderStack(objectId);
            _doRender();
        });

        header.querySelector('.mod-collapse')?.addEventListener('click', e => {
            e.stopPropagation();
            VectorEditor.app.modifierRegistry.toggleCollapsed(objectId, mod.id);
            body.style.display = body.style.display === 'none' ? 'block' : 'none';
            card.classList.toggle('mod-collapsed');
            const icon = header.querySelector('.mod-collapse i');
            if (icon) icon.className = `mdi ${body.style.display === 'none' ? 'mdi-chevron-right' : 'mdi-chevron-down'}`;
        });

        header.querySelector('.mod-apply')?.addEventListener('click', e => {
            e.stopPropagation();
            const result = VectorEditor.app.execute('applyModifier', { objectId, modifierId: mod.id });
            if (result && result.applied) {
                VectorEditor.app.execute('removeModifier', { objectId, modifierId: mod.id });
                _renderStack(objectId);
                _doRender();
            } else if (result && result.error) {
                alert('Failed to apply modifier: ' + result.error);
            }
        });

        header.querySelector('.mod-del')?.addEventListener('click', e => {
            e.stopPropagation();
            VectorEditor.app.execute('removeModifier', { objectId, modifierId: mod.id });
            _renderStack(objectId);
            _doRender();
        });

        /* ── Param change events ─────────────────────────────────────── */

        /* Generic [data-param] inputs */
        body.querySelectorAll('[data-param]').forEach(input => {
            input.addEventListener('change', () => {
                const key = input.dataset.param;
                const val = input.type === 'checkbox' ? input.checked
                          : input.type === 'number'   ? parseFloat(input.value)
                          :                             input.value;
                VectorEditor.app.execute('updateModifier', {
                    objectId, modifierId: mod.id, params: { [key]: val }
                });
                _doRender();
            });
            /* Range and number: also live-update on input event */
            if (input.type === 'number' || input.type === 'range') {
                input.addEventListener('input', () => {
                    const val = parseFloat(input.value);
                    if (!isNaN(val)) {
                        VectorEditor.app.execute('updateModifier', {
                            objectId, modifierId: mod.id, params: { [input.dataset.param]: val }
                        });
                        _doRender();
                    }
                });
            }
        });

        /* Array mode radio buttons — rebuild card to show correct fields */
        body.querySelectorAll('.arr-mode-radio').forEach(radio => {
            radio.addEventListener('change', () => {
                VectorEditor.app.execute('updateModifier', {
                    objectId, modifierId: mod.id, params: { mode: radio.value }
                });
                _renderStack(objectId); /* rebuild to show correct field set */
                _doRender();
            });
        });

        /* Boolean subtype pills */
        body.querySelectorAll('.bool-pill').forEach(pill => {
            pill.addEventListener('click', () => {
                const sub = pill.dataset.subtype;
                VectorEditor.app.execute('updateModifier', {
                    objectId, modifierId: mod.id, params: { subType: sub }
                });
                _renderStack(objectId); /* rebuild to update card title + highlight */
                _doRender();
            });
        });

        /* ── Drag-and-drop ──────────────────────────────────────────── */
        _bindDrag(card, objectId, mod.id);

        return card;
    }

    /* ── Param HTML builders ───────────────────────────────────────────────── */

    function _buildParams (mod, objectId) {
        if (mod.type === 'array')   return _arrayParams(mod.params);
        if (mod.type === 'boolean') return _boolParams(mod.params, objectId);
        return '<div class="vtab-empty">No parameters</div>';
    }

    /* array ─── */
    function _arrayParams (p) {
        const mode = p.mode || 'grid';
        const uid  = Math.random().toString(36).substr(2, 5);
        return `
        <div class="mod-param-row">
            <span class="mod-param-label">Mode</span>
            <div style="display:flex; gap:8px;">
                <label class="mod-radio">
                    <input type="radio" class="arr-mode-radio" name="arrMode${uid}" value="grid"   ${mode==='grid'  ?'checked':''}>
                    Grid
                </label>
                <label class="mod-radio">
                    <input type="radio" class="arr-mode-radio" name="arrMode${uid}" value="radial" ${mode==='radial'?'checked':''}>
                    Radial
                </label>
            </div>
        </div>
        ${mode === 'grid' ? `
        <div class="mod-param-row">
            <span class="mod-param-label">Columns</span>
            <input type="number" class="mod-param-input" value="${p.columns??3}" min="1" max="20" data-param="columns">
        </div>
        <div class="mod-param-row">
            <span class="mod-param-label">Rows</span>
            <input type="number" class="mod-param-input" value="${p.rows??1}" min="1" max="20" data-param="rows">
        </div>
        <div class="mod-param-row">
            <span class="mod-param-label">Gap X</span>
            <input type="number" class="mod-param-input" value="${p.gapX??40}" data-param="gapX">
        </div>
        <div class="mod-param-row">
            <span class="mod-param-label">Gap Y</span>
            <input type="number" class="mod-param-input" value="${p.gapY??40}" data-param="gapY">
        </div>
        <div class="mod-param-row">
            <span class="mod-param-label">Scale X</span>
            <input type="number" class="mod-param-input" value="${p.scaleX??1}" step="0.05" data-param="scaleX">
        </div>
        <div class="mod-param-row">
            <span class="mod-param-label">Scale Y</span>
            <input type="number" class="mod-param-input" value="${p.scaleY??1}" step="0.05" data-param="scaleY">
        </div>
        ` : `
        <div class="mod-param-row">
            <span class="mod-param-label">Count</span>
            <input type="number" class="mod-param-input" value="${p.count??6}" min="2" max="64" data-param="count">
        </div>
        <div class="mod-param-row">
            <span class="mod-param-label">Radius</span>
            <input type="number" class="mod-param-input" value="${p.radius??100}" min="1" data-param="radius">
        </div>
        <div class="mod-param-row">
            <span class="mod-param-label">Start °</span>
            <input type="number" class="mod-param-input" value="${p.startAngle??0}" min="0" max="359" data-param="startAngle">
        </div>
        <div class="mod-param-row">
            <span class="mod-param-label">Auto-rotate</span>
            <input type="checkbox" class="mod-param-check" ${p.autoRotate!==false?'checked':''} data-param="autoRotate">
        </div>
        `}`;
    }

    /* boolean ─── */
    function _boolParams (p, objectId) {
        const cur = p.subType || 'union';
        const doc     = VectorEditor.app?.document;
        const objects = doc ? doc.getAllObjects().filter(o => o.id !== objectId) : [];

        const pills = BOOL_TYPES.map(bt => `
            <button class="bool-pill ${cur === bt.id ? 'active' : ''}" data-subtype="${bt.id}" title="${bt.desc}">
                <i class="mdi ${bt.icon}"></i>
                <span>${bt.label}</span>
            </button>
        `).join('');

        const opts = objects.length
            ? objects.map(o =>
                `<option value="${o.id}" ${p.targetObjectId===o.id?'selected':''}>${o.name||o.id}</option>`
              ).join('')
            : '<option value="" disabled>No other objects</option>';

        return `
        <div class="bool-pills-row">${pills}</div>
        <div class="mod-param-row" style="margin-top:6px;">
            <span class="mod-param-label">Target</span>
            <select class="mod-param-select" data-param="targetObjectId">
                <option value="">— pick object —</option>
                ${opts}
            </select>
        </div>
        <div class="mod-hint">
            Top modifier applied last.  Move object near target for overlap.
        </div>
        `;
    }

    /* ── Drag-and-drop ──────────────────────────────────────────────────── */

    let _dragId = null;

    function _bindDrag (card, objectId, modId) {
        card.addEventListener('dragstart', e => {
            _dragId = modId;
            card.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
        });
        card.addEventListener('dragend', () => {
            _dragId = null;
            card.classList.remove('dragging');
            document.querySelectorAll('.mod-card.drag-over').forEach(c => c.classList.remove('drag-over'));
        });
        card.addEventListener('dragover', e => {
            e.preventDefault();
            if (_dragId && _dragId !== modId) card.classList.add('drag-over');
        });
        card.addEventListener('dragleave', () => card.classList.remove('drag-over'));
        card.addEventListener('drop', e => {
            e.preventDefault();
            card.classList.remove('drag-over');
            if (!_dragId || _dragId === modId) return;
            VectorEditor.app.execute('moveModifierBefore', {
                objectId, modifierId: _dragId, destModifierId: modId
            });
            _renderStack(objectId);
            _doRender();
        });
    }

    /* ── Helpers ─────────────────────────────────────────────────────────── */

    function _doRender () {
        const canvas = document.getElementById('canvas');
        if (canvas) VectorEditor.render(canvas);
    }

    function _onEditorUpdate () {
        if (VectorEditor.state.activeTab === 'modifiers') {
            _renderStack(VectorEditor.state.selectedObjectId || null);
        }
    }

    /* ── Init ────────────────────────────────────────────────────────────── */

    function initModifiersTab () {
        _buildScaffold();
        window.addEventListener('vectorEditorUpdate', _onEditorUpdate);
    }

    window.VectorEditor = window.VectorEditor || {};
    window.VectorEditor.initModifiersTab = initModifiersTab;

})();