/**
 * follow-path.js  —  /ui/components/modifiers
 *
 * Follow-Path modifier.  Attaches an object along a curve/path.
 * Receives a CLONED Paper.js path object from the engine pipeline,
 * returns one or more cloned Paper.js path objects positioned on
 * the target path.
 *
 * API (called by modifier-engine.js):
 *   apply(basePP, params, styleHint) → [{pp: PaperPath, style}, ...]
 *
 * params:
 *   targetObjectId       : string   – id of the path to follow
 *   positionOnPath       : number 0–1  (default 0)
 *   offset               : number   – perpendicular offset from path (default 0)
 *   alignToPath          : boolean  – rotate to match tangent (default true)
 *   rotationOffset       : number (degrees) – extra rotation (default 0)
 *   distributionMode     : 'single' | 'repeat' | 'stretch' (default 'single')
 *   count                : number   – copies in repeat mode (default 10)
 *   spacing              : number   – fixed spacing in repeat mode (default null = even)
 *   followCurveDirection : boolean  – follow tangent direction (default true)
 *   flipDirection        : boolean  – flip 180° (default false)
 */
(function () {

    /* ═══════════════════════════════════════════════════════════════════════
       Helpers
    ═══════════════════════════════════════════════════════════════════════ */

    /**
     * Get position, tangent, and normal at a given arc-length on the target path.
     * @param {paper.Path} targetPP
     * @param {number} t  – parametric position 0–1
     * @returns {{ point: paper.Point, tangent: paper.Point, normal: paper.Point } | null}
     */
    function getLocationOnPath(targetPP, t) {
        var pathLen = targetPP.length;
        if (!pathLen || pathLen < 1) return null;
        var arcPos = Math.max(0, Math.min(1, t)) * pathLen;
        var loc = targetPP.getLocationAt(arcPos);
        if (!loc) return null;
        return {
            point:   loc.point,
            tangent: loc.tangent,
            normal:  loc.normal
        };
    }

    /**
     * Compute the rotation angle (degrees) based on settings.
     * - alignToPath=false  →  no tangent rotation
     * - followCurveDirection=false  →  no tangent rotation (same as align off)
     * - flipDirection  →  +180°
     * - rotationOffset  →  additive
     */
    function computeRotationDeg(tangent, alignToPath, followCurveDirection, flipDirection, rotationOffset) {
        var deg = rotationOffset || 0;
        if (alignToPath && followCurveDirection && tangent) {
            deg += Math.atan2(tangent.y, tangent.x) * (180 / Math.PI);
        }
        if (flipDirection) {
            deg += 180;
        }
        return deg;
    }

    /**
     * Place a single clone at a parametric position on the target path.
     */
    function placeAt(targetPP, clone, t, offset, alignToPath, rotationOffset, flipDirection, followCurveDirection) {
        var loc = getLocationOnPath(targetPP, t);
        if (!loc) return;

        // Position
        var tx = loc.point.x;
        var ty = loc.point.y;
        if (offset && loc.normal) {
            tx += loc.normal.x * offset;
            ty += loc.normal.y * offset;
        }

        var center = clone.bounds.center;
        clone.translate(new paper.Point(tx - center.x, ty - center.y));

        // Rotation
        var rotDeg = computeRotationDeg(loc.tangent, alignToPath, followCurveDirection, flipDirection, rotationOffset);
        if (rotDeg !== 0) {
            clone.rotate(rotDeg, clone.bounds.center);
        }
    }

    /* ═══════════════════════════════════════════════════════════════════════
       Stretch-to-Fit deformation
    ═══════════════════════════════════════════════════════════════════════ */

    /**
     * Deform the base object so that it stretches along the target path.
     *
     * Strategy:
     *   1. For each segment of the base object, compute its relative position
     *      within the bounding box (relX = 0..1 left->right, relY = 0..1 top->bottom).
     *   2. Map relX -> parametric position t along the target path.
     *   3. Offset the mapped point perpendicular to the path by
     *      (relY - 0.5) * bboxHeight * scaleY.
     *   4. Rebuild segment handles by computing the local tangent/normal
     *      frame at each anchor and transforming handles accordingly.
     *
     * This preserves bezier curves in the output (handles are transformed
     * into the path-local coordinate frame).
     */
    function stretchAlongPath(basePP, targetPP, params) {
        var segs = basePP.segments;
        if (!segs || segs.length < 2) return null;

        var srcBbox  = basePP.bounds;
        var srcW     = srcBbox.width;
        var srcH     = srcBbox.height;
        var pathLen  = targetPP.length;

        if (srcW < 0.01 || srcH < 0.01 || pathLen < 1) return null;

        var offset         = params.offset || 0;
        var alignToPath    = params.alignToPath !== false;
        var followCurveDir = params.followCurveDirection !== false;
        var flipDirection  = !!params.flipDirection;
        var rotationOffset = params.rotationOffset || 0;

        // Build a new Paper.js Path by mapping each original segment
        var newPath = new paper.Path();
        newPath.closed = basePP.closed;

        // Pre-compute mapped positions and local frames for each segment
        var segData = [];
        for (var i = 0; i < segs.length; i++) {
            var seg   = segs[i];
            var pt    = seg.point;
            var relX  = (pt.x - srcBbox.x) / srcW;   // 0..1
            var relY  = (pt.y - srcBbox.y) / srcH;   // 0..1
            var t     = Math.max(0, Math.min(1, relX));
            var loc   = getLocationOnPath(targetPP, t);
            if (!loc) {
                newPath.remove();
                return null;
            }

            // Base mapped position
            var mappedX = loc.point.x;
            var mappedY = loc.point.y;

            // Perpendicular offset from relative Y within the object
            var perpOffset = (relY - 0.5) * srcH;
            if (loc.normal) {
                mappedX += loc.normal.x * perpOffset;
                mappedY += loc.normal.y * perpOffset;
            }
            // User-specified perpendicular offset
            if (offset && loc.normal) {
                mappedX += loc.normal.x * offset;
                mappedY += loc.normal.y * offset;
            }

            segData.push({
                origSeg:     seg,
                mappedPoint: new paper.Point(mappedX, mappedY),
                tangent:     loc.tangent,
                normal:      loc.normal
            });
        }

        // Build segments with transformed handles
        for (var j = 0; j < segData.length; j++) {
            var sd     = segData[j];
            var orig   = sd.origSeg;
            var tFrame = sd.tangent;
            var nFrame = sd.normal;

            // Transform handles into the local (tangent, normal) frame.
            // Original handles are in global (x,y) coordinates relative to
            // the original anchor point.  We decompose each handle into
            // components along the local axes, then rebuild in the mapped frame.
            var hIn  = orig.handleIn  ? { x: orig.handleIn.x,  y: orig.handleIn.y }  : { x: 0, y: 0 };
            var hOut = orig.handleOut ? { x: orig.handleOut.x, y: orig.handleOut.y } : { x: 0, y: 0 };

            var newHandleIn  = transformHandle(hIn,  tFrame, nFrame);
            var newHandleOut = transformHandle(hOut, tFrame, nFrame);

            newPath.add(new paper.Segment(sd.mappedPoint, newHandleIn, newHandleOut));
        }

        // Apply global rotation if requested
        var rotDeg = computeRotationDeg(null, alignToPath, followCurveDir, flipDirection, rotationOffset);
        if (rotDeg !== 0) {
            newPath.rotate(rotDeg, newPath.bounds.center);
        }

        return newPath;
    }

    /**
     * Transform a handle vector from global coordinates into the local
     * (tangent, normal) frame of the mapped path.
     *
     * The handle's X component maps along the source-width direction,
     * and the Y component maps perpendicular.  In the new frame these
     * become tangent and normal components respectively.
     */
    function transformHandle(handle, tangent, normal) {
        if (!tangent || !normal) return new paper.Point(0, 0);

        // In original coordinates: handle = compT * (1,0) + compN * (0,1)
        // compT = handle.x (along path direction in source)
        // compN = handle.y (perpendicular in source)
        var compT = handle.x;
        var compN = handle.y;

        // Rebuild in the new local frame
        var hx = tangent.x * compT + normal.x * compN;
        var hy = tangent.y * compT + normal.y * compN;

        return new paper.Point(hx, hy);
    }

    /* ═══════════════════════════════════════════════════════════════════════
       Distribution modes
    ═══════════════════════════════════════════════════════════════════════ */

    /**
     * Single mode - place one clone at positionOnPath.
     */
    function applySingle(basePP, targetPP, params, styleHint) {
        var clone = basePP.clone();
        placeAt(
            targetPP, clone,
            params.positionOnPath != null ? params.positionOnPath : 0,
            params.offset || 0,
            params.alignToPath !== false,
            params.rotationOffset || 0,
            !!params.flipDirection,
            params.followCurveDirection !== false
        );
        return [{ pp: clone, style: styleHint }];
    }

    /**
     * Repeat mode - place N clones evenly (or at fixed spacing) along the path.
     */
    function applyRepeat(basePP, targetPP, params, styleHint) {
        var count      = Math.max(1, Math.min(200, (params.count | 0) || 10));
        var spacing    = params.spacing;
        var pathLen    = targetPP.length;
        var hasSpacing = spacing != null && spacing !== '' && !isNaN(+spacing) && +spacing > 0;

        var results = [];

        for (var i = 0; i < count; i++) {
            var t;
            if (hasSpacing) {
                t = ((+spacing) * i) / pathLen;
            } else {
                // Even distribution: first at 0, last at 1
                t = count > 1 ? i / (count - 1) : 0;
            }
            if (t > 1) break;

            var clone = basePP.clone();
            placeAt(
                targetPP, clone, t,
                params.offset || 0,
                params.alignToPath !== false,
                params.rotationOffset || 0,
                !!params.flipDirection,
                params.followCurveDirection !== false
            );
            results.push({ pp: clone, style: styleHint });
        }

        // Always return at least one clone
        if (results.length === 0) {
            var fallback = basePP.clone();
            placeAt(targetPP, fallback, 0, params.offset || 0,
                params.alignToPath !== false, params.rotationOffset || 0,
                !!params.flipDirection, params.followCurveDirection !== false);
            results.push({ pp: fallback, style: styleHint });
        }

        return results;
    }

    /**
     * Stretch to Fit mode - deform the object's segments along the path.
     */
    function applyStretch(basePP, targetPP, params, styleHint) {
        try {
            var stretched = stretchAlongPath(basePP, targetPP, params);
            if (stretched && stretched.segments && stretched.segments.length >= 2) {
                return [{ pp: stretched, style: styleHint }];
            }
        } catch (err) {
            console.warn('[FollowPath] stretch deformation failed:', err);
        }

        // Fallback: place at center with alignment
        var clone = basePP.clone();
        placeAt(targetPP, clone, 0.5, params.offset || 0,
            params.alignToPath !== false, params.rotationOffset || 0,
            !!params.flipDirection, params.followCurveDirection !== false);
        return [{ pp: clone, style: styleHint }];
    }

    /* ═══════════════════════════════════════════════════════════════════════
       apply() — modifier pipeline entry point
    ═══════════════════════════════════════════════════════════════════════ */

    function apply(basePP, params, styleHint) {
        // Guard: need valid state and target
        var state    = window.VectorEditor && window.VectorEditor.state;
        var targetId = params.targetObjectId;
        if (!targetId || !state) {
            return [{ pp: basePP.clone(), style: styleHint }];
        }

        // Look up target path from live Paper.js paths
        var targetPP = state.paperPaths[targetId];
        if (!targetPP) {
            return [{ pp: basePP.clone(), style: styleHint }];
        }

        // Guard: target must have measurable length
        if (!targetPP.length || targetPP.length < 1) {
            return [{ pp: basePP.clone(), style: styleHint }];
        }

        // Guard: base must have segments
        if (!basePP.segments || basePP.segments.length < 1) {
            return [{ pp: basePP.clone(), style: styleHint }];
        }

        try {
            var distMode = params.distributionMode || 'single';

            switch (distMode) {
                case 'repeat':
                    return applyRepeat(basePP, targetPP, params, styleHint);
                case 'stretch':
                    return applyStretch(basePP, targetPP, params, styleHint);
                default:
                    return applySingle(basePP, targetPP, params, styleHint);
            }
        } catch (err) {
            console.warn('[FollowPath] failed:', err);
            return [{ pp: basePP.clone(), style: styleHint }];
        }
    }

    /* ═══════════════════════════════════════════════════════════════════════
       Exports
    ═══════════════════════════════════════════════════════════════════════ */

    window.VectorEditor = window.VectorEditor || {};
    window.VectorEditor.Modifiers = window.VectorEditor.Modifiers || {};
    window.VectorEditor.Modifiers['follow-path'] = { apply: apply };

})();
