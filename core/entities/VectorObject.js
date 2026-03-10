/**
 * VectorObject.js - Domain entity for a vector shape/path
 * Pure domain model with no UI knowledge
 */

class VectorObject {
    /**
     * @param {Object} params
     * @param {string} params.id - Unique identifier
     * @param {string} params.type - Shape type (rectangle, ellipse, polygon, star, path, freehand)
     * @param {string} params.name - Display name
     * @param {string} params.pathData - SVG path data string
     * @param {Object} params.bounds - {x, y, width, height}
     * @param {Array} params.segments - Paper.js segment data [{point, handleIn, handleOut}]
     * @param {boolean} params.closed - Whether path is closed
     * @param {string} params.fill - Fill color
     * @param {string} params.stroke - Stroke color
     * @param {number} params.strokeWidth - Stroke width
     */
    constructor({ id, type, name, pathData, bounds, segments, closed, fill, stroke, strokeWidth }) {
        if (!id) throw new (window.VectorEditor.Core.ValidationError)('id', 'ID is required');
        if (!type) throw new (window.VectorEditor.Core.ValidationError)('type', 'Type is required');

        this._id = id;
        this._type = type;
        this._name = name || type;
        this._pathData = pathData || '';
        this._bounds = bounds || { x: 0, y: 0, width: 0, height: 0 };
        this._segments = segments || [];
        this._closed = closed !== undefined ? closed : true;
        this._fill = fill || '#10b981';
        this._stroke = stroke || '#ffffff';
        this._strokeWidth = strokeWidth !== undefined ? strokeWidth : 2;
        this._metadata = {};
    }

    // --- Getters (read-only external access) ---
    get id() { return this._id; }
    get type() { return this._type; }
    get name() { return this._name; }
    get pathData() { return this._pathData; }
    get bounds() { return { ...this._bounds }; }
    get segments() { return this._segments.map(s => ({ ...s })); }
    get closed() { return this._closed; }
    get fill() { return this._fill; }
    get stroke() { return this._stroke; }
    get strokeWidth() { return this._strokeWidth; }
    get metadata() { return { ...this._metadata }; }

    // --- Domain methods (mutations that return events) ---

    updatePathData(pathData, bounds, segments) {
        this._pathData = pathData;
        if (bounds) this._bounds = { ...bounds };
        if (segments) this._segments = segments;
        return { type: 'object.updated', objectId: this._id };
    }

    updateBounds(bounds) {
        this._bounds = { ...bounds };
        return { type: 'object.updated', objectId: this._id };
    }

    updateStyle({ fill, stroke, strokeWidth }) {
        if (fill !== undefined) this._fill = fill;
        if (stroke !== undefined) this._stroke = stroke;
        if (strokeWidth !== undefined) this._strokeWidth = strokeWidth;
        return { type: 'object.styleChanged', objectId: this._id };
    }

    rename(newName) {
        if (!newName || typeof newName !== 'string') {
            throw new (window.VectorEditor.Core.ValidationError)('name', 'Name must be a non-empty string');
        }
        this._name = newName;
        return { type: 'object.updated', objectId: this._id };
    }

    setMetadata(key, value) {
        this._metadata[key] = value;
    }

    // --- Serialization ---

    serialize() {
        return {
            id: this._id,
            type: this._type,
            name: this._name,
            pathData: this._pathData,
            bounds: { ...this._bounds },
            segments: this._segments.map(s => ({ ...s })),
            closed: this._closed,
            fill: this._fill,
            stroke: this._stroke,
            strokeWidth: this._strokeWidth,
            metadata: { ...this._metadata }
        };
    }

    static deserialize(data) {
        return new VectorObject(data);
    }
}

window.VectorEditor = window.VectorEditor || {};
window.VectorEditor.Core = window.VectorEditor.Core || {};
window.VectorEditor.Core.VectorObject = VectorObject;
