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
                const newPathData = produced[0].pp.pathData;
                produced[0].pp.remove();
                basePP.remove();
                
                const b = sourcePP.bounds;
                obj.updatePathData(newPathData, { x: b.x, y: b.y, width: b.width, height: b.height });
                
                const paper = window.paper;
                const newPP = new paper.Path(newPathData);
                if (obj.closed) newPP.closed = true;
                state.paperPaths[objectId] = newPP;
                sourcePP.remove();

                return { applied: true };
            } else {
                let resultPathData = produced.map(p => p.pp.pathData).join(' ');
                produced.forEach(p => p.pp.remove());
                basePP.remove();

                const b = sourcePP.bounds;
                obj.updatePathData(resultPathData, { x: b.x, y: b.y, width: b.width, height: b.height });
                
                const paper = window.paper;
                const newPP = new paper.Path(resultPathData);
                if (obj.closed) newPP.closed = true;
                state.paperPaths[objectId] = newPP;
                sourcePP.remove();

                return { applied: true, note: 'Multiple paths created - combined as group' };
            }
        }
    };
    window.VectorEditor.App.Commands.ApplyModifier = command;
})();
