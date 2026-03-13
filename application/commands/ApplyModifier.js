/**
 * ApplyModifier.js  —  /application/commands
 * Destructive: permanently applies a modifier's result to the object's pathData.
 * Input: { objectId, modifierId }
 */
(function () {
    const command = {
        id: 'applyModifier',
        description: 'Permanently apply modifier to object path',
        inputSchema: {
            type: 'object',
            required: ['objectId', 'modifierId'],
            properties: {
                objectId:   { type: 'string' },
                modifierId: { type: 'string' }
            }
        },
        execute (input) {
            const { objectId, modifierId } = input;
            const registry = VectorEditor.app.modifierRegistry;
            
            const mod = (registry.getStack(objectId) || []).find(m => m.id === modifierId);
            if (!mod) return { applied: false, error: 'Modifier not found' };

            const state = VectorEditor.state;
            const sourcePP = state.paperPaths[objectId];
            if (!sourcePP) return { applied: false, error: 'Source path not found' };

            const modFactory = {
                'array':   () => VectorEditor.Modifiers?.array,
                'boolean': () => VectorEditor.Modifiers?.boolean,
            }[mod.type];

            if (!modFactory) return { applied: false, error: 'Modifier type not found' };

            const modModule = modFactory();
            if (!modModule || typeof modModule.apply !== 'function') {
                return { applied: false, error: 'Modifier apply function not found' };
            }

            const obj = VectorEditor.app.document.getObject(objectId);
            const styleHint = {
                fill:        obj?.fill        || 'none',
                stroke:      obj?.stroke      || '#ffffff',
                strokeWidth: obj?.strokeWidth || 2
            };

            const basePP = sourcePP.clone();

            let produced;
            try {
                produced = modModule.apply(basePP, mod.params, styleHint);
            } catch (err) {
                console.warn('[ApplyModifier] modifier threw:', err);
                return { applied: false, error: err.message };
            }

            if (!produced || produced.length === 0) {
                basePP.remove();
                return { applied: false, error: 'No output produced' };
            }

            if (produced.length === 1) {
                /* ── Single result (e.g. boolean op) ────────────────────── */
                const newPP = produced[0].pp;          // keep the live Paper.js path
                const newPathData = newPP.pathData;
                basePP.remove();

                const b = newPP.bounds;
                obj.updatePathData(newPathData, { x: b.x, y: b.y, width: b.width, height: b.height });

                /* Flatten CompoundPath → simple Path so the rest of the
                   editor (render, hit-test, anchor gizmos) works uniformly */
                if (newPP.className === 'CompoundPath') {
                    const flat = new paper.Path(newPathData);
                    if (obj.closed) flat.closed = true;
                    newPP.remove();
                    state.paperPaths[objectId] = flat;
                } else {
                    state.paperPaths[objectId] = newPP;
                }
                sourcePP.remove();

                return { applied: true };
            } else {
                /* ── Multiple results (e.g. array modifier) ─────────────── */
                /* Each produced path becomes its own VectorObject so that
                   hit-testing, rendering and selection all work naturally
                   (no CompoundPath or multi-subpath issues). */

                // Update the original object with the first produced copy
                const firstPP = produced[0].pp;
                const firstPathData = firstPP.pathData;
                const fb = firstPP.bounds;
                obj.updatePathData(firstPathData, { x: fb.x, y: fb.y, width: fb.width, height: fb.height });
                state.paperPaths[objectId] = firstPP;

                // Create new independent objects for the remaining copies
                const newObjectIds = [];
                for (let i = 1; i < produced.length; i++) {
                    const pp = produced[i].pp;
                    const pd = pp.pathData;
                    const pb = pp.bounds;

                    const result = VectorEditor.app.execute('createShape', {
                        type: obj.type,
                        pathData: pd,
                        bounds: { x: pb.x, y: pb.y, width: pb.width, height: pb.height },
                        closed: obj.closed,
                        style: { fill: obj.fill, stroke: obj.stroke, strokeWidth: obj.strokeWidth }
                    });

                    state.paperPaths[result.objectId] = pp;
                    newObjectIds.push(result.objectId);
                }

                basePP.remove();
                sourcePP.remove();

                return { applied: true, newObjectIds, note: 'Array expanded into individual objects' };
            }
        }
    };
    window.VectorEditor.App.Commands.ApplyModifier = command;
})();
