/**
 * lines-tool.js - Polyline/Lines tool
 * Tool for drawing polylines and paths
 */

(function() {
    'const { state } = VectorEditor;';

    const toolInfo = {
        name: 'polyline',
        group: 'drawing',
        shortcut: 'P',
        title: 'Lines Tool (P)',
        icon: 'mdi-vector-polyline'
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
    window.VectorEditor.tools.polyline = {
        info: toolInfo,
        init,
        getCursor
    };

})();
