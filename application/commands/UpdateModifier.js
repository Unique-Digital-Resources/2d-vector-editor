/**
 * UpdateModifier.js  —  /application/commands
 * Input: { objectId, modifierId, params: { …partial… } }
 */
(function () {
    const command = {
        id: 'updateModifier',
        description: 'Patch modifier parameters',
        inputSchema: {
            type: 'object',
            required: ['objectId', 'modifierId', 'params'],
            properties: {
                objectId:   { type: 'string' },
                modifierId: { type: 'string' },
                params:     { type: 'object'  }
            }
        },
        execute (input) {
            const { objectId, modifierId, params } = input;
            const ok = VectorEditor.app.modifierRegistry.updateParams(objectId, modifierId, params);
            if (ok) {
                VectorEditor.app.eventEmitter.emit('modifier.updated', { objectId, modifierId, params });
            }
            return { updated: ok };
        }
    };
    window.VectorEditor.App.Commands.UpdateModifier = command;
})();
