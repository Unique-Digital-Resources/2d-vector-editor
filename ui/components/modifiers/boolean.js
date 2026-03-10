/**
 * boolean.js  —  /ui/components/modifiers
 *
 * Boolean modifier — handles ALL four subtypes in one place.
 * subType param: 'union' | 'intersect' | 'difference' | 'xor'
 *
 * Uses Paper.js boolean path operations directly on cloned path objects.
 * No SVG string re-import — avoids the slowness and reliability issues
 * of paper.project.importSVG().
 *
 * API (called by modifier-engine.js):
 *   apply(basePP, params, styleHint) → [{pp: PaperPath, style}]
 *
 * params:
 *   subType:        'union' | 'intersect' | 'difference' | 'xor'
 *   targetObjectId: string  (id of the second operand object)
 *
 * The engine calls pp.remove() on everything after serialising pathData.
 */
(function () {

    const OP_MAP = {
        'union':      'unite',
        'intersect':  'intersect',
        'difference': 'subtract',
        'xor':        'exclude'
    };

    function apply (basePP, params, styleHint) {
        const fallback = [{ pp: basePP.clone(), style: styleHint }];

        const targetId  = params.targetObjectId;
        const subType   = params.subType || 'union';
        const paperOp   = OP_MAP[subType];

        if (!targetId || !paperOp) return fallback;

        /* ── Get target Paper.js path from live state ─────────────────── */
        const targetPP = VectorEditor.state.paperPaths[targetId];
        if (!targetPP) return fallback;

        /* ── Clone both operands so we don't mutate live canvas paths ──── */
        const p1 = basePP.clone();
        const p2 = targetPP.clone();

        let result = null;
        try {
            result = p1[paperOp](p2);
        } catch (err) {
            console.warn(`[boolean modifier] ${paperOp} failed:`, err);
        }

        /* ── Cleanup clones (result is a new path; p1/p2 are intermediates) */
        p1.remove();
        p2.remove();

        if (!result || result.isEmpty()) {
            if (result) result.remove();
            return fallback;
        }

        return [{ pp: result, style: styleHint }];
    }

    window.VectorEditor = window.VectorEditor || {};
    window.VectorEditor.Modifiers = window.VectorEditor.Modifiers || {};
    window.VectorEditor.Modifiers.boolean = { apply };

})();