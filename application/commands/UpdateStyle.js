/**
 * UpdateStyle.js - Command to update object styles
 * Input: { objectIds: string[], style: { fill?, stroke?, strokeWidth? } }
 */

(function() {
    const command = {
        id: 'updateStyle',
        description: 'Update fill, stroke, and stroke width of objects',

        execute(input) {
            const { document } = VectorEditor.app;
            const { objectIds, style } = input;

            objectIds.forEach(id => {
                document.updateObjectStyle(id, style);
            });

            return { updatedCount: objectIds.length };
        }
    };

    window.VectorEditor = window.VectorEditor || {};
    window.VectorEditor.App = window.VectorEditor.App || {};
    window.VectorEditor.App.Commands = window.VectorEditor.App.Commands || {};
    window.VectorEditor.App.Commands.UpdateStyle = command;
})();
