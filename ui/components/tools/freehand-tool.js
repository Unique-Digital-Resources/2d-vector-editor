/**
 * freehand-tool.js - Freehand drawing tool
 *
 * Changes:
 *  - Stores state.freehandStartPos so render.js can draw a visible start indicator
 *  - On mouseUp: if the final point is within CLOSE_RADIUS of the start, the path
 *    is closed and filled (matching the behaviour of the path drawing tools)
 */

(function () {

    const CLOSE_RADIUS = 24;   // px proximity to trigger auto-close

    function dist2d(a, b) {
        return Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2);
    }

    const tool = {

        onMouseDown(e, svgCanvas) {
            const { state, getMousePos, clearSelections } = VectorEditor;
            const pos = getMousePos(e, svgCanvas);

            state.isDrawing      = true;
            state.freehandStartPos = { ...pos };
            clearSelections();

            state.drawingPath = new paper.Path();
            state.drawingPath.strokeColor = '#00d4aa';
            state.drawingPath.strokeWidth = 2;
            state.drawingPath.dashArray   = [6, 3];
            state.drawingPath.add(new paper.Point(pos.x, pos.y));

            VectorEditor.render(svgCanvas);
        },

        onMouseMove(e, svgCanvas) {
            const { state, getMousePos, render } = VectorEditor;
            const pos = getMousePos(e, svgCanvas);

            state.currentMouse = pos;
            const el = document.getElementById('mousePos');
            if (el) el.textContent = `${Math.round(pos.x)}, ${Math.round(pos.y)}`;

            if (!state.isDrawing || !state.drawingPath) return;

            state.drawingPath.add(new paper.Point(pos.x, pos.y));
            render(svgCanvas);
        },

        onMouseUp(e, svgCanvas) {
            const { state, render, selectObject } = VectorEditor;

            if (!state.isDrawing || !state.drawingPath) return;
            state.isDrawing = false;

            const tempPath = state.drawingPath;
            state.drawingPath = null;

            // Detect close: last segment position vs. start position
            let nearStart = false;
            if (state.freehandStartPos && tempPath.segments.length > 2) {
                const lastSeg = tempPath.lastSegment;
                if (lastSeg) {
                    nearStart = dist2d(
                        { x: lastSeg.point.x, y: lastSeg.point.y },
                        state.freehandStartPos
                    ) < CLOSE_RADIUS;
                }
            }

            state.freehandStartPos = null;

            if (tempPath.segments.length < 3) {
                tempPath.remove();
                render(svgCanvas);
                return;
            }

            tempPath.remove();

            const pp = new paper.Path();
            tempPath.segments.forEach(seg => {
                pp.add(new paper.Segment(
                    new paper.Point(seg.point.x, seg.point.y),
                    seg.handleIn  ? new paper.Point(seg.handleIn.x, seg.handleIn.y)  : null,
                    seg.handleOut ? new paper.Point(seg.handleOut.x, seg.handleOut.y) : null
                ));
            });

            pp.simplify(10);

            if (nearStart) pp.closed = true;

            const fill = nearStart ? state.fillColor : 'none';
            pp.fillColor   = nearStart ? state.fillColor : null;
            pp.strokeColor = state.strokeColor;
            pp.strokeWidth = state.strokeWidth;

            const b = pp.bounds;
            const result = VectorEditor.app.execute('createShape', {
                type: 'freehand',
                pathData: pp.pathData,
                bounds: { x: b.x, y: b.y, width: b.width, height: b.height },
                closed: nearStart,
                style: { fill, stroke: state.strokeColor, strokeWidth: state.strokeWidth }
            });

            state.paperPaths[result.objectId] = pp;
            selectObject(result.objectId, false);
            render(svgCanvas);
        }
    };

    window.VectorEditor = window.VectorEditor || {};
    window.VectorEditor.tools = window.VectorEditor.tools || {};
    window.VectorEditor.tools.freehand = tool;

})();