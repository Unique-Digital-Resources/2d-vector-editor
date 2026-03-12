/**
 * application/index.js  —  /application layer
 *
 * Bootstraps the application: creates registry instances,
 * registers all commands, attaches to VectorEditor.app.
 *
 * Updated to include ModifierRegistry + modifier commands.
 * AGENT.md §10: expose use-cases via commands, emit events.
 */
(function () {

    function bootstrap () {
        const Core = VectorEditor.Core;
        const App  = VectorEditor.App;

        // ── Infrastructure ──────────────────────────────────────────────
        const eventEmitter    = new Core.DomainEventEmitter();
        const idGenerator     = new Core.IdGenerator();
        const document        = new Core.Document(eventEmitter);
        const commandRegistry = new App.CommandRegistry();
        const eventBus        = new App.EventBus(eventEmitter);
        const modifierRegistry= new App.ModifierRegistry();

        // ── Register commands ───────────────────────────────────────────
        const cmds = App.Commands;

        // Shape commands
        if (cmds.CreateShape)     commandRegistry.register(cmds.CreateShape);
        if (cmds.DeleteObject)    commandRegistry.register(cmds.DeleteObject);
        if (cmds.UpdateStyle)     commandRegistry.register(cmds.UpdateStyle);
        if (cmds.DuplicateObject) commandRegistry.register(cmds.DuplicateObject);

        // Modifier commands
        if (cmds.AddModifier)              commandRegistry.register(cmds.AddModifier);
        if (cmds.RemoveModifier)           commandRegistry.register(cmds.RemoveModifier);
        if (cmds.UpdateModifier)           commandRegistry.register(cmds.UpdateModifier);
        if (cmds.ReorderModifier)          commandRegistry.register(cmds.ReorderModifier);
        if (cmds.ToggleModifierVisibility) commandRegistry.register(cmds.ToggleModifierVisibility);
        if (cmds.MoveModifierBefore)       commandRegistry.register(cmds.MoveModifierBefore);
        if (cmds.ApplyModifier)            commandRegistry.register(cmds.ApplyModifier);

        // ── Expose app object ───────────────────────────────────────────
        VectorEditor.app = {
            document,
            commandRegistry,
            eventBus,
            eventEmitter,
            idGenerator,
            modifierRegistry,

            execute (commandId, input) {
                return commandRegistry.execute(commandId, input);
            }
        };

        return VectorEditor.app;
    }

    window.VectorEditor         = window.VectorEditor || {};
    window.VectorEditor.App     = window.VectorEditor.App || {};
    window.VectorEditor.App.bootstrap = bootstrap;

})();