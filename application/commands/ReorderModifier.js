/**
 * ReorderModifier.js  —  /application/commands
 * Input: { objectId, modifierId, direction: 'up'|'down' }
 *   'up'   → toward index 0 (newer / top of stack in UI)
 *   'down' → toward last index (older / bottom)
 */
(function () {
    const command = {
        id: 'reorderModifier',
        description: 'Move a modifier up or down in the stack',
        inputSchema: {
            type: 'object',
            required: ['objectId', 'modifierId', 'direction'],
            properties: {
                objectId:   { type: 'string' },
                modifierId: { type: 'string' },
                direction:  { type: 'string', enum: ['up', 'down'] }
            }
        },
        execute (input) {
            const { objectId, modifierId, direction } = input;
            const moved = VectorEditor.app.modifierRegistry.reorder(objectId, modifierId, direction);
            if (moved) {
                VectorEditor.app.eventEmitter.emit('modifier.reordered', { objectId, modifierId, direction });
            }
            return { moved };
        }
    };
    window.VectorEditor.App.Commands.ReorderModifier = command;
})();