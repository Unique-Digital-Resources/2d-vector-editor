/**
 * DeleteObject.js - Command to delete objects
 * Input: { objectIds: string[] }
 */

(function() {
    const command = {
        id: 'deleteObject',
        description: 'Delete one or more objects',

        execute(input) {
            const { document } = VectorEditor.app;
            const { objectIds } = input;
            const removed = document.removeObjects(objectIds);
            return { removedCount: removed.length };
        }
    };

    window.VectorEditor = window.VectorEditor || {};
    window.VectorEditor.App = window.VectorEditor.App || {};
    window.VectorEditor.App.Commands = window.VectorEditor.App.Commands || {};
    window.VectorEditor.App.Commands.DeleteObject = command;
})();
