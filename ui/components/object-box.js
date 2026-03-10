/**
 * object-box.js - Objects list panel
 * Displays and manages object list in the right panel
 */

(function() {

    function updateObjectList() {
        const layersList = document.getElementById('layersList');
        if (!layersList) return;

        layersList.innerHTML = '';
        const state = VectorEditor.state;
        const doc = VectorEditor.app?.document;
        if (!doc) return;

        const objects = doc.getAllObjects();

        [...objects].reverse().forEach(obj => {
            const isSelected = state.selectedObjectIds.includes(obj.id);
            const div = document.createElement('div');
            div.className = 'layer-item' + (isSelected ? ' selected' : '');

            const typeIcons = {
                rectangle: 'mdi-rectangle-outline',
                ellipse: 'mdi-circle-outline',
                polygon: 'mdi-hexagon-outline',
                star: 'mdi-star-outline',
                path: 'mdi-vector-polyline',
                freehand: 'mdi-draw'
            };
            const icon = typeIcons[obj.type] || 'mdi-shape';

            div.innerHTML = `<i class="mdi ${icon}"></i><span class="layer-name">${obj.name}</span>`;
            div.onclick = (e) => {
                if (e.ctrlKey || e.metaKey) {
                    VectorEditor.toggleObjectSelection(obj.id);
                } else if (e.shiftKey) {
                    VectorEditor.selectObject(obj.id, true);
                } else {
                    VectorEditor.selectObject(obj.id, false);
                }
                const canvas = document.getElementById('canvas');
                if (canvas) VectorEditor.render(canvas);
            };
            layersList.appendChild(div);
        });
    }

    function initContextMenu() {
        const contextMenu = document.getElementById('contextMenu');
        if (!contextMenu) return;

        document.querySelectorAll('.context-item').forEach(item => {
            item.addEventListener('click', () => {
                const act = item.dataset.action;
                const state = VectorEditor.state;

                if (act === 'duplicate' && state.selectedObjectIds.length > 0) {
                    const result = VectorEditor.app.execute('duplicateObject', {
                        objectIds: state.selectedObjectIds,
                        offset: { x: 20, y: 20 }
                    });
                    // Create paper paths for duplicates
                    result.newObjectIds.forEach((newId, idx) => {
                        const srcId = state.selectedObjectIds[idx] || state.selectedObjectIds[0];
                        const srcPP = state.paperPaths[srcId];
                        if (srcPP) {
                            const clone = srcPP.clone();
                            clone.position = new paper.Point(
                                clone.position.x + 20,
                                clone.position.y + 20
                            );
                            state.paperPaths[newId] = clone;
                            VectorEditor.syncPathToCore(newId);
                        }
                    });

                    VectorEditor.clearSelections();
                    result.newObjectIds.forEach(id => VectorEditor.selectObject(id, true));
                } else if (act === 'delete' && state.selectedObjectIds.length > 0) {
                    VectorEditor.app.execute('deleteObject', {
                        objectIds: [...state.selectedObjectIds]
                    });
                    state.selectedObjectIds.forEach(id => {
                        if (state.paperPaths[id]) {
                            state.paperPaths[id].remove();
                            delete state.paperPaths[id];
                        }
                    });
                    VectorEditor.clearSelections();
                }

                contextMenu.classList.remove('visible');
                const canvas = document.getElementById('canvas');
                if (canvas) VectorEditor.render(canvas);
            });
        });

        document.addEventListener('click', e => {
            if (!contextMenu.contains(e.target)) contextMenu.classList.remove('visible');
        });
    }

    function init() {
        initContextMenu();
        window.addEventListener('vectorEditorUpdate', updateObjectList);
    }

    // --- Exports ---
    window.VectorEditor = window.VectorEditor || {};
    window.VectorEditor.updateObjectList = updateObjectList;
    window.VectorEditor.initObjectBox = init;

})();
