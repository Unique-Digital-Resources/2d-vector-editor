/**
 * ModifierRegistry.js  —  /application layer
 *
 * Owns the non-destructive modifier stack for every object.
 * Pure data management: no UI, no Paper.js, no DOM.
 *
 * Stack convention
 *   index 0  = newest = applied LAST   (top of Blender-style stack)
 *   last idx = oldest = applied FIRST  (base of stack)
 *
 * Each modifier record:
 *   { id, type, visible, collapsed, params: { … } }
 */

(function () {

    let _counter = 0;

    class ModifierRegistry {
        constructor () {
            /** @type {Object.<string, Array>} objectId → modifier[] */
            this._stacks = {};
        }

        /* ── read ─────────────────────────────────────────────────────── */

        getStack (objectId) {
            return this._stacks[objectId] ? [...this._stacks[objectId]] : [];
        }

        hasModifiers (objectId) {
            const s = this._stacks[objectId];
            return !!(s && s.length > 0);
        }

        hasActiveModifiers (objectId) {
            const s = this._stacks[objectId];
            return !!(s && s.some(m => m.visible));
        }

        /* ── write — called only from commands ────────────────────────── */

        add (objectId, type, params) {
            if (!this._stacks[objectId]) this._stacks[objectId] = [];
            const id = `mod_${Date.now()}_${++_counter}`;
            const modifier = { id, type, visible: true, collapsed: false, params: { ...params } };
            // newest at the front
            this._stacks[objectId].unshift(modifier);
            return modifier;
        }

        remove (objectId, modifierId) {
            if (!this._stacks[objectId]) return false;
            const before = this._stacks[objectId].length;
            this._stacks[objectId] = this._stacks[objectId].filter(m => m.id !== modifierId);
            return this._stacks[objectId].length < before;
        }

        updateParams (objectId, modifierId, partialParams) {
            const m = this._find(objectId, modifierId);
            if (!m) return false;
            m.params = { ...m.params, ...partialParams };
            return true;
        }

        /** direction: 'up' → toward index 0 (newer), 'down' → toward last (older) */
        reorder (objectId, modifierId, direction) {
            const s = this._stacks[objectId];
            if (!s) return false;
            const idx = s.findIndex(m => m.id === modifierId);
            if (idx < 0) return false;
            const newIdx = direction === 'up' ? idx - 1 : idx + 1;
            if (newIdx < 0 || newIdx >= s.length) return false;
            [s[idx], s[newIdx]] = [s[newIdx], s[idx]];
            return true;
        }

        toggleVisibility (objectId, modifierId) {
            const m = this._find(objectId, modifierId);
            if (!m) return null;
            m.visible = !m.visible;
            return m.visible;
        }

        toggleCollapsed (objectId, modifierId) {
            const m = this._find(objectId, modifierId);
            if (!m) return null;
            m.collapsed = !m.collapsed;
            return m.collapsed;
        }

        /** Drag-drop reorder: move modifierId to sit before destModifierId */
        moveBefore (objectId, modifierId, destModifierId) {
            const s = this._stacks[objectId];
            if (!s) return false;
            const srcIdx  = s.findIndex(m => m.id === modifierId);
            const destIdx = s.findIndex(m => m.id === destModifierId);
            if (srcIdx < 0 || destIdx < 0 || srcIdx === destIdx) return false;
            const [moved] = s.splice(srcIdx, 1);
            const newDest = destIdx > srcIdx ? destIdx - 1 : destIdx;
            s.splice(newDest, 0, moved);
            return true;
        }

        removeAllForObject (objectId) {
            delete this._stacks[objectId];
        }

        /* ── private ──────────────────────────────────────────────────── */

        _find (objectId, modifierId) {
            return (this._stacks[objectId] || []).find(m => m.id === modifierId) || null;
        }
    }

    window.VectorEditor = window.VectorEditor || {};
    window.VectorEditor.App = window.VectorEditor.App || {};
    window.VectorEditor.App.ModifierRegistry = ModifierRegistry;

})();