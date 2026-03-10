/**
 * MoveModifierBefore.js  —  /application/commands
 * Drag-and-drop reorder: place modifierId before destModifierId.
 * Input: { objectId, modifierId, destModifierId }
 */
(function () {
    const command = {
        id: 'moveModifierBefore',
        description: 'Drag-reorder: move modifier before another in the stack',
        inputSchema: {
            type: 'object',
            required: ['objectId', 'modifierId', 'destModifierId'],
            properties: {
                objectId:       { type: 'string' },
                modifierId:     { type: 'string' },
                destModifierId: { type: 'string' }
            }
        },
        execute (input) {
            const { objectId, modifierId, destModifierId } = input;
            const moved = VectorEditor.app.modifierRegistry.moveBefore(objectId, modifierId, destModifierId);
            if (moved) {
                VectorEditor.app.eventEmitter.emit('modifier.reordered', { objectId, modifierId, destModifierId });
            }
            return { moved };
        }
    };
    window.VectorEditor.App.Commands.MoveModifierBefore = command;
})();