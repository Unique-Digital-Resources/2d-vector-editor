/**
 * IdGenerator.js - Deterministic-capable ID generation service
 * Pure utility, no IO dependencies
 */

class IdGenerator {
    constructor() {
        this._counter = 0;
    }

    generate(prefix = 'shape') {
        this._counter++;
        return `${prefix}_${this._counter}_${Math.random().toString(36).substr(2, 6)}`;
    }

    reset() {
        this._counter = 0;
    }

    get count() {
        return this._counter;
    }
}

window.VectorEditor = window.VectorEditor || {};
window.VectorEditor.Core = window.VectorEditor.Core || {};
window.VectorEditor.Core.IdGenerator = IdGenerator;
