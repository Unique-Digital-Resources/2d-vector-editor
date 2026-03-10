/**
 * objects-tab.js  —  /ui layer
 *
 * Renders the object list in the "Objects" tab pane.
 * Replaces the old object-box.js / layersList pattern.
 *
 * Selection mutations go through selectObject / toggleObjectSelection
 * (which are UI helpers that do NOT bypass commands — they call render).
 * Delete/Duplicate go through app.execute().
 */
(function () {

    const TYPE_ICON = {
        rectangle:    'mdi-rectangle-outline',
        ellipse:      'mdi-circle-outline',
        polygon:      'mdi-hexagon-outline',
        star:         'mdi-star-outline',
        path:         'mdi-vector-polyline',
        'arc-path':   'mdi-vector-circle',
        'bezier-path':'mdi-vector-bezier',
        freehand:     'mdi-draw',
    };

    /* ── render ────────────────────────────────────────────────────────── */

    function _render () {
        const list = document.getElementById('vtabObjectsList');
        if (!list) return;

        const state = VectorEditor.state;
        const doc   = VectorEditor.app?.document;
        if (!doc) return;

        const objects = [...doc.getAllObjects()].reverse(); // newest first
        list.innerHTML = '';

        if (objects.length === 0) {
            list.innerHTML = '<div class="vtab-empty">No objects yet</div>';
            return;
        }

        objects.forEach(obj => {
            const selected   = state.selectedObjectIds.includes(obj.id);
            const hasMods    = VectorEditor.app.modifierRegistry?.hasModifiers(obj.id);
            const icon       = TYPE_ICON[obj.type] || 'mdi-shape-outline';

            const item = document.createElement('div');
            item.className = 'obj-item' + (selected ? ' selected' : '');
            item.innerHTML = `
                <i class="mdi ${icon}"></i>
                <span class="obj-name">${obj.name || obj.id}</span>
                ${hasMods ? '<i class="mdi mdi-wrench-outline obj-mod-badge" title="Has modifiers"></i>' : ''}
            `;

            item.addEventListener('click', e => {
                if (e.ctrlKey || e.metaKey) {
                    VectorEditor.toggleObjectSelection(obj.id);
                } else if (e.shiftKey) {
                    VectorEditor.selectObject(obj.id, true);
                } else {
                    VectorEditor.selectObject(obj.id, false);
                }
                const canvas = document.getElementById('canvas');
                if (canvas) VectorEditor.render(canvas);
            });

            list.appendChild(item);
        });
    }

    /* ── context-menu wiring ────────────────────────────────────────────── */

    function _initContextMenu () {
        const cm = document.getElementById('contextMenu');
        if (!cm) return;

        document.querySelectorAll('.context-item').forEach(item => {
            item.addEventListener('click', () => {
                const { state } = VectorEditor;
                const action    = item.dataset.action;

                if (action === 'duplicate' && state.selectedObjectIds.length > 0) {
                    const result = VectorEditor.app.execute('duplicateObject', {
                        objectIds: state.selectedObjectIds,
                        offset:    { x: 20, y: 20 }
                    });
                    result.newObjectIds?.forEach((newId, i) => {
                        const srcId = state.selectedObjectIds[i] || state.selectedObjectIds[0];
                        const srcPP = state.paperPaths[srcId];
                        if (srcPP) {
                            const clone = srcPP.clone();
                            clone.position = new paper.Point(clone.position.x + 20, clone.position.y + 20);
                            state.paperPaths[newId] = clone;
                            VectorEditor.syncPathToCore(newId);
                        }
                    });
                    VectorEditor.clearSelections();
                    result.newObjectIds?.forEach(id => VectorEditor.selectObject(id, true));
                }

                if (action === 'delete' && state.selectedObjectIds.length > 0) {
                    VectorEditor.app.execute('deleteObject', { objectIds: [...state.selectedObjectIds] });
                    state.selectedObjectIds.forEach(id => {
                        state.paperPaths[id]?.remove();
                        delete state.paperPaths[id];
                        /* also clean up modifier registry */
                        VectorEditor.app.modifierRegistry?.removeAllForObject(id);
                    });
                    VectorEditor.clearSelections();
                }

                cm.classList.remove('visible');
                const canvas = document.getElementById('canvas');
                if (canvas) VectorEditor.render(canvas);
            });
        });

        document.addEventListener('click', e => {
            if (!cm.contains(e.target)) cm.classList.remove('visible');
        });
    }

    /* ── init ────────────────────────────────────────────────────────────── */

    function initObjectsTab () {
        _initContextMenu();
        window.addEventListener('vectorEditorUpdate', _render);
    }

    /* ── compat alias for legacy initObjectBox callers ───────────────────── */
    function initObjectBox () { initObjectsTab(); }

    /* ── export ──────────────────────────────────────────────────────────── */

    window.VectorEditor = window.VectorEditor || {};
    window.VectorEditor.initObjectsTab = initObjectsTab;
    window.VectorEditor.initObjectBox  = initObjectBox;   // backwards compat

})();