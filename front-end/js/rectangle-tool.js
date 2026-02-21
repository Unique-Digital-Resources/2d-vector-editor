/**
 * rectangle-tool.js - Rectangle tool
 * Tool for drawing rectangles
 */

(function() {
    'const { state } = VectorEditor;';

    const toolInfo = {
        name: 'rectangle',
        group: 'shapes',
        shortcut: 'M',
        title: 'Rectangle (M)',
        icon: 'mdi-rectangle-outline'
    };

    function init() {
        // Tool is initialized by toolbar.js
        // Additional initialization can be added here
    }

    function getCursor() {
        return 'crosshair';
    }

    // Register tool
    window.VectorEditor = window.VectorEditor || {};
    window.VectorEditor.tools = window.VectorEditor.tools || {};
    window.VectorEditor.tools.rectangle = {
        info: toolInfo,
        init,
        getCursor
    };

})();
