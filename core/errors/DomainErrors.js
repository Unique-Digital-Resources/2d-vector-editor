/**
 * DomainErrors.js - Domain-specific error types
 */

class DomainError extends Error {
    constructor(message, code) {
        super(message);
        this.name = 'DomainError';
        this.code = code;
    }
}

class ObjectNotFoundError extends DomainError {
    constructor(id) {
        super(`Object not found: ${id}`, 'OBJECT_NOT_FOUND');
        this.name = 'ObjectNotFoundError';
        this.objectId = id;
    }
}

class InvalidOperationError extends DomainError {
    constructor(message) {
        super(message, 'INVALID_OPERATION');
        this.name = 'InvalidOperationError';
    }
}

class ValidationError extends DomainError {
    constructor(field, message) {
        super(`Validation failed for ${field}: ${message}`, 'VALIDATION_ERROR');
        this.name = 'ValidationError';
        this.field = field;
    }
}

window.VectorEditor = window.VectorEditor || {};
window.VectorEditor.Core = window.VectorEditor.Core || {};
window.VectorEditor.Core.DomainError = DomainError;
window.VectorEditor.Core.ObjectNotFoundError = ObjectNotFoundError;
window.VectorEditor.Core.InvalidOperationError = InvalidOperationError;
window.VectorEditor.Core.ValidationError = ValidationError;
