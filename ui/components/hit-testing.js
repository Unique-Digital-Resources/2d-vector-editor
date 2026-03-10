/**
 * hit-testing.js - Hit testing using Paper.js
 *
 * New exports:
 *  - hitTestBezierHandle(pos)          → checks handle dots for all selected points
 *  - hitTestPathSegment(pos, objectId) → stroke proximity → curve index
 */

(function () {

    const getState = () => VectorEditor.state;

    function dist2d(a, b) { return Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2); }

    /** Hit test for objects (fill or stroke proximity) */
    function hitTestObject(pos) {
        const state = getState();
        const doc   = VectorEditor.app.document;
        const objects = doc.getAllObjects();

        for (let i = objects.length - 1; i >= 0; i--) {
            const obj = objects[i];
            const pp  = state.paperPaths[obj.id];
            if (!pp) continue;

            const point = new paper.Point(pos.x, pos.y);
            if (pp.contains(point)) return obj;

            const nearest = pp.getNearestPoint(point);
            if (nearest && nearest.getDistance(point) < 10) return obj;
        }
        return null;
    }

    /** Hit test for Paper.js path segments (anchor points) */
    function hitTestSegment(pos, objectId) {
        const state = getState();
        const pp    = state.paperPaths[objectId];
        if (!pp) return null;

        const point     = new paper.Point(pos.x, pos.y);
        const hitResult = pp.hitTest(point, { segments: true, tolerance: 10 });

        if (hitResult && hitResult.type === 'segment') {
            return hitResult.segment.index;
        }
        return null;
    }

    /**
     * Hit test for path segment strokes (the curve between two anchors).
     * Returns the curve index (= start anchor index) or null.
     * Only tests if the object is in selectedObjectIds.
     */
    function hitTestPathSegment(pos, objectId) {
        const state = getState();
        const pp    = state.paperPaths[objectId];
        if (!pp) return null;

        const point     = new paper.Point(pos.x, pos.y);
        // Use stroke hit test with a generous tolerance
        const hitResult = pp.hitTest(point, { stroke: true, tolerance: 8 });

        if (hitResult && hitResult.type === 'stroke' && hitResult.location) {
            return hitResult.location.curve.index;
        }
        return null;
    }

    /**
     * Hit test for bezier handle dots (handleIn / handleOut) of all currently
     * selected anchor points. Returns the first matching handle descriptor or null.
     *
     * @returns {{ objectId, segmentIndex, handleType:'in'|'out' } | null}
     */
    function hitTestBezierHandle(pos) {
        const state = getState();
        const HIT_R = 8;

        for (const { objectId, pointIndex } of state.selectedPointIndices) {
            const pp = state.paperPaths[objectId];
            if (!pp) continue;

            const seg = pp.segments[pointIndex];
            if (!seg) continue;

            const pt = seg.point;

            if (seg.handleIn) {
                const mag = Math.sqrt(seg.handleIn.x ** 2 + seg.handleIn.y ** 2);
                if (mag > 1) {
                    const hx = pt.x + seg.handleIn.x;
                    const hy = pt.y + seg.handleIn.y;
                    if (dist2d(pos, { x: hx, y: hy }) <= HIT_R) {
                        return { objectId, segmentIndex: pointIndex, handleType: 'in' };
                    }
                }
            }

            if (seg.handleOut) {
                const mag = Math.sqrt(seg.handleOut.x ** 2 + seg.handleOut.y ** 2);
                if (mag > 1) {
                    const hx = pt.x + seg.handleOut.x;
                    const hy = pt.y + seg.handleOut.y;
                    if (dist2d(pos, { x: hx, y: hy }) <= HIT_R) {
                        return { objectId, segmentIndex: pointIndex, handleType: 'out' };
                    }
                }
            }
        }

        return null;
    }

    /** Hit test for gizmo resize handles */
    function hitTestGizmoHandle(pos, bbox) {
        const handles = {
            'nw': { x: bbox.x,                   y: bbox.y },
            'n':  { x: bbox.x + bbox.width / 2,  y: bbox.y },
            'ne': { x: bbox.x + bbox.width,       y: bbox.y },
            'e':  { x: bbox.x + bbox.width,       y: bbox.y + bbox.height / 2 },
            'se': { x: bbox.x + bbox.width,       y: bbox.y + bbox.height },
            's':  { x: bbox.x + bbox.width / 2,  y: bbox.y + bbox.height },
            'sw': { x: bbox.x,                   y: bbox.y + bbox.height },
            'w':  { x: bbox.x,                   y: bbox.y + bbox.height / 2 }
        };
        for (const [name, h] of Object.entries(handles)) {
            if (VectorEditor.dist(pos, h) < 10) return name;
        }
        return null;
    }

    /** Hit test for rotation handle */
    function hitTestRotationHandle(pos, bbox) {
        const rotPos = { x: bbox.x + bbox.width / 2, y: bbox.y - 25 };
        return VectorEditor.dist(pos, rotPos) < 10;
    }

    // --- Exports ---
    window.VectorEditor = window.VectorEditor || {};
    window.VectorEditor.hitTestObject          = hitTestObject;
    window.VectorEditor.hitTestSegment         = hitTestSegment;
    window.VectorEditor.hitTestPathSegment     = hitTestPathSegment;
    window.VectorEditor.hitTestBezierHandle    = hitTestBezierHandle;
    window.VectorEditor.hitTestGizmoHandle     = hitTestGizmoHandle;
    window.VectorEditor.hitTestRotationHandle  = hitTestRotationHandle;

})();