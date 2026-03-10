/**
 * bool-intersect.js  —  /ui/components/modifiers
 * Boolean INTERSECTION  (A ∩ B) — area common to both shapes.
 * Uses Paper.js p1.intersect(p2).
 */
(function () {
    function _import (d) {
        if (!d) return null;
        try {
            const item = paper.project.importSVG(`<svg xmlns="http://www.w3.org/2000/svg"><path d="${d}"/></svg>`);
            if (!item) return null;
            if (item.className === 'Group' || (item.children && item.children.length)) {
                const c = item.firstChild;
                if (c) { paper.project.activeLayer.addChild(c); item.remove(); return c; }
                item.remove(); return null;
            }
            return item;
        } catch { return null; }
    }
    function _target (id) {
        if (!id) return null;
        const pp = VectorEditor.state.paperPaths[id];
        if (pp) return pp.pathData;
        const obj = VectorEditor.app.document.getObject(id);
        return obj ? obj.pathData : null;
    }
    function apply (basePathData, params, s) {
        const td = _target(params.targetObjectId);
        if (!td) return [{ pathData: basePathData, fill: s.fill, stroke: s.stroke, strokeWidth: s.strokeWidth }];
        const p1 = _import(basePathData), p2 = _import(td);
        if (!p1 || !p2) { p1?.remove(); p2?.remove(); return [{ pathData: basePathData, fill: s.fill, stroke: s.stroke, strokeWidth: s.strokeWidth }]; }
        let r = null;
        try { r = p1.intersect(p2); } catch (e) { console.warn('[bool-intersect]', e); }
        const pathData = r ? r.pathData : basePathData;
        p1.remove(); p2.remove(); if (r) r.remove();
        return [{ pathData, fill: s.fill, stroke: s.stroke, strokeWidth: s.strokeWidth }];
    }
    window.VectorEditor = window.VectorEditor || {};
    window.VectorEditor.Modifiers = window.VectorEditor.Modifiers || {};
    window.VectorEditor.Modifiers['bool-intersect'] = { apply };
})();