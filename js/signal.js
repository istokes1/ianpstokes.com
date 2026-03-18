/* ============================================================
   SIGNAL — AI Feature
   ============================================================ */

(function () {
    'use strict';

    const API_URL = '/.netlify/functions/signal';

    const SUGGESTIONS = {
        career_guide: [
            'What industries has Ian worked in?',
            'What is Ian\'s strongest technical domain?',
            'Has Ian worked with safety-critical systems?',
            'Could Ian help scale an engineering team?',
            'What experience does Ian have with cloud and IoT?'
        ],
        discovery_guide: [
            'Has Ian led global engineering teams?',
            'What experience does he have with Azure or IoT?',
            'Could he help a founder-led company scale engineering?',
            'Has Ian worked in energy or nuclear sectors?',
            'What does Ian\'s engineering philosophy look like?'
        ]
    };

    // ── State ────────────────────────────────────────────────
    const state = {
        activeMode: 'career_guide',
        conversations: {
            career_guide: [],
            discovery_guide: []
        },
        isLoading: false,
        simulator: {
            rdcs: 20,
            sensors: 4,
            readFreqPerMin: 1,
            gateways: 1,
            extractionMs: 150
        },
        narrationDebounce: null
    };

    // ── Init ─────────────────────────────────────────────────
    function init() {
        setupModeSwitcher();
        setupChatPanel('career_guide');
        setupChatPanel('discovery_guide');
        setupSystemsExplainer();
    }

    // ── Mode Switcher ────────────────────────────────────────
    function setupModeSwitcher() {
        document.querySelectorAll('.signal-mode-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const mode = btn.dataset.mode;
                switchMode(mode);
            });
        });
    }

    function switchMode(mode) {
        state.activeMode = mode;

        document.querySelectorAll('.signal-mode-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === mode);
        });

        document.querySelectorAll('.signal-panel').forEach(panel => {
            panel.classList.toggle('hidden', panel.dataset.mode !== mode);
        });
    }

    // ── Chat Panel ───────────────────────────────────────────
    function setupChatPanel(mode) {
        const panel = document.querySelector(`[data-mode="${mode}"].signal-panel`);
        if (!panel) return;

        const messagesEl = panel.querySelector('.signal-messages');
        const input = panel.querySelector('.signal-input');
        const sendBtn = panel.querySelector('.signal-send-btn');

        // Suggestion pills
        panel.querySelectorAll('.signal-suggestion-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                input.value = btn.textContent.trim();
                sendMessage(mode, panel, messagesEl, input, sendBtn);
            });
        });

        // Send on button click
        sendBtn.addEventListener('click', () => {
            sendMessage(mode, panel, messagesEl, input, sendBtn);
        });

        // Send on Enter (Shift+Enter for newline)
        input.addEventListener('keydown', e => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage(mode, panel, messagesEl, input, sendBtn);
            }
        });
    }

    async function sendMessage(mode, panel, messagesEl, input, sendBtn) {
        const text = input.value.trim();
        if (!text || state.isLoading) return;

        input.value = '';
        state.isLoading = true;
        sendBtn.disabled = true;

        // Add user message to state and DOM
        state.conversations[mode].push({ role: 'user', content: text });
        appendMessage(messagesEl, 'user', text);

        // Add loading assistant bubble
        const loadingBubble = appendMessage(messagesEl, 'assistant', '', true);

        try {
            const res = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    mode,
                    messages: state.conversations[mode]
                })
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({ error: 'Request failed' }));
                throw new Error(err.error || 'Request failed');
            }

            const data = await res.json();
            const responseText = data.text || '';

            // Update loading bubble with real content
            loadingBubble.classList.remove('loading');
            loadingBubble.innerHTML = formatResponse(responseText);

            state.conversations[mode].push({ role: 'assistant', content: responseText });

        } catch (err) {
            loadingBubble.classList.remove('loading');
            loadingBubble.textContent = err.message === 'Too many requests. Please try again later.'
                ? 'Too many requests — please try again in a little while.'
                : 'Something went wrong. Please try again.';
        } finally {
            state.isLoading = false;
            sendBtn.disabled = false;
            messagesEl.scrollTop = messagesEl.scrollHeight;
        }
    }

    function appendMessage(container, role, text, loading = false) {
        const div = document.createElement('div');
        div.className = `signal-message ${role}${loading ? ' loading' : ''}`;
        if (text) div.innerHTML = formatResponse(text);
        container.appendChild(div);
        container.scrollTop = container.scrollHeight;
        return div;
    }

    function formatResponse(text) {
        // Convert markdown-style **bold** and newlines to HTML
        return text
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\n\n/g, '</p><p>')
            .replace(/\n/g, '<br>')
            .replace(/^(.+)/, '<p>$1')
            .replace(/(.+)$/, '$1</p>');
    }

    // ── Systems Explainer ────────────────────────────────────
    function setupSystemsExplainer() {
        const panel = document.querySelector('[data-mode="systems_explainer"].signal-panel');
        if (!panel) return;

        // Wire sliders
        const sliders = {
            rdcs:           panel.querySelector('#signal-slider-rdcs'),
            sensors:        panel.querySelector('#signal-slider-sensors'),
            readFreq:       panel.querySelector('#signal-slider-freq'),
            gateways:       panel.querySelector('#signal-slider-gateways'),
            extractionMs:   panel.querySelector('#signal-slider-extraction')
        };

        const valueEls = {
            rdcs:           panel.querySelector('#signal-val-rdcs'),
            sensors:        panel.querySelector('#signal-val-sensors'),
            readFreq:       panel.querySelector('#signal-val-freq'),
            gateways:       panel.querySelector('#signal-val-gateways'),
            extractionMs:   panel.querySelector('#signal-val-extraction')
        };

        Object.entries(sliders).forEach(([key, slider]) => {
            if (!slider) return;
            slider.addEventListener('input', () => {
                const val = parseInt(slider.value);
                state.simulator[key] = key === 'readFreq' ? val : val;
                if (valueEls[key]) valueEls[key].textContent = formatSliderValue(key, val);
                updateExplainer(panel);
                scheduleNarration(panel);
            });
        });

        // Initial render
        updateExplainer(panel);

        // Ask-about-this input
        const askInput = panel.querySelector('.signal-explainer-ask input');
        const askBtn = panel.querySelector('.signal-explainer-ask button');
        if (askInput && askBtn) {
            askBtn.addEventListener('click', () => askAboutSystem(panel, askInput));
            askInput.addEventListener('keydown', e => {
                if (e.key === 'Enter') askAboutSystem(panel, askInput);
            });
        }
    }

    function formatSliderValue(key, val) {
        if (key === 'readFreq') return val === 1 ? '1/min' : val < 60 ? `${val}/min` : '1/hr';
        if (key === 'extractionMs') return `${val}ms`;
        return val;
    }

    function computeSystemState(s) {
        const readingsPerMin = s.rdcs * s.sensors * s.readFreqPerMin;
        const extractCapacity = (60000 / s.extractionMs) * s.gateways;
        const utilisation = readingsPerMin / extractCapacity;
        const queueDepth = utilisation > 1
            ? Math.round((utilisation - 1) * readingsPerMin * 2)
            : Math.round(utilisation * s.rdcs * 0.5);

        let status = 'STABLE';
        if (utilisation > 1.0) status = 'OVERLOADED';
        else if (utilisation > 0.65) status = 'STRESSED';

        return {
            readingsPerMin: Math.round(readingsPerMin),
            utilisation: Math.min(utilisation, 2.0),
            utilisationPct: Math.min(Math.round(utilisation * 100), 200),
            queueDepth,
            schedulingMode: utilisation > 0.65 ? 'DYNAMIC' : 'FIXED',
            status
        };
    }

    function updateExplainer(panel) {
        const computed = computeSystemState(state.simulator);

        // Update metrics
        const metricReadings = panel.querySelector('#signal-metric-readings');
        const metricUtil = panel.querySelector('#signal-metric-util');
        const metricQueue = panel.querySelector('#signal-metric-queue');
        const metricMode = panel.querySelector('#signal-metric-mode');

        if (metricReadings) metricReadings.textContent = computed.readingsPerMin.toLocaleString();

        if (metricUtil) {
            metricUtil.textContent = `${computed.utilisationPct}%`;
            metricUtil.className = 'signal-metric-value';
            if (computed.utilisationPct > 100) metricUtil.classList.add('danger');
            else if (computed.utilisationPct > 65) metricUtil.classList.add('warn');
        }

        if (metricQueue) {
            metricQueue.textContent = computed.queueDepth > 9999 ? '∞' : computed.queueDepth.toLocaleString();
            metricQueue.className = 'signal-metric-value';
            if (computed.status === 'OVERLOADED') metricQueue.classList.add('danger');
            else if (computed.status === 'STRESSED') metricQueue.classList.add('warn');
        }

        if (metricMode) {
            metricMode.textContent = computed.schedulingMode;
            metricMode.className = `signal-mode-badge${computed.status === 'OVERLOADED' ? ' overloaded' : computed.schedulingMode === 'DYNAMIC' ? ' dynamic' : ''}`;
        }

        drawTopology(panel, computed);
        drawTimingChart(panel, computed);
    }

    function drawTopology(panel, computed) {
        const svg = panel.querySelector('#signal-topology');
        if (!svg) return;

        const s = state.simulator;
        const W = svg.viewBox.baseVal.width || 600;
        const H = svg.viewBox.baseVal.height || 220;

        // Colours
        const accent = '#00b4d8';
        const border = '#1e293b';
        const textMuted = '#64748b';
        const warn = '#f59e0b';
        const danger = '#ef4444';
        const nodeColor = computed.status === 'OVERLOADED' ? danger : computed.status === 'STRESSED' ? warn : accent;

        // DCM at top centre
        const dcmX = W / 2;
        const dcmY = 30;

        // Gateway positions
        const maxGatewaysToShow = Math.min(s.gateways, 5);
        const gwSpacing = W / (maxGatewaysToShow + 1);
        const gwY = 95;

        // RDCs per gateway (show max 6 visually)
        const maxRDCsToShow = Math.min(s.rdcs, 6);
        const rdcY = 175;

        let html = `
        <rect x="0" y="0" width="${W}" height="${H}" fill="#0d1117"/>

        <!-- DCM -->
        <rect x="${dcmX - 48}" y="${dcmY - 14}" width="96" height="28" rx="6"
              fill="none" stroke="${accent}" stroke-width="1.5"/>
        <text x="${dcmX}" y="${dcmY + 5}" text-anchor="middle" fill="${accent}"
              font-family="JetBrains Mono,monospace" font-size="11">DCM</text>
        `;

        for (let g = 0; g < maxGatewaysToShow; g++) {
            const gwX = gwSpacing * (g + 1);

            // Line DCM → Gateway
            html += `<line x1="${dcmX}" y1="${dcmY + 14}" x2="${gwX}" y2="${gwY - 12}"
                          stroke="${border}" stroke-width="1.5"/>`;

            // Gateway node
            html += `<rect x="${gwX - 30}" y="${gwY - 12}" width="60" height="24" rx="5"
                          fill="${border}" stroke="${nodeColor}" stroke-width="1"/>
                     <text x="${gwX}" y="${gwY + 4}" text-anchor="middle" fill="${nodeColor}"
                           font-family="JetBrains Mono,monospace" font-size="10">GW ${g + 1}</text>`;

            // RDC nodes
            const rdcSpread = 90;
            const rdcSpacing = rdcSpread / Math.max(maxRDCsToShow - 1, 1);
            for (let r = 0; r < maxRDCsToShow; r++) {
                const rdcX = (gwX - rdcSpread / 2) + r * rdcSpacing;
                html += `<line x1="${gwX}" y1="${gwY + 12}" x2="${rdcX}" y2="${rdcY - 8}"
                               stroke="${border}" stroke-width="1" stroke-dasharray="3,2"/>
                         <rect x="${rdcX - 18}" y="${rdcY - 8}" width="36" height="16" rx="3"
                               fill="${border}" stroke="${nodeColor}" stroke-width="0.8" opacity="0.75"/>
                         <text x="${rdcX}" y="${rdcY + 3}" text-anchor="middle" fill="${textMuted}"
                               font-family="JetBrains Mono,monospace" font-size="8">RDC</text>`;
            }

            // "+N more" if truncated
            if (s.rdcs > maxRDCsToShow) {
                html += `<text x="${gwX}" y="${rdcY + 20}" text-anchor="middle" fill="${textMuted}"
                               font-size="8" font-family="JetBrains Mono,monospace">+${s.rdcs - maxRDCsToShow} more</text>`;
            }
        }

        // "+N gateways" if truncated
        if (s.gateways > maxGatewaysToShow) {
            html += `<text x="${W - 10}" y="${gwY + 5}" text-anchor="end" fill="${textMuted}"
                           font-size="9" font-family="JetBrains Mono,monospace">+${s.gateways - maxGatewaysToShow} more gateways</text>`;
        }

        svg.innerHTML = html;
    }

    function drawTimingChart(panel, computed) {
        const canvas = panel.querySelector('#signal-timing-chart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const W = canvas.width;
        const H = canvas.height;
        ctx.clearRect(0, 0, W, H);

        ctx.fillStyle = '#0d1117';
        ctx.fillRect(0, 0, W, H);

        const s = state.simulator;
        const rowsToShow = Math.min(s.rdcs, 10);
        const rowH = (H - 30) / rowsToShow;
        const chartLeft = 36;
        const chartW = W - chartLeft - 8;

        // Time axis label
        ctx.fillStyle = '#475569';
        ctx.font = '9px JetBrains Mono, monospace';
        ctx.fillText('← 60 second window →', chartLeft, H - 6);

        for (let r = 0; r < rowsToShow; r++) {
            const y = 8 + r * rowH;
            const rowLabel = `RDC ${r + 1}`;

            // Row label
            ctx.fillStyle = '#475569';
            ctx.font = '8px JetBrains Mono, monospace';
            ctx.fillText(rowLabel, 0, y + rowH / 2 + 3);

            // Compute how much of the row is each state
            const util = computed.utilisation;
            const totalSlots = 60; // 60 seconds
            const acquireSlots = Math.round(s.sensors); // ~8 seconds to cycle all sensors at 1/min
            const extractSlots = Math.min(Math.round(util * acquireSlots * 1.5), totalSlots);
            const waitSlots = Math.min(Math.round(util * acquireSlots * (util - 0.3)), totalSlots);
            let xOffset = 0;

            // Green: acquiring
            const greenW = (Math.max(acquireSlots - waitSlots, 2) / totalSlots) * chartW;
            ctx.fillStyle = '#22c55e44';
            ctx.fillRect(chartLeft + xOffset, y + 2, greenW, rowH - 4);
            xOffset += greenW;

            // Orange: waiting for extraction
            const orangeSlots = Math.max(0, Math.min(waitSlots, totalSlots - acquireSlots));
            if (orangeSlots > 0) {
                const orangeW = (orangeSlots / totalSlots) * chartW;
                ctx.fillStyle = '#f59e0b55';
                ctx.fillRect(chartLeft + xOffset, y + 2, orangeW, rowH - 4);
                xOffset += orangeW;
            }

            // Red: extraction in progress / backed up
            const redSlots = Math.max(0, Math.min(extractSlots, totalSlots - acquireSlots - orangeSlots));
            if (redSlots > 0 && util > 0.5) {
                const redW = (redSlots / totalSlots) * chartW;
                ctx.fillStyle = '#ef444455';
                ctx.fillRect(chartLeft + xOffset, y + 2, redW, rowH - 4);
            }

            // Row border
            ctx.strokeStyle = '#1e293b';
            ctx.strokeRect(chartLeft, y + 2, chartW, rowH - 4);
        }

        if (s.rdcs > rowsToShow) {
            ctx.fillStyle = '#475569';
            ctx.font = '9px JetBrains Mono, monospace';
            ctx.fillText(`+${s.rdcs - rowsToShow} more RDCs`, chartLeft, H - 18);
        }

        // Legend
        const legendY = H - 6;
        const legendItems = [
            { color: '#22c55e', label: 'acquiring' },
            { color: '#f59e0b', label: 'waiting' },
            { color: '#ef4444', label: 'backed up' }
        ];
        let lx = W - 180;
        legendItems.forEach(item => {
            ctx.fillStyle = item.color + '99';
            ctx.fillRect(lx, legendY - 8, 10, 8);
            ctx.fillStyle = '#475569';
            ctx.font = '8px JetBrains Mono, monospace';
            ctx.fillText(item.label, lx + 13, legendY - 1);
            lx += 58;
        });
    }

    function scheduleNarration(panel) {
        clearTimeout(state.narrationDebounce);
        const narrationEl = panel.querySelector('.signal-narration-text');
        if (narrationEl) {
            narrationEl.className = 'signal-narration-text loading';
            narrationEl.textContent = 'Analysing';
        }
        state.narrationDebounce = setTimeout(() => fetchNarration(panel), 900);
    }

    async function fetchNarration(panel) {
        const narrationEl = panel.querySelector('.signal-narration-text');
        if (!narrationEl) return;

        const s = state.simulator;
        const computed = computeSystemState(s);

        try {
            const res = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    mode: 'systems_explainer',
                    simulator_state: { ...s, ...computed },
                    messages: [{
                        role: 'user',
                        content: `The visitor has just set the simulator to: ${s.rdcs} RDCs, ${s.sensors} sensors per RDC, ${s.readFreqPerMin} reading(s) per minute, ${s.gateways} gateway(s), ${s.extractionMs}ms extraction time. System utilisation is ${computed.utilisationPct}%, status is ${computed.status}. Narrate what this means in 2-3 sentences, as Ian would explain it to a client or hiring manager. Be concrete and direct.`
                    }]
                })
            });

            if (!res.ok) throw new Error('API error');
            const data = await res.json();
            narrationEl.className = 'signal-narration-text';
            narrationEl.textContent = data.text || '';

        } catch {
            narrationEl.className = 'signal-narration-text';
            narrationEl.textContent = 'Adjust the sliders to see how system load changes.';
        }
    }

    async function askAboutSystem(panel, input) {
        const text = input.value.trim();
        if (!text || state.isLoading) return;
        input.value = '';

        const narrationEl = panel.querySelector('.signal-narration-text');
        if (narrationEl) {
            narrationEl.className = 'signal-narration-text loading';
            narrationEl.textContent = 'Thinking';
        }

        const s = state.simulator;
        const computed = computeSystemState(s);
        state.isLoading = true;

        try {
            const res = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    mode: 'systems_explainer',
                    simulator_state: { ...s, ...computed },
                    messages: [{
                        role: 'user',
                        content: text
                    }]
                })
            });

            if (!res.ok) throw new Error('API error');
            const data = await res.json();
            if (narrationEl) {
                narrationEl.className = 'signal-narration-text';
                narrationEl.textContent = data.text || '';
            }
        } catch {
            if (narrationEl) {
                narrationEl.className = 'signal-narration-text';
                narrationEl.textContent = 'Something went wrong. Please try again.';
            }
        } finally {
            state.isLoading = false;
        }
    }

    // ── Boot ─────────────────────────────────────────────────
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
