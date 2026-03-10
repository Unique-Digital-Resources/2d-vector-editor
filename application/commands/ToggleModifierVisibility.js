/**
 * ToggleModifierVisibility.js  —  /application/commands
 * Input: { objectId, modifierId }
 */
(function () {
    const command = {
        id: 'toggleModifierVisibility',
        description: 'Toggle modifier visibility (enabled/disabled)',
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
            const visible = VectorEditor.app.modifierRegistry.toggleVisibility(objectId, modifierId);
            if (visible !== null) {
                VectorEditor.app.eventEmitter.emit('modifier.visibilityToggled', { objectId, modifierId, visible });
            }
            return { visible };
        }
    };
    window.VectorEditor.App.Commands.ToggleModifierVisibility = command;
})();
