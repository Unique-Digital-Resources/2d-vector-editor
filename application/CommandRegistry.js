/**
 * CommandRegistry.js - Central command registry
 * All state-changing behavior must go through commands
 */

class CommandRegistry {
    constructor() {
        this._commands = new Map();
    }

    register(command) {
        if (!command.id || !command.execute) {
            throw new Error('Command must have id and execute method');
        }
        this._commands.set(command.id, command);
    }

    execute(commandId, input) {
        const command = this._commands.get(commandId);
        if (!command) {
            throw new Error(`Command not found: ${commandId}`);
        }
        return command.execute(input);
    }

    list() {
        return Array.from(this._commands.values()).map(cmd => ({
            id: cmd.id,
            description: cmd.description || ''
        }));
    }

    has(commandId) {
        return this._commands.has(commandId);
    }
}

window.VectorEditor = window.VectorEditor || {};
window.VectorEditor.App = window.VectorEditor.App || {};
window.VectorEditor.App.CommandRegistry = CommandRegistry;
