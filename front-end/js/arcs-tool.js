/**
 * arcs-tool.js - Arc tool
 * Tool for drawing arcs
 */

(function() {
    'const { state } = VectorEditor;';

    const toolInfo = {
        name: 'arc',
        group: 'drawing',
        shortcut: 'A',
        title: 'Arc Tool (A)',
        icon: 'mdi-vector-bezier'
    };

    function init() {
        // Initialize arc settings listeners
        initArcSettings();
    }

    function initArcSettings() {
        const arcAngleInput = document.getElementById('inputArcAngle');
        const arcSweepSelect = document.getElementById('inputArcSweep');
        const arcAngularitySwitch = document.getElementById('arcAngularitySwitch');

        if (arcAngleInput) {
            arcAngleInput.addEventListener('input', e => {
                state.arcAngle = Math.max(1, Math.min(359, parseFloat(e.target.value) || 90));
                const { render } = VectorEditor;
                const canvas = document.getElementById('canvas');
                if (state.tool === 'arc' && state.drawingPoints && canvas && render) render(canvas);
            });
        }

        if (arcSweepSelect) {
            arcSweepSelect.addEventListener('change', e => {
                state.arcSweep = parseInt(e.target.value);
                const { render } = VectorEditor;
                const canvas = document.getElementById('canvas');
                if (state.tool === 'arc' && state.drawingPoints && canvas && render) render(canvas);
            });
        }

        if (arcAngularitySwitch) {
            arcAngularitySwitch.addEventListener('click', () => {
                state.arcAngularity = !state.arcAngularity;
                arcAngularitySwitch.classList.toggle('active', state.arcAngularity);
                
                if (arcAngleInput) {
                    arcAngleInput.disabled = state.arcAngularity;
                }
                
                const { render } = VectorEditor;
                const canvas = document.getElementById('canvas');
                if (state.tool === 'arc' && state.drawingPoints && canvas && render) render(canvas);
            });
        }
    }

    function getCursor() {
        return 'crosshair';
    }

    // Register tool
    window.VectorEditor = window.VectorEditor || {};
    window.VectorEditor.tools = window.VectorEditor.tools || {};
    window.VectorEditor.tools.arc = {
        info: toolInfo,
        init,
        getCursor
    };

})();
