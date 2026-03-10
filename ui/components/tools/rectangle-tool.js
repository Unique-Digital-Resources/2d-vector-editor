/**
 * rectangle-tool.js - Rectangle creation tool using Paper.js
 * Fresh implementation - click+drag to create rectangles
 */

(function() {

    const tool = {
        onMouseDown(e, svgCanvas) {
            const { state, getMousePos, clearSelections } = VectorEditor;
            const pos = getMousePos(e, svgCanvas);
            state.isDrawing = true;
            state.dragStart = { ...pos };
            clearSelections();

            // Create preview path
            state.drawingPath = new paper.Path.Rectangle({
                point: [pos.x, pos.y],
                size: [1, 1],
                strokeColor: '#00d4aa',
                fillColor: null,
                strokeWidth: 2,
                dashArray: [6, 3]
            });
        },

        onMouseMove(e, svgCanvas) {
            const { state, getMousePos, render } = VectorEditor;
            const pos = getMousePos(e, svgCanvas);
            state.currentMouse = pos;

            const mousePosEl = document.getElementById('mousePos');
            if (mousePosEl) mousePosEl.textContent = `${Math.round(pos.x)}, ${Math.round(pos.y)}`;

            if (!state.isDrawing || !state.drawingPath) return;

            const x = Math.min(pos.x, state.dragStart.x);
            const y = Math.min(pos.y, state.dragStart.y);
            const w = Math.abs(pos.x - state.dragStart.x);
            const h = Math.abs(pos.y - state.dragStart.y);

            state.drawingPath.remove();
            state.drawingPath = new paper.Path.Rectangle({
                point: [x, y],
                size: [w, h],
                strokeColor: '#00d4aa',
                fillColor: null,
                strokeWidth: 2,
                dashArray: [6, 3]
            });

            render(svgCanvas);
        },

        onMouseUp(e, svgCanvas) {
            const { state, getMousePos, render, selectObject } = VectorEditor;
            const pos = getMousePos(e, svgCanvas);

            if (state.drawingPath) {
                state.drawingPath.remove();
                state.drawingPath = null;
            }

            if (!state.isDrawing) return;
            state.isDrawing = false;

            const x = Math.min(pos.x, state.dragStart.x);
            const y = Math.min(pos.y, state.dragStart.y);
            const w = Math.abs(pos.x - state.dragStart.x);
            const h = Math.abs(pos.y - state.dragStart.y);

            if (w < 5 || h < 5) return;

            // Create the actual rectangle path
            const pp = new paper.Path.Rectangle({
                point: [x, y],
                size: [w, h]
            });
            pp.fillColor = state.fillColor;
            pp.strokeColor = state.strokeColor;
            pp.strokeWidth = state.strokeWidth;

            const b = pp.bounds;
            const result = VectorEditor.app.execute('createShape', {
                type: 'rectangle',
                pathData: pp.pathData,
                bounds: { x: b.x, y: b.y, width: b.width, height: b.height },
                segments: [],
                closed: true,
                style: { fill: state.fillColor, stroke: state.strokeColor, strokeWidth: state.strokeWidth }
            });

            state.paperPaths[result.objectId] = pp;
            selectObject(result.objectId, false);
            render(svgCanvas);
        }
    };

    window.VectorEditor = window.VectorEditor || {};
    window.VectorEditor.tools = window.VectorEditor.tools || {};
    window.VectorEditor.tools.rectangle = tool;

})();
