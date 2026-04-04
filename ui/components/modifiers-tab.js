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
       Types exposed in the UI. Boolean subtype is a param, not a separate type.
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
        },
        'pivot-point': {
            label:   'Pivot Point',
            icon:    'mdi-target',
            color:   '#8b5cf6',
            default: {
                pivotMode: 'center',
                corner: 'center',
                customX: 0,
                customY: 0,
                targetObjectId: '',
                affectPosition: true,
                affectRotation: true,
                affectScale: true,
                showGizmo: true
            }
        },
        'wrap': {
            label:   'Wrap',
            icon:    'mdi-wrap',
            color:   '#ec4899',
            default: {
                targetObjectId: '',
                wrapMode: 'envelope',
                influence: 50,
                falloff: 'linear',
                gridResX: 4,
                gridResY: 4,
                affectX: true,
                affectY: true
            }
        },
        'follow-path': {
            label:   'Follow Path',
            icon:    'mdi-vector-curve',
            color:   '#06b6d4',
            default: {
                targetObjectId: '',
                positionOnPath: 0,
                offset: 0,
                alignToPath: true,
                rotationOffset: 0,
                distributionMode: 'single',
                count: 10,
                spacing: null,
                followCurveDirection: true,
                flipDirection: false
            }
        },
        'gooey': {
            label:   'Gooey',
            icon:    'mdi-liquid-spot',
            color:   '#a855f7',
            default: {
                influenceRadius: 50,
                smoothness: 70,
                threshold: 1.0,
                affectNearby: false,
                targetObjectIds: [],
                fillBlend: 'merge',
                outlinePreservation: false,
                resolution: 24,
                animationSpeed: 0
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

        /* ── Header ─────────────────────────────────────────────────────── */
        const header = document.createElement('div');
        header.className = 'mod-header';
        header.draggable  = true;
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

        /* Pivot mode select — rebuild card to show correct fields */
        body.querySelectorAll('[data-param="pivotMode"]').forEach(sel => {
            sel.addEventListener('change', () => {
                VectorEditor.app.execute('updateModifier', {
                    objectId, modifierId: mod.id, params: { pivotMode: sel.value }
                });
                _renderStack(objectId);
                _doRender();
            });
        });

        /* Pivot corner select */
        body.querySelectorAll('.pp-corner-sel').forEach(sel => {
            sel.addEventListener('change', () => {
                VectorEditor.app.execute('updateModifier', {
                    objectId, modifierId: mod.id, params: { corner: sel.value }
                });
                _doRender();
            });
        });

        /* Pivot target object select */
        body.querySelectorAll('.pp-target-sel').forEach(sel => {
            sel.addEventListener('change', () => {
                VectorEditor.app.execute('updateModifier', {
                    objectId, modifierId: mod.id, params: { targetObjectId: sel.value }
                });
                _doRender();
            });
        });

        /* Pivot affect toggles */
        body.querySelectorAll('.pp-affect-check').forEach(chk => {
            chk.addEventListener('change', () => {
                const key = chk.dataset.affect;
                const obj = {};
                obj[key] = chk.checked;
                VectorEditor.app.execute('updateModifier', {
                    objectId, modifierId: mod.id, params: obj
                });
                _doRender();
            });
        });

        /* Pivot gizmo toggle */
        body.querySelectorAll('.pp-gizmo-check').forEach(chk => {
            chk.addEventListener('change', () => {
                VectorEditor.app.execute('updateModifier', {
                    objectId, modifierId: mod.id, params: { showGizmo: chk.checked }
                });
                _doRender();
            });
        });

        /* Wrap target select */
        body.querySelectorAll('.wrap-target-sel').forEach(sel => {
            sel.addEventListener('change', () => {
                VectorEditor.app.execute('updateModifier', {
                    objectId, modifierId: mod.id, params: { targetObjectId: sel.value }
                });
                _doRender();
            });
        });

        /* Wrap axis toggles */
        body.querySelectorAll('.wrap-axis-check').forEach(chk => {
            chk.addEventListener('change', () => {
                var key = chk.dataset.axis;
                var obj = {};
                obj[key] = chk.checked;
                VectorEditor.app.execute('updateModifier', {
                    objectId, modifierId: mod.id, params: obj
                });
                _doRender();
            });
        });

        /* Wrap mode select — rebuild card for mesh fields */
        body.querySelectorAll('[data-param="wrapMode"]').forEach(sel => {
            sel.addEventListener('change', () => {
                VectorEditor.app.execute('updateModifier', {
                    objectId, modifierId: mod.id, params: { wrapMode: sel.value }
                });
                _renderStack(objectId);
                _doRender();
            });
        });

        /* Follow-path target select */
        body.querySelectorAll('.fp-target-sel').forEach(sel => {
            sel.addEventListener('change', () => {
                VectorEditor.app.execute('updateModifier', {
                    objectId, modifierId: mod.id, params: { targetObjectId: sel.value }
                });
                _doRender();
            });
        });

        /* Follow-path mode select — rebuild card to show correct fields */
        body.querySelectorAll('.fp-mode-sel').forEach(sel => {
            sel.addEventListener('change', () => {
                VectorEditor.app.execute('updateModifier', {
                    objectId, modifierId: mod.id, params: { distributionMode: sel.value }
                });
                _renderStack(objectId);
                _doRender();
            });
        });

        /* Follow-path position range — update label */
        body.querySelectorAll('.fp-position-range').forEach(rng => {
            rng.addEventListener('input', () => {
                var val = parseFloat(rng.value);
                var lbl = rng.parentElement.querySelector('.fp-position-val');
                if (lbl) lbl.textContent = Math.round(val * 100) + '%';
                VectorEditor.app.execute('updateModifier', {
                    objectId, modifierId: mod.id, params: { positionOnPath: val }
                });
                _doRender();
            });
        });

        /* Follow-path align checkbox */
        body.querySelectorAll('.fp-align-check').forEach(chk => {
            chk.addEventListener('change', () => {
                VectorEditor.app.execute('updateModifier', {
                    objectId, modifierId: mod.id, params: { alignToPath: chk.checked }
                });
                _doRender();
            });
        });

        /* Gooey affect-nearby checkbox — rebuild card to show/hide targets */
        body.querySelectorAll('.gooey-affect-check').forEach(chk => {
            chk.addEventListener('change', () => {
                VectorEditor.app.execute('updateModifier', {
                    objectId, modifierId: mod.id, params: { affectNearby: chk.checked }
                });
                _renderStack(objectId);
                _doRender();
            });
        });

        /* Gooey multi-select target objects */
        body.querySelectorAll('.gooey-target-sel').forEach(sel => {
            sel.addEventListener('change', () => {
                var selected = Array.from(sel.selectedOptions).map(o => o.value);
                VectorEditor.app.execute('updateModifier', {
                    objectId, modifierId: mod.id, params: { targetObjectIds: selected }
                });
                _doRender();
            });
        });

        /* Gooey range sliders — update label with value (not '%') */
        body.querySelectorAll('.gooey-range').forEach(rng => {
            rng.addEventListener('input', () => {
                var val = parseFloat(rng.value);
                var lbl = rng.parentElement.querySelector('.mod-param-val');
                if (lbl) lbl.textContent = rng.dataset.param === 'threshold' ? val.toFixed(2) : val;
                VectorEditor.app.execute('updateModifier', {
                    objectId, modifierId: mod.id, params: { [rng.dataset.param]: val }
                });
                _doRender();
            });
        });

        /* Influence range — update label (wrap modifier's influence only) */
        body.querySelectorAll('.mod-param-range:not(.gooey-range)').forEach(rng => {
            rng.addEventListener('input', () => {
                var val = parseFloat(rng.value);
                var lbl = rng.parentElement.querySelector('.mod-param-val');
                if (lbl) lbl.textContent = val + '%';
                VectorEditor.app.execute('updateModifier', {
                    objectId, modifierId: mod.id, params: { influence: val }
                });
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
        _bindDrag(header, card, objectId, mod.id);

        return card;
    }

    /* ── Param HTML builders ───────────────────────────────────────────────── */

    function _buildParams (mod, objectId) {
        if (mod.type === 'array')       return _arrayParams(mod.params);
        if (mod.type === 'boolean')     return _boolParams(mod.params, objectId);
        if (mod.type === 'pivot-point') return _pivotParams(mod.params, objectId);
        if (mod.type === 'wrap')        return _wrapParams(mod.params, objectId);
        if (mod.type === 'follow-path') return _followPathParams(mod.params, objectId);
        if (mod.type === 'gooey')       return _gooeyParams(mod.params, objectId);
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

    /* pivot-point ─── */
    function _pivotParams (p, objectId) {
        const mode = p.pivotMode || 'center';

        const cornerOpts = [
            {v:'tl',l:'Top-Left'},{v:'tc',l:'Top-Center'},{v:'tr',l:'Top-Right'},
            {v:'ml',l:'Mid-Left'},{v:'center',l:'Center'},{v:'mr',l:'Mid-Right'},
            {v:'bl',l:'Bot-Left'},{v:'bc',l:'Bot-Center'},{v:'br',l:'Bot-Right'}
        ];

        const doc     = VectorEditor.app?.document;
        const objects = doc ? doc.getAllObjects().filter(o => o.id !== objectId) : [];

        let objOpts = '<option value="">— pick object —</option>';
        objects.forEach(o => {
            objOpts += `<option value="${o.id}"${p.targetObjectId===o.id?' selected':''}>${o.name||o.id}</option>`;
        });
        if (objects.length === 0) objOpts = '<option value="" disabled>No other objects</option>';

        const cornerSel = cornerOpts.map(c =>
            `<option value="${c.v}"${((p.corner||'center')===c.v?' selected':'')}>${c.l}</option>`
        ).join('');

        return `
        <div class="mod-param-row">
            <span class="mod-param-label">Mode</span>
            <select class="mod-param-select" data-param="pivotMode">
                <option value="center"${mode==='center'?' selected':''}>Center</option>
                <option value="bbox-corners"${mode==='bbox-corners'?' selected':''}>Bounding Box</option>
                <option value="custom"${mode==='custom'?' selected':''}>Custom Point</option>
                <option value="object-based"${mode==='object-based'?' selected':''}>Object-based</option>
            </select>
        </div>
        ${mode==='bbox-corners' ? `
        <div class="mod-param-row">
            <span class="mod-param-label">Corner</span>
            <select class="mod-param-select pp-corner-sel">${cornerSel}</select>
        </div>
        ` : ''}
        ${mode==='custom' ? `
        <div class="mod-param-row">
            <span class="mod-param-label">X</span>
            <input type="number" class="mod-param-input" value="${p.customX||0}" data-param="customX">
        </div>
        <div class="mod-param-row">
            <span class="mod-param-label">Y</span>
            <input type="number" class="mod-param-input" value="${p.customY||0}" data-param="customY">
        </div>
        ` : ''}
        ${mode==='object-based' ? `
        <div class="mod-param-row">
            <span class="mod-param-label">Target</span>
            <select class="mod-param-select pp-target-sel">${objOpts}</select>
        </div>
        ` : ''}
        <div class="mod-param-row" style="margin-top:4px;">
            <span class="mod-param-label" style="flex:1; opacity:0.6;">Affect:</span>
        </div>
        <div class="mod-param-row" style="gap:12px; flex-wrap:wrap;">
            <label class="mod-radio" style="opacity:0.5;" title="Position is always pivot-agnostic">
                <input type="checkbox" checked disabled> Position
            </label>
            <label class="mod-radio">
                <input type="checkbox" class="pp-affect-check" data-affect="affectRotation"${p.affectRotation!==false?' checked':''}> Rotation
            </label>
            <label class="mod-radio">
                <input type="checkbox" class="pp-affect-check" data-affect="affectScale"${p.affectScale!==false?' checked':''}> Scale
            </label>
        </div>
        <div class="mod-param-row">
            <span class="mod-param-label">Gizmo</span>
            <input type="checkbox" class="mod-param-check pp-gizmo-check"${p.showGizmo!==false?' checked':''}>
        </div>
        `;
    }


    /* wrap ─── */
    function _wrapParams (p, objectId) {
        var mode = p.wrapMode || 'envelope';
        var doc     = VectorEditor.app?.document;
        var objects = doc ? doc.getAllObjects().filter(o => o.id !== objectId) : [];

        var opts = objects.length
            ? objects.map(o =>
                '<option value="'+o.id+'"'+(p.targetObjectId===o.id?' selected':'')+'>'+(o.name||o.id)+'</option>'
              ).join('')
            : '<option value="" disabled>No other objects</option>';

        return `
        <div class="mod-param-row">
            <span class="mod-param-label">Target</span>
            <select class="mod-param-select wrap-target-sel">
                <option value="">— pick object —</option>
                ${opts}
            </select>
        </div>
        <div class="mod-param-row">
            <span class="mod-param-label">Mode</span>
            <select class="mod-param-select" data-param="wrapMode">
                <option value="envelope"${mode==='envelope'?' selected':''}>Envelope</option>
                <option value="mesh-grid"${mode==='mesh-grid'?' selected':''}>Mesh Grid</option>
                <option value="curve-based"${mode==='curve-based'?' selected':''}>Curve-based</option>
            </select>
        </div>
        <div class="mod-param-row">
            <span class="mod-param-label">Influence</span>
            <input type="range" class="mod-param-range" min="0" max="100" value="${p.influence??50}" data-param="influence" style="flex:1;">
            <span class="mod-param-val">${p.influence??50}%</span>
        </div>
        <div class="mod-param-row">
            <span class="mod-param-label">Falloff</span>
            <select class="mod-param-select" data-param="falloff">
                <option value="linear"${(p.falloff||'linear')==='linear'?' selected':''}>Linear</option>
                <option value="smooth"${p.falloff==='smooth'?' selected':''}>Smooth</option>
                <option value="sharp"${p.falloff==='sharp'?' selected':''}>Sharp</option>
            </select>
        </div>
        ${mode==='mesh-grid' ? `
        <div class="mod-param-row">
            <span class="mod-param-label">Grid X</span>
            <input type="number" class="mod-param-input" value="${p.gridResX??4}" min="2" max="20" data-param="gridResX">
        </div>
        <div class="mod-param-row">
            <span class="mod-param-label">Grid Y</span>
            <input type="number" class="mod-param-input" value="${p.gridResY??4}" min="2" max="20" data-param="gridResY">
        </div>
        ` : ''}
        <div class="mod-param-row" style="gap:12px; flex-wrap:wrap;">
            <label class="mod-radio">
                <input type="checkbox" class="wrap-axis-check" data-axis="affectX"${p.affectX!==false?' checked':''}> Affect X
            </label>
            <label class="mod-radio">
                <input type="checkbox" class="wrap-axis-check" data-axis="affectY"${p.affectY!==false?' checked':''}> Affect Y
            </label>
        </div>
        `;
    }

    /* follow-path ─── */
    function _followPathParams (p, objectId) {
        var mode = p.distributionMode || 'single';
        var doc     = VectorEditor.app?.document;
        var objects = doc ? doc.getAllObjects().filter(o => o.id !== objectId) : [];

        var opts = objects.length
            ? objects.map(o =>
                '<option value="'+o.id+'"'+(p.targetObjectId===o.id?' selected':'')+'>'+(o.name||o.id)+'</option>'
              ).join('')
            : '<option value="" disabled>No other objects</option>';

        return `
        <div class="mod-param-row">
            <span class="mod-param-label">Path Object</span>
            <select class="mod-param-select fp-target-sel">
                <option value="">— pick path —</option>
                ${opts}
            </select>
        </div>
        ${mode === 'single' ? `
        <div class="mod-param-row">
            <span class="mod-param-label">Position</span>
            <input type="range" class="mod-param-range fp-position-range" min="0" max="1" step="0.01" value="${p.positionOnPath??0}" data-param="positionOnPath" style="flex:1;">
            <span class="mod-param-val fp-position-val">${Math.round((p.positionOnPath??0)*100)}%</span>
        </div>
        ` : ''}
        <div class="mod-param-row">
            <span class="mod-param-label">Offset</span>
            <input type="number" class="mod-param-input" value="${p.offset??0}" data-param="offset">
        </div>
        <div class="mod-param-row">
            <span class="mod-param-label">Align to Path</span>
            <input type="checkbox" class="mod-param-check fp-align-check"${p.alignToPath!==false?' checked':''} data-param="alignToPath">
        </div>
        <div class="mod-param-row">
            <span class="mod-param-label">Rotation °</span>
            <input type="number" class="mod-param-input" value="${p.rotationOffset??0}" data-param="rotationOffset">
        </div>
        <div class="mod-param-row">
            <span class="mod-param-label">Mode</span>
            <select class="mod-param-select fp-mode-sel" data-param="distributionMode">
                <option value="single"${mode==='single'?' selected':''}>Single</option>
                <option value="repeat"${mode==='repeat'?' selected':''}>Repeat Along Path</option>
                <option value="stretch"${mode==='stretch'?' selected':''}>Stretch to Fit</option>
            </select>
        </div>
        ${mode === 'repeat' ? `
        <div class="mod-param-row">
            <span class="mod-param-label">Count</span>
            <input type="number" class="mod-param-input" value="${p.count??10}" min="1" max="100" data-param="count">
        </div>
        <div class="mod-param-row">
            <span class="mod-param-label">Spacing</span>
            <input type="number" class="mod-param-input" value="${p.spacing??''}" placeholder="auto" data-param="spacing">
        </div>
        ` : ''}
        <div class="mod-param-row">
            <span class="mod-param-label">Follow Curve</span>
            <input type="checkbox" class="mod-param-check"${p.followCurveDirection!==false?' checked':''} data-param="followCurveDirection">
        </div>
        <div class="mod-param-row">
            <span class="mod-param-label">Flip Direction</span>
            <input type="checkbox" class="mod-param-check"${p.flipDirection?' checked':''} data-param="flipDirection">
        </div>
        `;
    }

    /* gooey ─── */
    function _gooeyParams (p, objectId) {
        var blendMode = p.fillBlend || 'merge';
        var doc     = VectorEditor.app?.document;
        var allObjs = doc ? doc.getAllObjects().filter(o => o.id !== objectId) : [];

        var targetIds = Array.isArray(p.targetObjectIds) ? p.targetObjectIds : [];

        var opts = allObjs.length
            ? allObjs.map(o => {
                var sel = targetIds.indexOf(o.id) >= 0 ? ' selected' : '';
                return '<option value="'+o.id+'"'+sel+'>'+(o.name||o.id)+'</option>';
              }).join('')
            : '<option value="" disabled>No other objects</option>';

        return `
        <div class="mod-param-row">
            <span class="mod-param-label">Influence</span>
            <input type="range" class="mod-param-range gooey-range" min="5" max="200" value="${p.influenceRadius??50}" data-param="influenceRadius" style="flex:1;">
            <span class="mod-param-val">${p.influenceRadius??50}</span>
        </div>
        <div class="mod-param-row">
            <span class="mod-param-label">Smoothness</span>
            <input type="range" class="mod-param-range gooey-range" min="0" max="100" value="${p.smoothness??70}" data-param="smoothness" style="flex:1;">
            <span class="mod-param-val">${p.smoothness??70}%</span>
        </div>
        <div class="mod-param-row">
            <span class="mod-param-label">Threshold</span>
            <input type="range" class="mod-param-range gooey-range" min="0.01" max="5" step="0.01" value="${p.threshold??1.0}" data-param="threshold" style="flex:1;">
            <span class="mod-param-val">${(p.threshold??1.0).toFixed(2)}</span>
        </div>
        <div class="mod-param-row">
            <span class="mod-param-label">Affect Nearby</span>
            <input type="checkbox" class="mod-param-check gooey-affect-check"${p.affectNearby?' checked':''} data-param="affectNearby">
        </div>
        ${p.affectNearby ? `
        <div class="mod-param-row">
            <span class="mod-param-label">Targets</span>
            <select class="mod-param-select gooey-target-sel" multiple size="3">
                ${opts}
            </select>
        </div>
        ` : ''}
        <div class="mod-param-row">
            <span class="mod-param-label">Fill Blend</span>
            <select class="mod-param-select" data-param="fillBlend">
                <option value="merge"${blendMode==='merge'?' selected':''}>Merge</option>
                <option value="additive"${blendMode==='additive'?' selected':''}>Additive</option>
                <option value="soft-merge"${blendMode==='soft-merge'?' selected':''}>Soft Merge</option>
            </select>
        </div>
        <div class="mod-param-row">
            <span class="mod-param-label">Keep Outline</span>
            <input type="checkbox" class="mod-param-check"${p.outlinePreservation?' checked':''} data-param="outlinePreservation">
        </div>
        <div class="mod-param-row">
            <span class="mod-param-label">Resolution</span>
            <input type="range" class="mod-param-range gooey-range" min="4" max="64" value="${p.resolution??24}" data-param="resolution" style="flex:1;">
            <span class="mod-param-val">${p.resolution??24}</span>
        </div>
        <div class="mod-param-row">
            <span class="mod-param-label">Anim Speed</span>
            <input type="number" class="mod-param-input" value="${p.animationSpeed??0}" data-param="animationSpeed">
        </div>
        `;
    }

    /* ── Drag-and-drop ──────────────────────────────────────────────────── */

    let _dragId = null;

    function _bindDrag (header, card, objectId, modId) {
        header.addEventListener('dragstart', e => {
            _dragId = modId;
            card.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
        });
        header.addEventListener('dragend', () => {
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
