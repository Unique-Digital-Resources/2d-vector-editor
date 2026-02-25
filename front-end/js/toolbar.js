/**
 * toolbar.js - Tool management
 * Manages and handles tools, each tool named <name>-tool.js
 * Group of each tool determined in tool itself and placed by toolbar.js
 */

(function() {

    // ============================================
    // TOOL MANAGEMENT
    // ============================================

    function setTool(toolName) {
        const { state, render } = VectorEditor;
        
        if (state.drawingPoints && !['polyline', 'arc', 'spline'].includes(toolName)) {
            state.drawingPoints = null;
            state.drawingEdges = null;
            state.drawingHandles = null;
        }

        state.tool = toolName;
        
        // Update button states
        document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
        const btn = document.querySelector(`[data-tool="${toolName}"]`);
        if(btn) btn.classList.add('active');
        
        // Update status bar
        const toolStatus = document.getElementById('toolStatus');
        if (toolStatus) {
            const names = { 
                select: 'Select/Resize', 
                rotate: 'Rotate', 
                rectangle: 'Rectangle', 
                circle: 'Circle', 
                polygon: 'Polygon', 
                polyline: 'Lines', 
                arc: 'Arc',
                spline: 'Spline' 
            };
            toolStatus.textContent = names[toolName] || 'Select';
        }
        
        // Show/hide arc settings
        const arcSettingsGroup = document.getElementById('arcSettings');
        if (arcSettingsGroup) {
            arcSettingsGroup.style.display = toolName === 'arc' ? 'flex' : 'none';
        }
        
        // Trigger render
        if (render) {
            const canvas = document.getElementById('canvas');
            if (canvas) render(canvas);
        }
    }

    // ============================================
    // TOOLBAR INITIALIZATION
    // ============================================

    function initToolbar() {
        // Attach click handlers to existing toolbar buttons
        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.addEventListener('click', () => setTool(btn.dataset.tool));
        });
    }

    // ============================================
    // KEYBOARD SHORTCUTS
    // ============================================

    function initKeyboardShortcuts() {
        document.addEventListener('keydown', e => {
            if(e.target.tagName === 'INPUT') return;

            const { state, finishDrawing, render, clearSelections } = VectorEditor;
            const canvas = document.getElementById('canvas');

            if (e.key === 'Enter' && state.drawingPoints) {
                if (canvas && finishDrawing) finishDrawing(canvas, false);
                return;
            }

            if (e.key === 'Control' && state.drawingPoints) {
                const drawingTools = ['polyline', 'arc', 'spline'];
                const currentIdx = drawingTools.indexOf(state.tool);
                const nextTool = drawingTools[(currentIdx + 1) % drawingTools.length];
                state.isDraggingHandle = false;
                state.draggingHandleType = null;
                setTool(nextTool);
                return;
            }

            switch(e.key.toLowerCase()) {
                case 'v': setTool('select'); break;
                case 'o': setTool('rotate'); break;
                case 'm': setTool('rectangle'); break;
                case 'c': setTool('circle'); break;
                case 'y': setTool('polygon'); break;
                case 'p': setTool('polyline'); break;
                case 'a': 
                    // Only handle 'a' without modifiers (for arc tool)
                    if (!e.ctrlKey && !e.metaKey && !e.shiftKey) {
                        setTool('arc');
                    }
                    break;
                case 's':
                    // Only handle 's' without modifiers (for spline tool)
                    if (!e.ctrlKey && !e.metaKey) {
                        setTool('spline');
                    }
                    break;
                case 'delete': 
                case 'backspace':
                    if (state.drawingPoints) {
                         state.drawingPoints.pop();
                         if(state.drawingEdges.length > 0) state.drawingEdges.pop();
                         if (state.drawingHandles && state.drawingHandles.length > 0) state.drawingHandles.pop();
                         if (state.drawingPoints.length === 0) {
                             state.drawingPoints = null;
                             state.drawingEdges = null;
                             state.drawingHandles = null;
                         }
                         if (canvas && render) render(canvas);
                    } else if (state.selectedObjectIds.length > 0) {
                         // Delete all selected objects
                         state.objects = state.objects.filter(o => !state.selectedObjectIds.includes(o.id));
                         clearSelections();
                         if (canvas && render) render(canvas);
                    }
                break;
            }
        });
    }

    // ============================================
    // EXPORTS
    // ============================================

    window.VectorEditor = window.VectorEditor || {};
    window.VectorEditor.setTool = setTool;
    window.VectorEditor.initToolbar = initToolbar;
    window.VectorEditor.initKeyboardShortcuts = initKeyboardShortcuts;

})();
