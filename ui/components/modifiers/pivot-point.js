/**
 * pivot-point.js  —  /ui layer / modifiers
 *
 * Pivot Point Modifier — changes the transformation origin for an object.
 *
 * This modifier does NOT produce multiple output paths (unlike array/boolean).
 * Instead it:
 *   1. Computes a pivot point based on the configured mode.
 *   2. Intercepts interactive transforms (scale, rotate) in board-events.js
 *      so they are performed relative to the pivot instead of the bbox center.
 *   3. Renders a pivot gizmo on the canvas when enabled.
 *   4. Passes through the geometry unchanged in the modifier pipeline.
 *
 * Pivot Modes:
 *   - center            : bounding box center (default)
 *   - bbox-corners      : one of the 8 bounding-box corner/edge midpoints
 *   - custom            : arbitrary (x, y) point, draggable on canvas
 *   - object-based      : center of another object
 *
 * Settings:
 *   - pivotMode          : 'center' | 'bbox-corners' | 'custom' | 'object-based'
 *   - corner             : 'tl'|'tc'|'tr'|'ml'|'center'|'mr'|'bl'|'bc'|'br'  (bbox mode)
 *   - customX, customY   : number  (custom mode)
 *   - targetObjectId     : string   (object-based mode)
 *   - affectPosition     : boolean  (reserved — position is always pivot-agnostic)
 *   - affectRotation     : boolean
 *   - affectScale        : boolean
 *   - showGizmo          : boolean
 */
(function () {

    /* ── Compute the pivot point for an object ─────────────────────────── */

    function computePivot(objectId, params) {
        var state = VectorEditor.state;
        var mode  = params.pivotMode || 'center';

        if (mode === 'center') {
            var pp = state.paperPaths[objectId];
            if (!pp) return null;
            return { x: pp.position.x, y: pp.position.y };
        }

        if (mode === 'bbox-corners') {
            var pp = state.paperPaths[objectId];
            if (!pp) return null;
            var b  = pp.bounds;
            var cx = b.x + b.width  / 2;
            var cy = b.y + b.height / 2;
            switch (params.corner || 'center') {
                case 'tl':  return { x: b.x,  y: b.y };
                case 'tc':  return { x: cx,   y: b.y };
                case 'tr':  return { x: b.x + b.width, y: b.y };
                case 'ml':  return { x: b.x,  y: cy };
                case 'center': return { x: cx, y: cy };
                case 'mr':  return { x: b.x + b.width, y: cy };
                case 'bl':  return { x: b.x,  y: b.y + b.height };
                case 'bc':  return { x: cx,   y: b.y + b.height };
                case 'br':  return { x: b.x + b.width, y: b.y + b.height };
                default:    return { x: cx, y: cy };
            }
        }

        if (mode === 'custom') {
            return {
                x: params.customX != null ? params.customX : 0,
                y: params.customY != null ? params.customY : 0
            };
        }

        if (mode === 'object-based') {
            var tid = params.targetObjectId;
            if (!tid) return null;
            var tpp = state.paperPaths[tid];
            if (!tpp) return null;
            return { x: tpp.position.x, y: tpp.position.y };
        }

        /* fallback */
        var pp = state.paperPaths[objectId];
        return pp ? { x: pp.position.x, y: pp.position.y } : null;
    }

    /* ── apply() — modifier pipeline pass-through ────────────────────────
     *
     * The pivot-point modifier does not alter geometry; it only changes how
     * interactive transforms are interpreted.  In the pipeline we simply
     * pass through the input unchanged.
     */
    function apply(basePP, params, styleHint) {
        return [{ pp: basePP, style: styleHint }];
    }

    /* ── Exports ────────────────────────────────────────────────────────── */

    window.VectorEditor = window.VectorEditor || {};
    window.VectorEditor.Modifiers = window.VectorEditor.Modifiers || {};
    window.VectorEditor.Modifiers['pivot-point'] = { apply: apply, computePivot: computePivot };

})();
