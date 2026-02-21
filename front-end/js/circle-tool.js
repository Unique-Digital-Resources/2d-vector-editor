/**
 * circle-tool.js - Circle tool
 * Tool for drawing circles
 */

(function() {
    'const { state } = VectorEditor;';

    const toolInfo = {
        name: 'circle',
        group: 'shapes',
        shortcut: 'C',
        title: 'Circle (C)',
        icon: 'mdi-circle-outline'
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
    window.VectorEditor.tools.circle = {
        info: toolInfo,
        init,
        getCursor
    };

})();
