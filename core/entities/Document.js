/**
 * Document.js - Aggregate root managing vector objects
 * Enforces invariants and emits domain events
 */

class Document {
    constructor(eventEmitter) {
        this._objects = new Map();
        this._objectOrder = []; // z-order tracking
        this._eventEmitter = eventEmitter;
    }

    // --- Queries ---

    getObject(id) {
        return this._objects.get(id) || null;
    }

    getAllObjects() {
        return this._objectOrder.map(id => this._objects.get(id)).filter(Boolean);
    }

    getObjectCount() {
        return this._objects.size;
    }

    hasObject(id) {
        return this._objects.has(id);
    }

    // --- Commands (mutations) ---

    addObject(vectorObject) {
        if (this._objects.has(vectorObject.id)) {
            throw new (window.VectorEditor.Core.InvalidOperationError)(
                `Object with ID ${vectorObject.id} already exists`
            );
        }
        this._objects.set(vectorObject.id, vectorObject);
        this._objectOrder.push(vectorObject.id);

        this._eventEmitter.emit('object.created', {
            objectId: vectorObject.id,
            type: vectorObject.type,
            name: vectorObject.name
        });

        return vectorObject;
    }

    removeObject(id) {
        if (!this._objects.has(id)) {
            throw new (window.VectorEditor.Core.ObjectNotFoundError)(id);
        }
        const obj = this._objects.get(id);
        this._objects.delete(id);
        this._objectOrder = this._objectOrder.filter(oid => oid !== id);

        this._eventEmitter.emit('object.deleted', {
            objectId: id,
            type: obj.type,
            name: obj.name
        });

        return obj;
    }

    removeObjects(ids) {
        const removed = [];
        ids.forEach(id => {
            if (this._objects.has(id)) {
                removed.push(this.removeObject(id));
            }
        });
        return removed;
    }

    updateObjectPathData(id, pathData, bounds, segments) {
        const obj = this._objects.get(id);
        if (!obj) throw new (window.VectorEditor.Core.ObjectNotFoundError)(id);
        const event = obj.updatePathData(pathData, bounds, segments);
        this._eventEmitter.emit(event.type, { objectId: id });
        return obj;
    }

    updateObjectStyle(id, style) {
        const obj = this._objects.get(id);
        if (!obj) throw new (window.VectorEditor.Core.ObjectNotFoundError)(id);
        const event = obj.updateStyle(style);
        this._eventEmitter.emit(event.type, { objectId: id, style });
        return obj;
    }

    clear() {
        this._objects.clear();
        this._objectOrder = [];
        this._eventEmitter.emit('document.cleared', {});
    }

    // --- Serialization ---

    serialize() {
        return {
            objects: this._objectOrder.map(id => this._objects.get(id).serialize())
        };
    }
}

window.VectorEditor = window.VectorEditor || {};
window.VectorEditor.Core = window.VectorEditor.Core || {};
window.VectorEditor.Core.Document = Document;
