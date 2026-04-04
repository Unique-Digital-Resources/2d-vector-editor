/**
 * gooey.js  —  /ui/components/modifiers
 *
 * Gooey (Metaball / Merge) Modifier — creates smooth merging blobs
 * between shapes, similar to Figma's blob effects or CSS gooey filters.
 *
 * Algorithm:
 *   1. Build a scalar field over a grid covering all contributing shapes
 *   2. Each shape contributes a metaball field: R^2 / (dist^2 + epsilon)
 *   3. Marching Squares extracts the iso-contour at the threshold
 *   4. Contour is converted to a Paper.js Path and smoothed
 *
 * params:
 *   influenceRadius    : number (default 50) — how far the field extends
 *   smoothness         : range 0-100 (default 70) — path smoothing amount
 *   threshold          : range 0.01-5 (default 1.0) — iso-surface level
 *   affectNearby       : boolean (default false) — merge with other shapes
 *   targetObjectIds    : string[] — ids of objects to merge with
 *   fillBlend          : 'merge' | 'additive' | 'soft-merge' (default 'merge')
 *   outlinePreservation: boolean (default false) — keep outline detail
 *   resolution         : range 4-64 (default 24) — grid resolution
 *   animationSpeed     : number (default 0) — reserved for animation
 */
(function () {

    /* ═══════════════════════════════════════════════════════════════════════
       Marching Squares
    ═══════════════════════════════════════════════════════════════════════ */

    /**
     * Edge lookup table for Marching Squares.
     * Each entry maps a 4-bit case index (bl|br|tr|tl) to a list of
     * edge pairs that form line segments.
     * Edges: 0=top  1=right  2=bottom  3=left
     */
    var EDGE_TABLE = [
        [],                       // 0: all outside
        [[3,0]],                  // 1: tl inside
        [[0,1]],                  // 2: tr inside
        [[3,1]],                  // 3: tl+tr inside
        [[1,2]],                  // 4: br inside
        [[3,2],[0,1]],            // 5: tl+br inside  (saddle)
        [[0,2]],                  // 6: tr+br inside
        [[3,2]],                  // 7: tl+tr+br inside
        [[2,3]],                  // 8: bl inside
        [[2,0]],                  // 9: bl+tl inside
        [[2,3],[0,1]],            //10: bl+tr inside  (saddle)
        [[2,1]],                  //11: bl+tl+tr inside
        [[1,3]],                  //12: bl+br inside
        [[1,0]],                  //13: bl+br+tl inside
        [[0,3]],                  //14: bl+br+tr inside
        []                        //15: all inside
    ];

    /**
     * Interpolate the crossing point along a cell edge.
     * @param {number} edge  — 0=top 1=right 2=bottom 3=left
     * @param {number} x0,y0 — cell top-left corner in world coords
     * @param {number} cellW,cellH — cell dimensions
     * @param {number} tl,tr,br,bl — scalar field values at corners
     * @param {number} threshold — iso-surface value
     * @returns {{x, y}}
     */
    function interpEdge(edge, x0, y0, cellW, cellH, tl, tr, br, bl, threshold) {
        var t;
        switch (edge) {
            case 0: // top edge: tl → tr
                t = (threshold - tl) / (tr - tl || 1e-10);
                return { x: x0 + t * cellW, y: y0 };
            case 1: // right edge: tr → br
                t = (threshold - tr) / (br - tr || 1e-10);
                return { x: x0 + cellW, y: y0 + t * cellH };
            case 2: // bottom edge: bl → br
                t = (threshold - bl) / (br - bl || 1e-10);
                return { x: x0 + t * cellW, y: y0 + cellH };
            case 3: // left edge: tl → bl
                t = (threshold - tl) / (bl - tl || 1e-10);
                return { x: x0, y: y0 + t * cellH };
            default:
                return { x: x0, y: y0 };
        }
    }

    /**
     * Run Marching Squares on a scalar grid and return an array of
     * polylines (each an array of {x, y} points).
     *
     * @param {Float64Array} field — grid values (row-major, width*height)
     * @param {number} gridW — number of columns
     * @param {number} gridH — number of rows
     * @param {number} ox,oy — world-space origin of the grid
     * @param {number} cellW,cellH — size of each cell
     * @param {number} threshold — iso-surface threshold
     * @returns {Array<Array<{x,y}>>}
     */
    function marchingSquares(field, gridW, gridH, ox, oy, cellW, cellH, threshold) {
        var polylines = [];
        var visited   = {};

        for (var gy = 0; gy < gridH - 1; gy++) {
            for (var gx = 0; gx < gridW - 1; gx++) {
                var tl = field[gy       * gridW + gx];
                var tr = field[gy       * gridW + gx + 1];
                var br = field[(gy + 1) * gridW + gx + 1];
                var bl = field[(gy + 1) * gridW + gx];

                // 4-bit case index (tl=1 tr=2 br=4 bl=8)
                var idx = 0;
                if (tl >= threshold) idx |= 1;
                if (tr >= threshold) idx |= 2;
                if (br >= threshold) idx |= 4;
                if (bl >= threshold) idx |= 8;

                if (idx === 0 || idx === 15) continue;

                var x0 = ox + gx * cellW;
                var y0 = oy + gy * cellH;

                var edges = EDGE_TABLE[idx];
                for (var ei = 0; ei < edges.length; ei++) {
                    var eA = edges[ei][0];
                    var eB = edges[ei][1];
                    var pA = interpEdge(eA, x0, y0, cellW, cellH, tl, tr, br, bl, threshold);
                    var pB = interpEdge(eB, x0, y0, cellW, cellH, tl, tr, br, bl, threshold);

                    var keyA = Math.round(pA.x * 10) + ',' + Math.round(pA.y * 10);
                    var keyB = Math.round(pB.x * 10) + ',' + Math.round(pB.y * 10);

                    if (!visited[keyA]) visited[keyA] = [];
                    if (!visited[keyB]) visited[keyB] = [];
                    visited[keyA].push({ pt: pB, key: keyB });
                    visited[keyB].push({ pt: pA, key: keyA });
                }
            }
        }

        // Chain segments into polylines by following linked edges
        var used = {};
        for (var key in visited) {
            if (used[key]) continue;
            var chain = [];
            var cur   = key;
            while (cur && !used[cur]) {
                used[cur] = true;
                var parts = cur.split(',');
                chain.push({ x: +parts[0], y: +parts[1] });
                var nexts = visited[cur];
                cur = null;
                if (nexts) {
                    for (var ni = 0; ni < nexts.length; ni++) {
                        if (!used[nexts[ni].key]) {
                            cur = nexts[ni].key;
                            break;
                        }
                    }
                }
            }
            if (chain.length >= 3) {
                polylines.push(chain);
            }
        }

        return polylines;
    }

    /* ═══════════════════════════════════════════════════════════════════════
       Scalar field — metaball computation
    ═══════════════════════════════════════════════════════════════════════ */

    /**
     * Evaluate the metaball scalar field at a point from a single shape.
     * Uses distance to nearest point on the shape's boundary.
     * Field value = R^2 / (dist^2 + eps)
     */
    function evaluateMetaballAt(pp, px, py, radius) {
        var pt    = new paper.Point(px, py);
        var dist;

        if (pp.contains(pt)) {
            // Point is inside the shape — use distance to boundary (negative)
            var loc = pp.getNearestPoint(pt);
            dist = -pt.getDistance(loc);
        } else {
            // Point is outside — use distance to boundary
            var near = pp.getNearestPoint(pt);
            dist = pt.getDistance(near);
        }

        var eps = radius * 0.05;
        return (radius * radius) / (dist * dist + eps);
    }

    /**
     * Evaluate the combined metaball field from multiple shapes.
     * Returns the sum of all individual metaball contributions.
     */
    function evaluateField(shapes, px, py, radius) {
        var sum = 0;
        for (var i = 0; i < shapes.length; i++) {
            sum += evaluateMetaballAt(shapes[i], px, py, radius);
        }
        return sum;
    }

    /**
     * Compute the union bounding box of multiple Paper.js paths,
     * expanded by the influence radius.
     */
    function unionBounds(paths, padding) {
        var xMin = Infinity, yMin = Infinity;
        var xMax = -Infinity, yMax = -Infinity;
        for (var i = 0; i < paths.length; i++) {
            var b = paths[i].bounds;
            xMin = Math.min(xMin, b.x);
            yMin = Math.min(yMin, b.y);
            xMax = Math.max(xMax, b.x + b.width);
            yMax = Math.max(yMax, b.y + b.height);
        }
        return {
            x:      xMin - padding,
            y:      yMin - padding,
            width:  (xMax - xMin) + padding * 2,
            height: (yMax - yMin) + padding * 2
        };
    }

    /**
     * Sample the scalar field over a regular grid.
     * Returns { field: Float64Array, gridW, gridH, bounds, cellW, cellH }
     */
    function sampleField(shapes, resolution, radius) {
        var bounds = unionBounds(shapes, radius * 1.5);
        var gridW  = Math.max(4, resolution | 0);
        var gridH  = Math.max(4, Math.round(gridW * (bounds.height / (bounds.width || 1))));
        gridH = Math.max(4, Math.min(128, gridH));

        var cellW = bounds.width  / (gridW - 1);
        var cellH = bounds.height / (gridH - 1);

        var field = new Float64Array(gridW * gridH);
        for (var gy = 0; gy < gridH; gy++) {
            for (var gx = 0; gx < gridW; gx++) {
                var px = bounds.x + gx * cellW;
                var py = bounds.y + gy * cellH;
                field[gy * gridW + gx] = evaluateField(shapes, px, py, radius);
            }
        }

        return {
            field:  field,
            gridW:  gridW,
            gridH:  gridH,
            bounds: bounds,
            cellW:  cellW,
            cellH:  cellH
        };
    }

    /* ═══════════════════════════════════════════════════════════════════════
       Contour → Paper.js path conversion
    ═══════════════════════════════════════════════════════════════════════ */

    /**
     * Convert a polyline (array of {x,y}) to a closed Paper.js Path,
     * with optional smoothing.
     */
    function polylineToPath(polyline, smoothness) {
        if (!polyline || polyline.length < 3) return null;

        var path = new paper.Path();
        path.closed = true;

        for (var i = 0; i < polyline.length; i++) {
            path.add(new paper.Point(polyline[i].x, polyline[i].y));
        }

        // Simplify to reduce vertex noise
        var tolerance = 1 + (1 - smoothness / 100) * 5;
        path.simplify(tolerance);

        return path;
    }

    /**
     * Find the largest closed contour from a set of polylines
     * (by bounding box area).
     */
    function largestContour(polylines) {
        if (!polylines || polylines.length === 0) return null;
        if (polylines.length === 1) return polylines[0];

        var best     = null;
        var bestArea = -Infinity;
        for (var i = 0; i < polylines.length; i++) {
            var pl = polylines[i];
            // Compute bounding box area
            var xMin = Infinity, yMin = Infinity;
            var xMax = -Infinity, yMax = -Infinity;
            for (var j = 0; j < pl.length; j++) {
                xMin = Math.min(xMin, pl[j].x);
                yMin = Math.min(yMin, pl[j].y);
                xMax = Math.max(xMax, pl[j].x);
                yMax = Math.max(yMax, pl[j].y);
            }
            var area = (xMax - xMin) * (yMax - yMin);
            if (area > bestArea) {
                bestArea = area;
                best = pl;
            }
        }
        return best;
    }

    /* ═══════════════════════════════════════════════════════════════════════
       Single-shape gooey (rounds corners / creates blob)
    ═══════════════════════════════════════════════════════════════════════ */

    /**
     * Apply gooey effect to a single shape — creates a smooth blob
     * approximation of the shape by sampling its own metaball field.
     */
    function gooeySingleShape(basePP, params) {
        var radius     = params.influenceRadius != null ? params.influenceRadius : 50;
        var smoothness = params.smoothness != null ? params.smoothness : 70;
        var threshold  = params.threshold != null ? params.threshold : 1.0;
        var resolution = params.resolution != null ? params.resolution : 24;

        var data = sampleField([basePP], resolution, radius);
        var polylines = marchingSquares(
            data.field, data.gridW, data.gridH,
            data.bounds.x, data.bounds.y,
            data.cellW, data.cellH,
            threshold
        );

        var contour = largestContour(polylines);
        return polylineToPath(contour, smoothness);
    }

    /**
     * Apply gooey merge effect with multiple target shapes.
     * All shapes contribute to the combined scalar field.
     */
    function gooeyMerge(shapes, params) {
        var radius     = params.influenceRadius != null ? params.influenceRadius : 50;
        var smoothness = params.smoothness != null ? params.smoothness : 70;
        var threshold  = params.threshold != null ? params.threshold : 1.0;
        var resolution = params.resolution != null ? params.resolution : 24;

        var data = sampleField(shapes, resolution, radius);
        var polylines = marchingSquares(
            data.field, data.gridW, data.gridH,
            data.bounds.x, data.bounds.y,
            data.cellW, data.cellH,
            threshold
        );

        var contour = largestContour(polylines);
        return polylineToPath(contour, smoothness);
    }

    /* ═══════════════════════════════════════════════════════════════════════
       apply() — modifier pipeline entry point
    ═══════════════════════════════════════════════════════════════════════ */

    function apply(basePP, params, styleHint) {
        var state = window.VectorEditor && window.VectorEditor.state;
        if (!state) {
            return [{ pp: basePP.clone(), style: styleHint }];
        }

        // Guard: base must have segments
        if (!basePP.segments || basePP.segments.length < 1) {
            return [{ pp: basePP.clone(), style: styleHint }];
        }

        try {
            var affectNearby    = !!params.affectNearby;
            var targetIds       = params.targetObjectIds;
            var hasTargets      = affectNearby && Array.isArray(targetIds) && targetIds.length > 0;

            if (hasTargets) {
                // Merge mode: combine field from base + targets
                var shapes = [basePP];
                for (var i = 0; i < targetIds.length; i++) {
                    var tpp = state.paperPaths[targetIds[i]];
                    if (tpp && tpp.segments && tpp.segments.length > 0) {
                        shapes.push(tpp);
                    }
                }

                var merged = gooeyMerge(shapes, params);
                if (merged) {
                    return [{ pp: merged, style: styleHint }];
                }
            } else {
                // Single shape: smooth blob approximation
                var blobbed = gooeySingleShape(basePP, params);
                if (blobbed) {
                    return [{ pp: blobbed, style: styleHint }];
                }
            }
        } catch (err) {
            console.warn('[Gooey] failed:', err);
        }

        // Fallback: return clone unchanged
        return [{ pp: basePP.clone(), style: styleHint }];
    }

    /* ═══════════════════════════════════════════════════════════════════════
       Exports
    ═══════════════════════════════════════════════════════════════════════ */

    window.VectorEditor = window.VectorEditor || {};
    window.VectorEditor.Modifiers = window.VectorEditor.Modifiers || {};
    window.VectorEditor.Modifiers.gooey = { apply: apply };

})();
