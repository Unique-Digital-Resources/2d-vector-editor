/**
 * spline-tool.js - Spline/Bezier curve tool
 * Tool for drawing bezier curves with control handles
 */

(function() {

    const toolInfo = {
        name: 'spline',
        group: 'drawing',
        shortcut: 'S',
        title: 'Spline Tool (S)',
        icon: 'mdi-vector-curve'
    };

    function init() {
    }

    function getCursor() {
        return 'crosshair';
    }

    window.VectorEditor = window.VectorEditor || {};
    window.VectorEditor.tools = window.VectorEditor.tools || {};
    window.VectorEditor.tools.spline = {
        info: toolInfo,
        init,
        getCursor
    };

})();
