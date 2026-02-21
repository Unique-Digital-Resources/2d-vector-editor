/**
 * polygon-tool.js - Polygon tool
 * Tool for drawing polygons
 */

(function() {
    'const { state } = VectorEditor;';

    const toolInfo = {
        name: 'polygon',
        group: 'shapes',
        shortcut: 'Y',
        title: 'Polygon (Y)',
        icon: 'mdi-hexagon-outline'
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
    window.VectorEditor.tools.polygon = {
        info: toolInfo,
        init,
        getCursor
    };

})();
