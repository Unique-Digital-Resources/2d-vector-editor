/**
 * EventBus.js - Application-level event bus
 * Bridges domain events to UI and plugin subscribers
 */

class EventBus {
    constructor(domainEventEmitter) {
        this._domainEmitter = domainEventEmitter;
        this._uiListeners = {};
    }

    subscribe(eventType, handler) {
        if (!this._uiListeners[eventType]) {
            this._uiListeners[eventType] = [];
        }
        this._uiListeners[eventType].push(handler);

        // Also subscribe to domain emitter
        const unsubDomain = this._domainEmitter.on(eventType, handler);

        return () => {
            unsubDomain();
            this._uiListeners[eventType] = this._uiListeners[eventType].filter(h => h !== handler);
        };
    }

    publish(eventType, payload) {
        this._domainEmitter.emit(eventType, payload);
    }
}

window.VectorEditor = window.VectorEditor || {};
window.VectorEditor.App = window.VectorEditor.App || {};
window.VectorEditor.App.EventBus = EventBus;
