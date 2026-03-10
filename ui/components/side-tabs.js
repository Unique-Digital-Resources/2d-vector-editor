/**
 * side-tabs.js  —  /ui layer
 *
 * Blender-inspired vertical icon tab strip on the left edge of the side panel.
 * Icon buttons only — no text labels.  Active tab gets an accent left-border.
 *
 * UI projection only.  Switching tabs writes to state.activeTab (UI-only field).
 */
(function () {

    const TABS = [
        { id: 'objects',    icon: 'mdi-layers-outline',   title: 'Objects (layers)'    },
        { id: 'properties', icon: 'mdi-tune-variant',     title: 'Properties'          },
        { id: 'modifiers',  icon: 'mdi-wrench-outline',   title: 'Modifiers'           },
    ];

    /* per-tab accent colour — mirrors Blender panel colouring */
    const ACCENT = {
        objects:    '#10b981',
        properties: '#3b82f6',
        modifiers:  '#f59e0b',
    };

    /* ── public ────────────────────────────────────────────────────────── */

    function switchTab (id) {
        VectorEditor.state.activeTab = id;

        /* icon buttons */
        document.querySelectorAll('.vtab-icon-btn').forEach(btn => {
            const active = btn.dataset.tab === id;
            btn.classList.toggle('active', active);
            btn.style.setProperty('--tab-accent', ACCENT[id] || 'var(--accent)');
        });

        /* pane visibility */
        document.querySelectorAll('.vtab-pane').forEach(pane => {
            pane.style.display = pane.dataset.tab === id ? 'flex' : 'none';
        });

        /* optional: update pane header text */
        const header = document.getElementById('vtabPaneTitle');
        if (header) {
            const tab = TABS.find(t => t.id === id);
            header.textContent = tab ? tab.title : id;
            header.style.color = ACCENT[id] || 'var(--accent)';
        }
    }

    function initSideTabs () {
        const strip = document.getElementById('vtabIconStrip');
        if (!strip) return;

        strip.innerHTML = '';

        TABS.forEach(tab => {
            const btn = document.createElement('button');
            btn.className   = 'vtab-icon-btn';
            btn.dataset.tab = tab.id;
            btn.title       = tab.title;
            btn.style.setProperty('--tab-accent', ACCENT[tab.id] || 'var(--accent)');
            btn.innerHTML   = `<i class="mdi ${tab.icon}"></i>`;
            btn.addEventListener('click', () => switchTab(tab.id));
            strip.appendChild(btn);
        });

        /* activate the default tab */
        switchTab(VectorEditor.state.activeTab || 'objects');
    }

    /* ── export ────────────────────────────────────────────────────────── */

    window.VectorEditor = window.VectorEditor || {};
    window.VectorEditor.initSideTabs = initSideTabs;
    window.VectorEditor.switchTab    = switchTab;

})();