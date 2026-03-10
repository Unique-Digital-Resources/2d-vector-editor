/**
 * DomainEvents.js - Domain event definitions and event emitter
 * Pure domain events with no UI or infrastructure dependencies
 */

class DomainEventEmitter {
    constructor() {
        this._listeners = {};
    }

    on(eventType, handler) {
        if (!this._listeners[eventType]) {
            this._listeners[eventType] = [];
        }
        this._listeners[eventType].push(handler);
        return () => this.off(eventType, handler);
    }

    off(eventType, handler) {
        if (!this._listeners[eventType]) return;
        this._listeners[eventType] = this._listeners[eventType].filter(h => h !== handler);
    }

    emit(eventType, payload) {
        const event = Object.freeze({
            type: eventType,
            timestamp: Date.now(),
            payload: Object.freeze(payload)
        });
        if (this._listeners[eventType]) {
            this._listeners[eventType].forEach(handler => handler(event));
        }
        if (this._listeners['*']) {
            this._listeners['*'].forEach(handler => handler(event));
        }
    }
}

// Event type constants
const EventTypes = Object.freeze({
    OBJECT_CREATED: 'object.created',
    OBJECT_DELETED: 'object.deleted',
    OBJECT_UPDATED: 'object.updated',
    OBJECT_MOVED: 'object.moved',
    OBJECT_RESIZED: 'object.resized',
    OBJECT_ROTATED: 'object.rotated',
    OBJECT_STYLE_CHANGED: 'object.styleChanged',
    OBJECT_DUPLICATED: 'object.duplicated',
    DOCUMENT_CLEARED: 'document.cleared'
});

// Export for browser (no module system)
window.VectorEditor = window.VectorEditor || {};
window.VectorEditor.Core = window.VectorEditor.Core || {};
window.VectorEditor.Core.DomainEventEmitter = DomainEventEmitter;
window.VectorEditor.Core.EventTypes = EventTypes;
