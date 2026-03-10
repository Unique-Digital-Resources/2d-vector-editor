/**
 * CreateShape.js - Command to create vector shapes
 * Input: { type, params, style }
 */

(function() {
    const command = {
        id: 'createShape',
        description: 'Create a new vector shape',

        execute(input) {
            const { document, idGenerator } = VectorEditor.app;
            const { type, pathData, bounds, segments, closed, style } = input;

            const id = idGenerator.generate(type);
            const name = `${type.charAt(0).toUpperCase() + type.slice(1)} ${idGenerator.count}`;

            const obj = new VectorEditor.Core.VectorObject({
                id,
                type,
                name,
                pathData,
                bounds,
                segments: segments || [],
                closed: closed !== undefined ? closed : true,
                fill: style?.fill || VectorEditor.state?.fillColor || '#10b981',
                stroke: style?.stroke || VectorEditor.state?.strokeColor || '#ffffff',
                strokeWidth: style?.strokeWidth || VectorEditor.state?.strokeWidth || 2
            });

            document.addObject(obj);
            return { objectId: id, object: obj };
        }
    };

    window.VectorEditor = window.VectorEditor || {};
    window.VectorEditor.App = window.VectorEditor.App || {};
    window.VectorEditor.App.Commands = window.VectorEditor.App.Commands || {};
    window.VectorEditor.App.Commands.CreateShape = command;
})();
