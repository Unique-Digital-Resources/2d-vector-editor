/**
 * tool-rotate.js - Rotate tool
 * Tool for rotating objects
 */

(function() {
    'const { state } = VectorEditor;';

    const toolInfo = {
        name: 'rotate',
        group: 'transform',
        shortcut: 'O',
        title: 'Rotate (O)',
        icon: 'mdi-rotate-right'
    };

    function init() {
        // Tool is initialized by toolbar.js
        // Additional initialization can be added here
    }

    function getCursor() {
        return 'grab';
    }

    // Register tool
    window.VectorEditor = window.VectorEditor || {};
    window.VectorEditor.tools = window.VectorEditor.tools || {};
    window.VectorEditor.tools.rotate = {
        info: toolInfo,
        init,
        getCursor
    };

})();
