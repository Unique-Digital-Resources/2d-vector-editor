/**
 * modifier-engine.js  —  /ui layer
 *
 * Reads modifier stacks from app.modifierRegistry, runs each modifier's
 * apply() function through a pipeline of LIVE Paper.js path objects.
 *
 * Pipeline design:
 *   • Seeds with a clone of the object's live Paper.js path
 *   • Each modifier receives { pp: PaperPath, style } items and returns
 *     new { pp: PaperPath, style } items (may fan out for array)
 *   • Consumed clones are removed immediately (no memory leak)
 *   • At the end, pathData is serialised and ALL remaining paths are removed
 *
 * This is called from render.js on EVERY render — fully realtime.
 *
 * All mutations still go through the command registry.  This module is
 * strictly read-only with respect to the application state.
 */
(function () {

    /** Map type strings → VectorEditor.Modifiers sub-module */
    const TYPE_MAP = {
        'array':   () => VectorEditor.Modifiers?.array,
        'boolean': () => VectorEditor.Modifiers?.boolean,
    };

    /**
     * Compute display path(s) for objectId.
     * Returns null if no active modifiers (caller renders base path normally).
     * Returns Array<{pathData, fill, stroke, strokeWidth}> otherwise.
     */
    function computeDisplayPaths (objectId) {
        const registry = VectorEditor.app?.modifierRegistry;
        if (!registry || !registry.hasActiveModifiers(objectId)) return null;

        const doc = VectorEditor.app.document;
        const obj = doc.getObject(objectId);
        if (!obj) return null;

        const sourcePP = VectorEditor.state.paperPaths[objectId];
        if (!sourcePP) return null;

        /* Active modifiers, oldest-first (applied from bottom of stack up) */
        const activeStack = registry.getStack(objectId)
            .filter(m => m.visible)
            .reverse();   // getStack() returns newest-first; we process oldest-first

        if (activeStack.length === 0) return null;

        const styleHint = {
            fill:        obj.fill        || 'none',
            stroke:      obj.stroke      || '#ffffff',
            strokeWidth: obj.strokeWidth || 2
        };

        /* Seed: one clone of the live source path */
        let items = [{ pp: sourcePP.clone(), style: styleHint }];

        for (const mod of activeStack) {
            const modFactory = TYPE_MAP[mod.type];
            if (!modFactory) continue;

            const modModule = modFactory();
            if (!modModule || typeof modModule.apply !== 'function') continue;

            const next = [];

            for (const item of items) {
                let produced;
                try {
                    produced = modModule.apply(item.pp, mod.params, item.style);
                } catch (err) {
                    console.warn(`[ModifierEngine] ${mod.type} threw:`, err);
                    produced = [item]; /* passthrough on error */
                }

                if (Array.isArray(produced) && produced.length > 0) {
                    next.push(...produced);
                    /* Only remove the input path if it is NOT reused in output */
                    if (!produced.some(p => p.pp === item.pp)) {
                        item.pp.remove();
                    }
                } else {
                    /* modifier returned nothing — keep item as-is */
                    next.push(item);
                }
            }

            items = next;
        }

        /* Serialise to SVG pathData and clean up every Paper.js path clone */
        const results = items.map(({ pp, style }) => {
            const pd = pp.pathData;
            pp.remove();
            return {
                pathData:    pd,
                fill:        style.fill,
                stroke:      style.stroke,
                strokeWidth: style.strokeWidth
            };
        });

        return results.length > 0 ? results : null;
    }

    window.VectorEditor = window.VectorEditor || {};
    window.VectorEditor.ModifierEngine = { computeDisplayPaths };

})();