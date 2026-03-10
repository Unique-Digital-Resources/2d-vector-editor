/**
 * star-tool.js - Star creation tool using Paper.js
 * Fresh implementation - click+drag from center
 */

(function() {

    const tool = {
        onMouseDown(e, svgCanvas) {
            const { state, getMousePos, clearSelections } = VectorEditor;
            const pos = getMousePos(e, svgCanvas);
            state.isDrawing = true;
            state.dragStart = { ...pos };
            clearSelections();
        },

        onMouseMove(e, svgCanvas) {
            const { state, getMousePos, render } = VectorEditor;
            const pos = getMousePos(e, svgCanvas);
            state.currentMouse = pos;

            const mousePosEl = document.getElementById('mousePos');
            if (mousePosEl) mousePosEl.textContent = `${Math.round(pos.x)}, ${Math.round(pos.y)}`;

            if (!state.isDrawing) return;

            if (state.drawingPath) {
                state.drawingPath.remove();
            }

            const dx = pos.x - state.dragStart.x;
            const dy = pos.y - state.dragStart.y;
            const radius = Math.sqrt(dx * dx + dy * dy);

            if (radius > 5) {
                state.drawingPath = new paper.Path.Star({
                    center: [state.dragStart.x, state.dragStart.y],
                    points: state.starPoints || 5,
                    radius1: radius,
                    radius2: radius * 0.4,
                    strokeColor: '#00d4aa',
                    fillColor: null,
                    strokeWidth: 2,
                    dashArray: [6, 3]
                });
            }

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

            const dx = pos.x - state.dragStart.x;
            const dy = pos.y - state.dragStart.y;
            const radius = Math.sqrt(dx * dx + dy * dy);

            if (radius < 5) return;

            const pp = new paper.Path.Star({
                center: [state.dragStart.x, state.dragStart.y],
                points: state.starPoints || 5,
                radius1: radius,
                radius2: radius * 0.4
            });
            pp.fillColor = state.fillColor;
            pp.strokeColor = state.strokeColor;
            pp.strokeWidth = state.strokeWidth;

            const b = pp.bounds;
            const result = VectorEditor.app.execute('createShape', {
                type: 'star',
                pathData: pp.pathData,
                bounds: { x: b.x, y: b.y, width: b.width, height: b.height },
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
    window.VectorEditor.tools.star = tool;

})();
