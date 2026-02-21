/**
 * object-box.js - Objects list panel
 * Displays and manages the list of objects in the scene
 */

(function() {
    'const { state } = VectorEditor;';

    // ============================================
    // OBJECT LIST RENDERING
    // ============================================

    function updateObjectList() {
        const layersList = document.getElementById('layersList');
        if (!layersList) return;

        layersList.innerHTML = '';
        
        [...state.objects].reverse().forEach(obj => {
            const isSelected = state.selectedObjectIds.includes(obj.id);
            const div = document.createElement('div');
            div.className = 'layer-item' + (isSelected ? ' selected' : '');
            div.innerHTML = `<i class="mdi mdi-shape"></i><span class="layer-name">${obj.name}</span>`;
            div.onclick = (e) => { 
                const { selectObject, toggleObjectSelection } = VectorEditor;
                if (e.ctrlKey || e.metaKey) {
                    toggleObjectSelection(obj.id);
                } else if (e.shiftKey) {
                    selectObject(obj.id, true);
                } else {
                    selectObject(obj.id, false);
                }
                const { render } = VectorEditor;
                const canvas = document.getElementById('canvas');
                if (canvas && render) render(canvas);
            };
            layersList.appendChild(div);
        });
    }

    // ============================================
    // CONTEXT MENU HANDLING
    // ============================================

    function initContextMenu() {
        const contextMenu = document.getElementById('contextMenu');
        if (!contextMenu) return;

        document.querySelectorAll('.context-item').forEach(item => {
            item.addEventListener('click', () => {
                const act = item.dataset.action;
                const { selectObject, clearSelections } = VectorEditor;
                
                if(act === 'duplicate') {
                    // Duplicate all selected objects
                    const newIds = [];
                    state.selectedObjectIds.forEach(objId => {
                        const obj = state.objects.find(o => o.id === objId);
                        if (obj) {
                            const copy = JSON.parse(JSON.stringify(obj));
                            copy.id = VectorEditor.generateId();
                            copy.points.forEach(p => { p.x+=20; p.y+=20; });
                            state.objects.push(copy);
                            newIds.push(copy.id);
                        }
                    });
                    // Select the new duplicates
                    clearSelections();
                    newIds.forEach(id => selectObject(id, true));
                } else if(act === 'delete') {
                    // Delete all selected objects
                    state.objects = state.objects.filter(o => !state.selectedObjectIds.includes(o.id));
                    clearSelections();
                }
                
                contextMenu.classList.remove('visible');
                const { render } = VectorEditor;
                const canvas = document.getElementById('canvas');
                if (canvas && render) render(canvas);
            });
        });

        document.addEventListener('click', e => {
            if(!contextMenu.contains(e.target)) contextMenu.classList.remove('visible');
        });
    }

    // ============================================
    // INITIALIZATION
    // ============================================

    function init() {
        initContextMenu();
        
        // Listen for updates
        window.addEventListener('vectorEditorUpdate', updateObjectList);
    }

    // ============================================
    // EXPORTS
    // ============================================

    window.VectorEditor = window.VectorEditor || {};
    window.VectorEditor.updateObjectList = updateObjectList;
    window.VectorEditor.initObjectBox = init;

})();
