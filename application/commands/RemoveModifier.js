/**
 * RemoveModifier.js  —  /application/commands
 * Input: { objectId, modifierId }
 */
(function () {
    const command = {
        id: 'removeModifier',
        description: 'Remove a modifier from an object stack',
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
            const removed = VectorEditor.app.modifierRegistry.remove(objectId, modifierId);
            if (removed) {
                VectorEditor.app.eventEmitter.emit('modifier.removed', { objectId, modifierId });
            }
            return { removed };
        }
    };
    window.VectorEditor.App.Commands.RemoveModifier = command;
})();