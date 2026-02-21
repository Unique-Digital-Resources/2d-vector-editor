/**
 * properties-bar.js - Settings bar
 * Top settings bar with transform and style controls
 */

(function() {
    'const { state } = VectorEditor;';

    // ============================================
    // UI UPDATE
    // ============================================

    function updatePropertiesBar() {
        const obj = state.objects.find(o => o.id === state.selectedObjectId);
        const transformGroup = document.getElementById('transformSettings');
        const shapeSettingsContainer = document.getElementById('shapeSettings');
        
        if (!transformGroup || !shapeSettingsContainer) return;

        shapeSettingsContainer.innerHTML = '';
        shapeSettingsContainer.style.display = 'none';

        if(obj) {
            const xs = obj.points.map(p => p.x);
            const ys = obj.points.map(p => p.y);
            const minX = Math.min(...xs);
            const minY = Math.min(...ys);

            transformGroup.style.display = 'flex';
            document.getElementById('inputX').value = Math.round(minX);
            document.getElementById('inputY').value = Math.round(minY);

            document.getElementById('fillColor').value = obj.fill === 'none' ? '#000000' : obj.fill;
            document.getElementById('strokeColor').value = obj.stroke;
            document.getElementById('strokeWidth').value = obj.strokeWidth;

            if (obj.type === 'polygon') {
                shapeSettingsContainer.style.display = 'flex';
                const label = document.createElement('span');
                label.className = 'settings-label';
                label.textContent = 'Sides';
                const input = document.createElement('input');
                input.type = 'number';
                input.className = 'settings-input';
                input.id = 'inputSides';
                input.value = obj.sides;
                input.min = 3;
                input.max = 50;
                
                input.addEventListener('change', (e) => {
                    const newSides = parseInt(e.target.value);
                    if (newSides >= 3 && obj.center && obj.radius) {
                        const pts = [];
                        const step = (2 * Math.PI) / newSides;
                        for(let i=0; i<newSides; i++) {
                            pts.push({ x: obj.center.x + obj.radius * Math.cos(-Math.PI/2 + i*step), y: obj.center.y + obj.radius * Math.sin(-Math.PI/2 + i*step) });
                        }
                        const edges = [];
                        for(let i=0; i<newSides; i++) edges.push({ points: [i, (i+1)%newSides] });
                        obj.points = pts;
                        obj.edges = edges;
                        obj.sides = newSides;
                        const { render } = VectorEditor;
                        const canvas = document.getElementById('canvas');
                        if (canvas && render) render(canvas);
                    }
                });

                shapeSettingsContainer.appendChild(label);
                shapeSettingsContainer.appendChild(input);
            }
            
            // Show multi-selection indicator
            if (state.selectedObjectIds.length > 1) {
                const multiIndicator = document.createElement('span');
                multiIndicator.className = 'settings-label';
                multiIndicator.textContent = `${state.selectedObjectIds.length} objects selected`;
                multiIndicator.style.marginLeft = '10px';
                multiIndicator.style.color = '#10b981';
                shapeSettingsContainer.style.display = 'flex';
                shapeSettingsContainer.appendChild(multiIndicator);
            }

        } else {
            transformGroup.style.display = 'none';
        }
    }

    // ============================================
    // EVENT LISTENERS
    // ============================================

    function initPropertiesBar() {
        // Transform inputs
        ['inputX', 'inputY'].forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;
            
            el.addEventListener('change', e => {
                const obj = state.objects.find(o => o.id === state.selectedObjectId);
                if(!obj) return;
                
                const targetX = parseFloat(document.getElementById('inputX').value);
                const targetY = parseFloat(document.getElementById('inputY').value);

                const xs = obj.points.map(p => p.x);
                const ys = obj.points.map(p => p.y);
                const minX = Math.min(...xs);
                const minY = Math.min(...ys);

                const dx = targetX - minX;
                const dy = targetY - minY;

                // Move all selected objects
                state.selectedObjectIds.forEach(objId => {
                    const selObj = state.objects.find(o => o.id === objId);
                    if (selObj) {
                        selObj.points.forEach(p => { p.x += dx; p.y += dy; });
                    }
                });
                
                const { render } = VectorEditor;
                const canvas = document.getElementById('canvas');
                if (canvas && render) render(canvas);
            });
        });

        // Fill color
        const fillColorEl = document.getElementById('fillColor');
        if (fillColorEl) {
            fillColorEl.addEventListener('input', e => {
                state.fillColor = e.target.value;
                // Apply to all selected objects
                state.selectedObjectIds.forEach(objId => {
                    const obj = state.objects.find(o => o.id === objId);
                    if(obj && obj.fill !== 'none') { 
                        obj.fill = e.target.value; 
                    }
                });
                const { render } = VectorEditor;
                const canvas = document.getElementById('canvas');
                if (canvas && render) render(canvas);
            });
        }

        // Stroke color
        const strokeColorEl = document.getElementById('strokeColor');
        if (strokeColorEl) {
            strokeColorEl.addEventListener('input', e => {
                state.strokeColor = e.target.value;
                // Apply to all selected objects
                state.selectedObjectIds.forEach(objId => {
                    const obj = state.objects.find(o => o.id === objId);
                    if(obj) { 
                        obj.stroke = e.target.value; 
                    }
                });
                const { render } = VectorEditor;
                const canvas = document.getElementById('canvas');
                if (canvas && render) render(canvas);
            });
        }

        // Stroke width
        const strokeWidthEl = document.getElementById('strokeWidth');
        if (strokeWidthEl) {
            strokeWidthEl.addEventListener('input', e => {
                state.strokeWidth = parseInt(e.target.value);
                // Apply to all selected objects
                state.selectedObjectIds.forEach(objId => {
                    const obj = state.objects.find(o => o.id === objId);
                    if(obj) { 
                        obj.strokeWidth = state.strokeWidth; 
                    }
                });
                const { render } = VectorEditor;
                const canvas = document.getElementById('canvas');
                if (canvas && render) render(canvas);
            });
        }

        // Listen for updates
        window.addEventListener('vectorEditorUpdate', updatePropertiesBar);
    }

    // ============================================
    // EXPORTS
    // ============================================

    window.VectorEditor = window.VectorEditor || {};
    window.VectorEditor.updatePropertiesBar = updatePropertiesBar;
    window.VectorEditor.initPropertiesBar = initPropertiesBar;

})();
