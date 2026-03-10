/**
 * DuplicateObject.js - Command to duplicate objects
 * Input: { objectIds: string[], offset: {x, y} }
 */

(function() {
    const command = {
        id: 'duplicateObject',
        description: 'Duplicate one or more objects with offset',

        execute(input) {
            const { document, idGenerator } = VectorEditor.app;
            const { objectIds, offset } = input;
            const ox = offset?.x || 20;
            const oy = offset?.y || 20;
            const newIds = [];

            objectIds.forEach(srcId => {
                const srcObj = document.getObject(srcId);
                if (!srcObj) return;

                const data = srcObj.serialize();
                const newId = idGenerator.generate(data.type);
                data.id = newId;
                data.name = data.name + ' copy';

                // Offset bounds
                data.bounds.x += ox;
                data.bounds.y += oy;

                const newObj = new VectorEditor.Core.VectorObject(data);
                document.addObject(newObj);
                newIds.push(newId);
            });

            return { newObjectIds: newIds };
        }
    };

    window.VectorEditor = window.VectorEditor || {};
    window.VectorEditor.App = window.VectorEditor.App || {};
    window.VectorEditor.App.Commands = window.VectorEditor.App.Commands || {};
    window.VectorEditor.App.Commands.DuplicateObject = command;
})();
