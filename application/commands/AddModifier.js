/**
 * AddModifier.js  —  /application/commands
 *
 * Adds a modifier to an object's stack (newest → front).
 * 'boolean' is a single type; subType (union/intersect/difference/xor)
 * is stored as a param, not as separate command types.
 *
 * Input schema:
 *   { objectId: string, type: string, params?: object }
 */
(function () {

    const ALLOWED_TYPES = new Set(['array', 'boolean']);

    const command = {
        id: 'addModifier',
        description: 'Add a non-destructive modifier to an object',

        inputSchema: {
            type: 'object',
            required: ['objectId', 'type'],
            properties: {
                objectId: { type: 'string' },
                type:     { type: 'string', enum: [...ALLOWED_TYPES] },
                params:   { type: 'object' }
            }
        },

        execute (input) {
            const { objectId, type, params = {} } = input;

            if (!objectId) throw new Error('addModifier: objectId required');
            if (!ALLOWED_TYPES.has(type)) throw new Error(`addModifier: unknown type "${type}"`);

            const doc = VectorEditor.app.document;
            if (!doc.hasObject(objectId)) {
                throw new Error(`addModifier: object "${objectId}" not found`);
            }

            const modifier = VectorEditor.app.modifierRegistry.add(objectId, type, params);

            VectorEditor.app.eventEmitter.emit('modifier.added', {
                objectId, modifierId: modifier.id, type, params: modifier.params
            });

            return { modifierId: modifier.id, modifier };
        }
    };

    window.VectorEditor = window.VectorEditor || {};
    window.VectorEditor.App = window.VectorEditor.App || {};
    window.VectorEditor.App.Commands = window.VectorEditor.App.Commands || {};
    window.VectorEditor.App.Commands.AddModifier = command;

})();