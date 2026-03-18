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

    // ── Systems Demo — auto-play ─────────────────────────────
    function setupSystemsExplainer() {
        if (!document.getElementById('signal-topology')) return;

        const STAGES = [
            {
                label: 'The system at launch',
                sim: { rdcs: 5, sensors: 2, readFreqPerMin: 1, gateways: 1, extractionMs: 150 },
                narration: 'At launch, everything works. Five field devices, one gateway, readings arriving cleanly every minute. The product ships. No one sees a problem — because there isn\'t one yet.'
            },
            {
                label: 'Early growth looks healthy',
                sim: { rdcs: 18, sensors: 3, readFreqPerMin: 1, gateways: 1, extractionMs: 150 },
                narration: 'More sensors are deployed. The gateway handles it. No alarms, no errors. The dashboard looks fine. But gateway utilisation is climbing quietly toward a threshold nobody has modelled.'
            },
            {
                label: 'The invisible threshold',
                sim: { rdcs: 42, sensors: 4, readFreqPerMin: 1, gateways: 1, extractionMs: 150 },
                narration: 'At 42 devices the gateway is over 70% utilised. The system still appears to function — but devices are beginning to queue. Some readings arrive late. There\'s no error to see.'
            },
            {
                label: 'Silent failure at scale',
                sim: { rdcs: 75, sensors: 4, readFreqPerMin: 1, gateways: 1, extractionMs: 150 },
                narration: 'The gateway is now completely saturated. Readings are silently dropped — no error, no alarm. The application reports healthy sensor counts. The data was never there. This is the failure the product was heading toward.'
            },
            {
                label: 'Diagnosis: dynamic scheduling',
                sim: { rdcs: 75, sensors: 4, readFreqPerMin: 1, gateways: 4, extractionMs: 150 },
                narration: 'The fix isn\'t more hardware — it\'s understanding the scheduling model. Dynamic distribution across gateways makes utilisation predictable at any scale. Caught at design review. Cost to fix: near zero.'
            }
        ];

        let currentStage = 0;
        let autoPlayTimer = null;

        const dots       = document.querySelectorAll('.demo-stage-dot');
        const labelEl    = document.getElementById('demo-stage-label');
        const narrationEl = document.getElementById('demo-stage-narration');

        function setStage(i) {
            currentStage = i;
            const stage = STAGES[i];
            Object.assign(state.simulator, stage.sim);

            if (labelEl) labelEl.textContent = stage.label;
            if (narrationEl) {
                narrationEl.classList.add('updating');
                setTimeout(() => {
                    narrationEl.textContent = stage.narration;
                    narrationEl.classList.remove('updating');
                }, 180);
            }
            dots.forEach((d, idx) => d.classList.toggle('active', idx === i));
            updateExplainer();
        }

        function advance() { setStage((currentStage + 1) % STAGES.length); }
        function startAutoPlay() { stopAutoPlay(); autoPlayTimer = setInterval(advance, 4800); }
        function stopAutoPlay() { clearInterval(autoPlayTimer); }

        dots.forEach((dot, i) => {
            dot.addEventListener('click', () => { stopAutoPlay(); setStage(i); startAutoPlay(); });
        });

        const askInput = document.getElementById('demo-ask-input');
        const askBtn   = document.getElementById('demo-ask-btn');
        const askResp  = document.getElementById('demo-ask-response');
        if (askInput && askBtn) {
            const doAsk = () => {
                const text = askInput.value.trim();
                if (!text) return;
                stopAutoPlay();
                askInput.value = '';
                askAboutSystem(text, askResp);
            };
            askBtn.addEventListener('click', doAsk);
            askInput.addEventListener('keydown', e => { if (e.key === 'Enter') doAsk(); });
            askInput.addEventListener('focus', stopAutoPlay);
            askInput.addEventListener('blur', () => setTimeout(startAutoPlay, 4000));
        }

        setStage(0);
        startAutoPlay();
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

    function updateExplainer() {
        const computed = computeSystemState(state.simulator);

        const metricReadings = document.getElementById('signal-metric-readings');
        const metricUtil     = document.getElementById('signal-metric-util');
        const metricQueue    = document.getElementById('signal-metric-queue');
        const metricMode     = document.getElementById('signal-metric-mode');

        if (metricReadings) metricReadings.textContent = computed.readingsPerMin.toLocaleString();

        if (metricUtil) {
            metricUtil.textContent = `${computed.utilisationPct}%`;
            metricUtil.className = 'demo-metric-value';
            if (computed.utilisationPct > 100) metricUtil.classList.add('danger');
            else if (computed.utilisationPct > 65) metricUtil.classList.add('warn');
        }

        if (metricQueue) {
            metricQueue.textContent = computed.queueDepth > 9999 ? '∞' : computed.queueDepth.toLocaleString();
            metricQueue.className = 'demo-metric-value';
            if (computed.status === 'OVERLOADED') metricQueue.classList.add('danger');
            else if (computed.status === 'STRESSED') metricQueue.classList.add('warn');
        }

        if (metricMode) {
            metricMode.textContent = computed.schedulingMode;
            metricMode.className = `demo-metric-value signal-mode-badge${computed.status === 'OVERLOADED' ? ' overloaded' : computed.schedulingMode === 'DYNAMIC' ? ' dynamic' : ''}`;
        }

        drawTopology(computed);
        drawTimingChart(computed);
    }

    function drawTopology(computed) {
        const svg = document.getElementById('signal-topology');
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

    function drawTimingChart(computed) {
        const canvas = document.getElementById('signal-timing-chart');
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

    async function askAboutSystem(text, responseEl) {
        if (!text || state.isLoading) return;

        if (responseEl) {
            responseEl.classList.add('loading');
            responseEl.textContent = 'Thinking…';
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
                    messages: [{ role: 'user', content: text }]
                })
            });
            if (!res.ok) throw new Error('API error');
            const data = await res.json();
            if (responseEl) {
                responseEl.classList.remove('loading');
                responseEl.textContent = data.text || '';
            }
        } catch {
            if (responseEl) {
                responseEl.classList.remove('loading');
                responseEl.textContent = 'Something went wrong. Please try again.';
            }
        } finally {
            state.isLoading = false;
        }
    }

    // ── Robot intro ─────────────────────────────────────────
    function setupRobot() {
        // Only ever show once per browser
        if (localStorage.getItem('signal-robot-shown')) return;

        const robot = document.createElement('div');
        robot.className = 'signal-robot';
        // Tracked inspection robot — WALL-E / ExRobotics style
        robot.innerHTML = `
        <div class="robot-bob">
          <svg width="94" height="66" viewBox="0 0 94 66" fill="none" xmlns="http://www.w3.org/2000/svg">

            <!-- Camera mast (static post) -->
            <rect x="42" y="10" width="4" height="13" rx="1"
                  fill="rgba(0,180,216,0.18)" stroke="#00b4d8" stroke-width="1"/>

            <!-- Camera sensor head (tilts on arrival) -->
            <g class="robot-head">
              <!-- sensor housing -->
              <rect x="31" y="1" width="24" height="11" rx="2"
                    fill="rgba(0,180,216,0.14)" stroke="#00b4d8" stroke-width="1.3"/>
              <!-- main lens -->
              <circle cx="40" cy="6" r="3.8" fill="rgba(0,180,216,0.18)" stroke="#00b4d8" stroke-width="1.2"/>
              <circle cx="40" cy="6" r="1.9" fill="#00b4d8" opacity="0.85"/>
              <circle cx="39" cy="5" r="0.7" fill="white" opacity="0.7"/>
              <!-- forward lamp (like ExR-2 light) -->
              <rect x="51" y="3" width="3" height="6" rx="1" fill="white" opacity="0.75"/>
              <!-- status dot -->
              <circle cx="35" cy="6" r="1.2" fill="#22c55e" opacity="0.9"/>
            </g>

            <!-- Body — main panel, amber/yellow ExR-2 coloring -->
            <rect x="9" y="22" width="76" height="22" rx="3"
                  fill="rgba(196,146,10,0.10)" stroke="#c4920a" stroke-width="1.4"/>
            <!-- curved dome top (ExR-2 black cowl silhouette) -->
            <path d="M18 22 Q47 14 76 22"
                  fill="rgba(0,0,0,0.25)" stroke="#c4920a" stroke-width="1" opacity="0.8"/>
            <!-- louvred ventilation panel (left side) -->
            <line x1="15" y1="27" x2="15" y2="39" stroke="#c4920a" stroke-width="1" opacity="0.45"/>
            <line x1="19" y1="27" x2="19" y2="39" stroke="#c4920a" stroke-width="1" opacity="0.45"/>
            <line x1="23" y1="27" x2="23" y2="39" stroke="#c4920a" stroke-width="1" opacity="0.45"/>
            <line x1="27" y1="27" x2="27" y2="39" stroke="#c4920a" stroke-width="1" opacity="0.45"/>
            <!-- front sensor bar -->
            <rect x="79" y="28" width="4" height="10" rx="1"
                  fill="rgba(0,180,216,0.12)" stroke="#00b4d8" stroke-width="1"/>
            <circle cx="81" cy="33" r="1.4" fill="#00b4d8" opacity="0.85"/>
            <!-- status lights (right of body) -->
            <circle cx="60" cy="29" r="1.4" fill="#22c55e" opacity="0.9"/>
            <circle cx="66" cy="29" r="1.4" fill="#00b4d8" opacity="0.65"/>
            <circle cx="72" cy="29" r="1.4" fill="#00b4d8" opacity="0.45"/>

            <!-- Track assembly (draw before wheels so wheels sit on top) -->
            <rect x="2" y="44" width="90" height="20" rx="10"
                  fill="rgba(8,12,18,0.75)" stroke="#00b4d8" stroke-width="1.4"/>
            <!-- tread stripes — staggered pulses simulate rolling -->
            <line class="robot-tread-anim" x1="23" y1="44" x2="23" y2="64"
                  stroke="#00b4d8" stroke-width="1.1" style="animation-delay:0s"/>
            <line class="robot-tread-anim" x1="32" y1="44" x2="32" y2="64"
                  stroke="#00b4d8" stroke-width="1.1" style="animation-delay:0.12s"/>
            <line class="robot-tread-anim" x1="41" y1="44" x2="41" y2="64"
                  stroke="#00b4d8" stroke-width="1.1" style="animation-delay:0.24s"/>
            <line class="robot-tread-anim" x1="50" y1="44" x2="50" y2="64"
                  stroke="#00b4d8" stroke-width="1.1" style="animation-delay:0.36s"/>
            <line class="robot-tread-anim" x1="59" y1="44" x2="59" y2="64"
                  stroke="#00b4d8" stroke-width="1.1" style="animation-delay:0.48s"/>
            <line class="robot-tread-anim" x1="68" y1="44" x2="68" y2="64"
                  stroke="#00b4d8" stroke-width="1.1" style="animation-delay:0.60s"/>
            <line class="robot-tread-anim" x1="77" y1="44" x2="77" y2="64"
                  stroke="#00b4d8" stroke-width="1.1" style="animation-delay:0.72s"/>

            <!-- Front drive wheel — spoked like ExR-2 -->
            <circle cx="12" cy="54" r="10" fill="rgba(8,12,18,0.85)" stroke="#00b4d8" stroke-width="1.4"/>
            <circle cx="12" cy="54" r="4.5" fill="rgba(0,180,216,0.14)" stroke="#00b4d8" stroke-width="1"/>
            <line x1="12" y1="45" x2="12" y2="63" stroke="#00b4d8" stroke-width="0.9" opacity="0.5"/>
            <line x1="3"  y1="54" x2="21" y2="54" stroke="#00b4d8" stroke-width="0.9" opacity="0.5"/>
            <line x1="5"  y1="47" x2="19" y2="61" stroke="#00b4d8" stroke-width="0.9" opacity="0.5"/>
            <line x1="19" y1="47" x2="5"  y2="61" stroke="#00b4d8" stroke-width="0.9" opacity="0.5"/>

            <!-- Rear drive wheel — spoked -->
            <circle cx="82" cy="54" r="10" fill="rgba(8,12,18,0.85)" stroke="#00b4d8" stroke-width="1.4"/>
            <circle cx="82" cy="54" r="4.5" fill="rgba(0,180,216,0.14)" stroke="#00b4d8" stroke-width="1"/>
            <line x1="82" y1="45" x2="82" y2="63" stroke="#00b4d8" stroke-width="0.9" opacity="0.5"/>
            <line x1="73" y1="54" x2="91" y2="54" stroke="#00b4d8" stroke-width="0.9" opacity="0.5"/>
            <line x1="75" y1="47" x2="89" y2="61" stroke="#00b4d8" stroke-width="0.9" opacity="0.5"/>
            <line x1="89" y1="47" x2="75" y2="61" stroke="#00b4d8" stroke-width="0.9" opacity="0.5"/>
          </svg>
        </div>`;
        document.body.appendChild(robot);

        const btn = document.getElementById('signal-float-btn');
        const targetRight = 150; // px from right — just left of the button

        // Delay then start walk
        setTimeout(() => {
            const endX = window.innerWidth - targetRight;

            // Fade in and start walking
            robot.style.opacity = '1';
            robot.style.transition = `left 3.2s cubic-bezier(0.4, 0, 0.6, 1)`;
            robot.classList.add('walking');

            // Force reflow then trigger transition
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    robot.style.left = endX + 'px';
                });
            });

            // Arrived — stop walking, tilt head up toward button, then pulse button
            setTimeout(() => {
                robot.classList.remove('walking');
                robot.classList.add('arrived');
                btn?.classList.add('robot-arrived');

                // Fade robot out after the head-tilt moment lands
                setTimeout(() => {
                    robot.style.transition = 'opacity 0.8s';
                    robot.style.opacity = '0';
                    setTimeout(() => {
                        robot.remove();
                        localStorage.setItem('signal-robot-shown', '1');
                    }, 800);
                }, 1800);

            }, 3300);

        }, 2800); // wait for page to settle
    }

    // ── Welcome screen ───────────────────────────────────────
    function setupWelcome() {
        const welcome = document.getElementById('signal-welcome');
        if (!welcome) return;

        // Inject the mini robot SVG (same design, static/no animation)
        const robotSlot = document.getElementById('signal-welcome-robot');
        if (robotSlot) {
            robotSlot.innerHTML = `
            <svg width="94" height="66" viewBox="0 0 94 66" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="42" y="10" width="4" height="13" rx="1" fill="rgba(0,180,216,0.18)" stroke="#00b4d8" stroke-width="1"/>
              <rect x="31" y="1" width="24" height="11" rx="2" fill="rgba(0,180,216,0.14)" stroke="#00b4d8" stroke-width="1.3"/>
              <circle cx="40" cy="6" r="3.8" fill="rgba(0,180,216,0.18)" stroke="#00b4d8" stroke-width="1.2"/>
              <circle cx="40" cy="6" r="1.9" fill="#00b4d8" opacity="0.85"/>
              <circle cx="39" cy="5" r="0.7" fill="white" opacity="0.7"/>
              <rect x="51" y="3" width="3" height="6" rx="1" fill="white" opacity="0.75"/>
              <circle cx="35" cy="6" r="1.2" fill="#22c55e" opacity="0.9"/>
              <rect x="9" y="22" width="76" height="22" rx="3" fill="rgba(196,146,10,0.10)" stroke="#c4920a" stroke-width="1.4"/>
              <path d="M18 22 Q47 14 76 22" fill="rgba(0,0,0,0.25)" stroke="#c4920a" stroke-width="1" opacity="0.8"/>
              <line x1="15" y1="27" x2="15" y2="39" stroke="#c4920a" stroke-width="1" opacity="0.45"/>
              <line x1="19" y1="27" x2="19" y2="39" stroke="#c4920a" stroke-width="1" opacity="0.45"/>
              <line x1="23" y1="27" x2="23" y2="39" stroke="#c4920a" stroke-width="1" opacity="0.45"/>
              <line x1="27" y1="27" x2="27" y2="39" stroke="#c4920a" stroke-width="1" opacity="0.45"/>
              <rect x="79" y="28" width="4" height="10" rx="1" fill="rgba(0,180,216,0.12)" stroke="#00b4d8" stroke-width="1"/>
              <circle cx="81" cy="33" r="1.4" fill="#00b4d8" opacity="0.85"/>
              <circle cx="60" cy="29" r="1.4" fill="#22c55e" opacity="0.9"/>
              <circle cx="66" cy="29" r="1.4" fill="#00b4d8" opacity="0.65"/>
              <circle cx="72" cy="29" r="1.4" fill="#00b4d8" opacity="0.45"/>
              <rect x="2" y="44" width="90" height="20" rx="10" fill="rgba(8,12,18,0.75)" stroke="#00b4d8" stroke-width="1.4"/>
              <circle cx="12" cy="54" r="10" fill="rgba(8,12,18,0.85)" stroke="#00b4d8" stroke-width="1.4"/>
              <circle cx="12" cy="54" r="4.5" fill="rgba(0,180,216,0.14)" stroke="#00b4d8" stroke-width="1"/>
              <line x1="12" y1="45" x2="12" y2="63" stroke="#00b4d8" stroke-width="0.9" opacity="0.5"/>
              <line x1="3" y1="54" x2="21" y2="54" stroke="#00b4d8" stroke-width="0.9" opacity="0.5"/>
              <line x1="5" y1="47" x2="19" y2="61" stroke="#00b4d8" stroke-width="0.9" opacity="0.5"/>
              <line x1="19" y1="47" x2="5" y2="61" stroke="#00b4d8" stroke-width="0.9" opacity="0.5"/>
              <circle cx="82" cy="54" r="10" fill="rgba(8,12,18,0.85)" stroke="#00b4d8" stroke-width="1.4"/>
              <circle cx="82" cy="54" r="4.5" fill="rgba(0,180,216,0.14)" stroke="#00b4d8" stroke-width="1"/>
              <line x1="82" y1="45" x2="82" y2="63" stroke="#00b4d8" stroke-width="0.9" opacity="0.5"/>
              <line x1="73" y1="54" x2="91" y2="54" stroke="#00b4d8" stroke-width="0.9" opacity="0.5"/>
              <line x1="75" y1="47" x2="89" y2="61" stroke="#00b4d8" stroke-width="0.9" opacity="0.5"/>
              <line x1="89" y1="47" x2="75" y2="61" stroke="#00b4d8" stroke-width="0.9" opacity="0.5"/>
            </svg>`;
        }

        // Dismiss and go straight to career guide, optionally firing a preset question
        function dismissWelcome(question) {
            sessionStorage.setItem('signal-welcomed', '1');
            switchMode('career_guide'); // also hides welcome (no data-mode match)
            if (question) {
                // Small delay so the panel transition completes first
                setTimeout(() => {
                    const panel = document.querySelector('.signal-panel[data-mode="career_guide"]');
                    const input = panel?.querySelector('.signal-input');
                    if (input) {
                        input.value = question;
                        panel.querySelector('.signal-send-btn')?.click();
                    }
                }, 80);
            }
        }

        document.getElementById('signal-welcome-explore')?.addEventListener('click', () => dismissWelcome(null));

        welcome.querySelectorAll('.signal-welcome-chip').forEach(chip => {
            chip.addEventListener('click', () => dismissWelcome(chip.dataset.q));
        });
    }

    // ── Floating widget open/close ───────────────────────────
    function setupFloat() {
        const btn = document.getElementById('signal-float-btn');
        const panel = document.getElementById('signal-float-panel');
        const closeBtn = document.getElementById('signal-float-close');
        const demoLink = document.getElementById('signal-open-demo');
        const welcome = document.getElementById('signal-welcome');

        if (!btn || !panel) return;

        btn.addEventListener('click', () => {
            const isOpen = panel.classList.contains('open');
            if (isOpen) {
                panel.classList.remove('open');
                panel.setAttribute('aria-hidden', 'true');
            } else {
                panel.classList.add('open');
                panel.setAttribute('aria-hidden', 'false');
                // Show welcome if not yet seen this session
                if (welcome && !sessionStorage.getItem('signal-welcomed')) {
                    welcome.classList.remove('hidden');
                    // Hide the mode panels while welcome is shown
                    document.querySelectorAll('.signal-panel:not(#signal-welcome)').forEach(p => p.classList.add('hidden'));
                }
            }
        });

        closeBtn?.addEventListener('click', () => {
            panel.classList.remove('open');
            panel.setAttribute('aria-hidden', 'true');
        });

        // Close on outside click
        document.addEventListener('click', (e) => {
            if (!document.getElementById('signal-float')?.contains(e.target)) {
                panel.classList.remove('open');
                panel.setAttribute('aria-hidden', 'true');
            }
        });

        // Systems demo link — close panel and scroll
        demoLink?.addEventListener('click', (e) => {
            e.preventDefault();
            panel.classList.remove('open');
            document.getElementById('systems-demo')?.scrollIntoView({ behavior: 'smooth' });
        });
    }

    // ── Boot ─────────────────────────────────────────────────
    function init() {
        setupRobot();
        setupWelcome();
        setupFloat();
        setupModeSwitcher();
        setupChatPanel('career_guide');
        setupChatPanel('discovery_guide');
        setupSystemsExplainer();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
