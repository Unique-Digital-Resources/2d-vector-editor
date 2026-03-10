/**
 * bool-union.js  —  /ui/components/modifiers
 *
 * Boolean UNION  (A ∪ B) — area covered by either shape.
 * Uses Paper.js p1.unite(p2).
 *
 * API:
 *   VectorEditor.Modifiers['bool-union'].apply(basePathData, params, styleHint)
 *   → Array<{ pathData, fill, stroke, strokeWidth }>
 *
 * params: { targetObjectId: string }
 */
(function () {

    function _import (pathData) {
        if (!pathData) return null;
        try {
            const svg  = `<svg xmlns="http://www.w3.org/2000/svg"><path d="${pathData}"/></svg>`;
            const item = paper.project.importSVG(svg);
            if (!item) return null;
            if (item.className === 'Group' || (item.children && item.children.length)) {
                const c = item.firstChild;
                if (c) { paper.project.activeLayer.addChild(c); item.remove(); return c; }
                item.remove(); return null;
            }
            return item;
        } catch (e) { return null; }
    }

    function _getTargetPathData (targetObjectId) {
        if (!targetObjectId) return null;
        const pp = VectorEditor.state.paperPaths[targetObjectId];
        if (pp) return pp.pathData;
        const obj = VectorEditor.app.document.getObject(targetObjectId);
        return obj ? obj.pathData : null;
    }

    function apply (basePathData, params, styleHint) {
        const targetData = _getTargetPathData(params.targetObjectId);
        if (!targetData) return [{ pathData: basePathData, ...styleHint }];

        const p1 = _import(basePathData);
        const p2 = _import(targetData);
        if (!p1 || !p2) { p1?.remove(); p2?.remove(); return [{ pathData: basePathData, ...styleHint }]; }

        let result = null;
        try { result = p1.unite(p2); } catch (e) { console.warn('[bool-union]', e); }

        const pathData = result ? result.pathData : basePathData;
        p1.remove(); p2.remove(); if (result) result.remove();

        return [{ pathData, fill: styleHint.fill, stroke: styleHint.stroke, strokeWidth: styleHint.strokeWidth }];
    }

    window.VectorEditor = window.VectorEditor || {};
    window.VectorEditor.Modifiers = window.VectorEditor.Modifiers || {};
    window.VectorEditor.Modifiers['bool-union'] = { apply };

})();