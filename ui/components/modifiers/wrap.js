/**
 * wrap.js  —  /ui layer / modifiers
 *
 * Wrap (Envelope Distortion) Modifier — deforms an object based on
 * the shape of another object.
 *
 * Modes:
 *   - envelope       : bilinear mapping from source bbox to target perimeter
 *   - mesh-grid      : NxM grid-based deformation
 *   - curve-based    : source follows target curve with projection
 *
 * Settings:
 *   - targetObjectId   : string  (the envelope/warp target object)
 *   - wrapMode         : 'envelope' | 'mesh-grid' | 'curve-based'
 *   - influence        : number 0-100
 *   - falloff          : 'linear' | 'smooth' | 'sharp'
 *   - gridResX         : number (mesh mode)
 *   - gridResY         : number (mesh mode)
 *   - affectX          : boolean
 *   - affectY          : boolean
 */
(function () {

    /* ── Sample N points along a Paper.js path by arc-length ─────────── */

    function samplePath(pp, count) {
        if (!pp || !pp.length || pp.length < 1) return [];
        var totalLen = pp.length;
        var pts = [];
        for (var i = 0; i < count; i++) {
            var t = i / count;
            var loc = pp.getLocationAt(t * totalLen);
            if (loc) {
                pts.push({ x: loc.point.x, y: loc.point.y });
            }
        }
        return pts;
    }

    /* ── Get 4 corner points from a bounding box ──────────────────────── */

    function bboxCorners(b) {
        return [
            { x: b.x,           y: b.y },
            { x: b.x + b.width, y: b.y },
            { x: b.x + b.width, y: b.y + b.height },
            { x: b.x,           y: b.y + b.height }
        ];
    }

    /* ── Get 4 perimeter points on a path at cardinal positions ───────── */

    function perimeterQuadPoints(pp) {
        if (!pp || !pp.length || pp.length < 1) return null;
        var len = pp.length;
        var pts = [];
        var offsets = [0, 0.25, 0.5, 0.75];
        for (var i = 0; i < 4; i++) {
            var loc = pp.getLocationAt(offsets[i] * len);
            if (!loc) return null;
            pts.push({ x: loc.point.x, y: loc.point.y });
        }
        return pts;
    }

    /* ── Bilinear interpolation between 4 corners ─────────────────────── */

    function bilinearInterp(corners, u, v) {
        // corners: [top-left, top-right, bottom-right, bottom-left]
        var x = (1 - u) * (1 - v) * corners[0].x
              + u       * (1 - v) * corners[1].x
              + u       * v       * corners[2].x
              + (1 - u) * v       * corners[3].x;
        var y = (1 - u) * (1 - v) * corners[0].y
              + u       * (1 - v) * corners[1].y
              + u       * v       * corners[2].y
              + (1 - u) * v       * corners[3].y;
        return { x: x, y: y };
    }

    /* ── Falloff weight ────────────────────────────────────────────────── */

    function falloffWeight(normDist, falloff) {
        // normDist: 0 = perimeter, 1 = center
        var t = 1 - normDist; // 0 at center, 1 at perimeter
        switch (falloff) {
            case 'smooth':
                return t * t * (3 - 2 * t); // smoothstep
            case 'sharp':
                return Math.pow(t, 3);
            default: // linear
                return t;
        }
    }

    /* ── Deform points using envelope mode ────────────────────────────── */

    function deformEnvelope(sourcePts, srcSegs, targetPP, influence, falloff, affectX, affectY, srcBBox) {
        var srcCorners = bboxCorners(srcBBox);
        var tgtPerim = perimeterQuadPoints(targetPP);
        if (!tgtPerim) {
            tgtPerim = srcCorners; // fallback: no deformation
        }

        var out = [];
        for (var i = 0; i < srcSegs.length; i++) {
            var seg = srcSegs[i];
            var dx = srcBBox.width  > 0 ? (seg.x - srcBBox.x) / srcBBox.width  : 0.5;
            var dy = srcBBox.height > 0 ? (seg.y - srcBBox.y) / srcBBox.height : 0.5;

            var mapped = bilinearInterp(tgtPerim, dx, dy);

            // Distance from perimeter (0 = edge, 1 = center)
            var distFromEdge = Math.min(dx, 1 - dx, dy, 1 - dy) * 2;
            var weight = falloffWeight(distFromEdge, falloff) * (influence / 100);

            var nx = seg.x;
            var ny = seg.y;
            if (affectX) nx = seg.x + (mapped.x - seg.x) * weight;
            if (affectY) ny = seg.y + (mapped.y - seg.y) * weight;
            out.push({ x: nx, y: ny });
        }
        return out;
    }

    /* ── Deform points using mesh-grid mode ───────────────────────────── */

    function deformMeshGrid(sourcePts, srcSegs, targetPP, influence, falloff, affectX, affectY, srcBBox, resX, resY) {
        resX = Math.max(2, Math.min(20, resX || 4));
        resY = Math.max(2, Math.min(20, resY || 4));

        // Build source grid (over source bbox)
        var srcGrid = [];
        for (var gy = 0; gy <= resY; gy++) {
            for (var gx = 0; gx <= resX; gx++) {
                srcGrid.push({
                    x: srcBBox.x + (gx / resX) * srcBBox.width,
                    y: srcBBox.y + (gy / resY) * srcBBox.height,
                    gx: gx, gy: gy
                });
            }
        }

        // Build target grid (mapped to target perimeter/area)
        var tgtPerim = perimeterQuadPoints(targetPP);
        if (!tgtPerim) return sourceSegs.map(function(s) { return { x: s.x, y: s.y }; });

        var tgtCenter = { x: 0, y: 0 };
        for (var ti = 0; ti < 4; ti++) {
            tgtCenter.x += tgtPerim[ti].x / 4;
            tgtCenter.y += tgtPerim[ti].y / 4;
        }

        var tgtGrid = [];
        for (var gy2 = 0; gy2 <= resY; gy2++) {
            for (var gx2 = 0; gx2 <= resX; gx2++) {
                var u = gx2 / resX;
                var v = gy2 / resY;
                var perimPt = bilinearInterp(tgtPerim, u, v);
                var blend = (u > 0 && u < 1 && v > 0 && v < 1) ? 0.5 : 1.0;
                tgtGrid.push({
                    x: perimPt.x * blend + tgtCenter.x * (1 - blend),
                    y: perimPt.y * blend + tgtCenter.y * (1 - blend)
                });
            }
        }

        // Deform each segment
        var out = [];
        for (var si = 0; si < srcSegs.length; si++) {
            var seg = srcSegs[si];
            var dx = srcBBox.width  > 0 ? (seg.x - srcBBox.x) / srcBBox.width  : 0;
            var dy = srcBBox.height > 0 ? (seg.y - srcBBox.y) / srcBBox.height : 0;
            dx = Math.max(0, Math.min(1, dx));
            dy = Math.max(0, Math.min(1, dy));

            var gx = dx * resX;
            var gy = dy * resY;
            var ci = Math.floor(gx);
            var cj = Math.floor(gy);
            ci = Math.min(ci, resX - 1);
            cj = Math.min(cj, resY - 1);

            var fu = gx - ci;
            var fv = gy - cj;

            // Grid cell corners in target grid
            var c00 = tgtGrid[cj * (resX + 1) + ci];
            var c10 = tgtGrid[cj * (resX + 1) + ci + 1];
            var c11 = tgtGrid[(cj + 1) * (resX + 1) + ci + 1];
            var c01 = tgtGrid[(cj + 1) * (resX + 1) + ci];

            var mapped = bilinearInterp([c00, c10, c11, c01], fu, fv);

            var distFromEdge = Math.min(dx, 1 - dx, dy, 1 - dy) * 2;
            var weight = falloffWeight(distFromEdge, falloff) * (influence / 100);

            var nx = seg.x;
            var ny = seg.y;
            if (affectX) nx = seg.x + (mapped.x - seg.x) * weight;
            if (affectY) ny = seg.y + (mapped.y - seg.y) * weight;
            out.push({ x: nx, y: ny });
        }
        return out;
    }

    /* ── Deform points using curve-based mode ─────────────────────────── */

    function deformCurveBased(sourcePts, srcSegs, targetPP, influence, falloff, affectX, affectY, srcBBox) {
        if (!targetPP || !targetPP.length || targetPP.length < 1) {
            return srcSegs.map(function(s) { return { x: s.x, y: s.y }; });
        }

        var srcCenter = {
            x: srcBBox.x + srcBBox.width / 2,
            y: srcBBox.y + srcBBox.height / 2
        };
        var tgtCenter = {
            x: targetPP.position.x,
            y: targetPP.position.y
        };

        var out = [];
        for (var i = 0; i < srcSegs.length; i++) {
            var seg = srcSegs[i];

            // Compute angle and normalized radius from source center
            var ddx = seg.x - srcCenter.x;
            var ddy = seg.y - srcCenter.y;
            var angle = Math.atan2(ddy, ddx);
            var maxR = Math.max(srcBBox.width, srcBBox.height) / 2;
            var normR = maxR > 0 ? Math.min(1, Math.hypot(ddx, ddy) / maxR) : 0;

            // Find point on target curve at same angle
            var tgtLoc = targetPP.getLocationAt((angle / (2 * Math.PI) + 0.5) * targetPP.length);
            if (!tgtLoc) {
                out.push({ x: seg.x, y: seg.y });
                continue;
            }

            var tgtPt = tgtLoc.point;
            var normal = tgtLoc.normal || { x: 0, y: 0 };

            // Map: target curve point + normal offset based on source distance
            var mappedX = tgtPt.x + normal.x * normR * maxR;
            var mappedY = tgtPt.y + normal.y * normR * maxR;

            var distFromCenter = normR;
            var weight = falloffWeight(distFromCenter, falloff) * (influence / 100);

            var nx = seg.x;
            var ny = seg.y;
            if (affectX) nx = seg.x + (mappedX - seg.x) * weight;
            if (affectY) ny = seg.y + (mappedY - seg.y) * weight;
            out.push({ x: nx, y: ny });
        }
        return out;
    }

    /* ── Apply handles offset ──────────────────────────────────────────── */

    function computeHandleOffsets(originalSegs, deformedPts) {
        // Compute how much each point moved, apply same offset to handles
        var offsets = [];
        for (var i = 0; i < originalSegs.length; i++) {
            offsets.push({
                dx: deformedPts[i].x - originalSegs[i].x,
                dy: deformedPts[i].y - originalSegs[i].y
            });
        }
        return offsets;
    }

    /* ── apply() — modifier pipeline entry ─────────────────────────────── */

    function apply(basePP, params, styleHint) {
        var state = VectorEditor.state;
        var targetId = params.targetObjectId;
        if (!targetId) return [{ pp: basePP, style: styleHint }];

        var targetPP = state.paperPaths[targetId];
        if (!targetPP || !targetPP.length || targetPP.length < 1) {
            return [{ pp: basePP, style: styleHint }];
        }

        try {
            var srcBBox = {
                x: basePP.bounds.x,
                y: basePP.bounds.y,
                width:  basePP.bounds.width  || 1,
                height: basePP.bounds.height || 1
            };

            var srcSegs = basePP.segments.map(function(seg) {
                return {
                    x: seg.point.x, y: seg.point.y,
                    handleInX: seg.handleIn.x, handleInY: seg.handleIn.y,
                    handleOutX: seg.handleOut.x, handleOutY: seg.handleOut.y
                };
            });

            var sourcePts = samplePath(basePP, 32);
            var mode      = params.wrapMode || 'envelope';
            var influence = params.influence != null ? params.influence : 50;
            var falloff   = params.falloff || 'linear';
            var affectX   = params.affectX !== false;
            var affectY   = params.affectY !== false;

            var deformed;
            switch (mode) {
                case 'mesh-grid':
                    deformed = deformMeshGrid(
                        sourcePts, srcSegs, targetPP,
                        influence, falloff, affectX, affectY, srcBBox,
                        params.gridResX || 4, params.gridResY || 4
                    );
                    break;
                case 'curve-based':
                    deformed = deformCurveBased(
                        sourcePts, srcSegs, targetPP,
                        influence, falloff, affectX, affectY, srcBBox
                    );
                    break;
                default: // envelope
                    deformed = deformEnvelope(
                        sourcePts, srcSegs, targetPP,
                        influence, falloff, affectX, affectY, srcBBox
                    );
                    break;
            }

            // Apply deformation to a clone
            var result = basePP.clone();
            for (var i = 0; i < result.segments.length && i < deformed.length; i++) {
                result.segments[i].point = new paper.Point(deformed[i].x, deformed[i].y);
            }

            return [{ pp: result, style: styleHint }];
        } catch (err) {
            console.warn('[Wrap] deformation failed:', err);
            return [{ pp: basePP, style: styleHint }];
        }
    }

    /* ── Exports ────────────────────────────────────────────────────────── */

    window.VectorEditor = window.VectorEditor || {};
    window.VectorEditor.Modifiers = window.VectorEditor.Modifiers || {};
    window.VectorEditor.Modifiers['wrap'] = { apply: apply };

})();
