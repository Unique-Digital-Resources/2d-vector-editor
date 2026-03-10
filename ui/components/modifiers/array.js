/**
 * array.js  —  /ui/components/modifiers
 *
 * Array modifier.  Receives a CLONED Paper.js path object from the engine
 * pipeline, returns N new cloned Paper.js path objects — no SVG re-import.
 *
 * API (called by modifier-engine.js):
 *   apply(basePP, params, styleHint) → [{pp: PaperPath, style}, ...]
 *
 * The engine is responsible for calling pp.remove() on everything after use.
 *
 * params (grid mode):
 *   mode:'grid'  columns  rows  gapX  gapY  scaleX  scaleY
 *
 * params (radial mode):
 *   mode:'radial'  count  radius  startAngle  autoRotate
 */
(function () {

    function apply (basePP, params, styleHint) {
        const mode       = params.mode       || 'grid';
        const scaleX     = params.scaleX !== undefined ? +params.scaleX : 1;
        const scaleY     = params.scaleY !== undefined ? +params.scaleY : 1;

        const results = [];

        if (mode === 'grid') {
            const cols  = Math.max(1, (params.columns | 0) || 3);
            const rows  = Math.max(1, (params.rows    | 0) || 1);
            const gapX  = params.gapX !== undefined ? +params.gapX : 40;
            const gapY  = params.gapY !== undefined ? +params.gapY : 40;

            /* step = shape size + gap  so gap is the space between instances */
            const stepX = basePP.bounds.width  * scaleX + gapX;
            const stepY = basePP.bounds.height * scaleY + gapY;

            for (let row = 0; row < rows; row++) {
                for (let col = 0; col < cols; col++) {
                    const clone = basePP.clone();
                    if (scaleX !== 1 || scaleY !== 1) {
                        clone.scale(scaleX, scaleY, clone.bounds.topLeft);
                    }
                    clone.translate(new paper.Point(col * stepX, row * stepY));
                    results.push({ pp: clone, style: styleHint });
                }
            }

        } else { /* radial */
            const count      = Math.max(2, (params.count | 0) || 6);
            const radius     = params.radius     !== undefined ? +params.radius     : 100;
            const startAngle = params.startAngle !== undefined ? +params.startAngle : 0;
            const autoRotate = params.autoRotate !== undefined ? !!params.autoRotate : true;

            for (let i = 0; i < count; i++) {
                const angleDeg = startAngle + (360 / count) * i;
                const angleRad = (angleDeg * Math.PI) / 180;
                const dx       = radius * Math.cos(angleRad);
                const dy       = radius * Math.sin(angleRad);

                const clone = basePP.clone();
                if (scaleX !== 1 || scaleY !== 1) {
                    clone.scale(scaleX, scaleY, clone.bounds.center);
                }
                if (autoRotate) {
                    clone.rotate(angleDeg, clone.bounds.center);
                }
                clone.translate(new paper.Point(dx, dy));
                results.push({ pp: clone, style: styleHint });
            }
        }

        if (results.length === 0) {
            /* fallback: return original unchanged */
            results.push({ pp: basePP.clone(), style: styleHint });
        }

        return results;
    }

    window.VectorEditor = window.VectorEditor || {};
    window.VectorEditor.Modifiers = window.VectorEditor.Modifiers || {};
    window.VectorEditor.Modifiers.array = { apply };

})();