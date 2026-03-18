// esbuild bundles this to CJS — use require() throughout
// JSON is inlined at bundle time so no runtime path issues
const Anthropic = require('@anthropic-ai/sdk');
const kb = require('../../data/knowledge-base.json');

console.log('[SIGNAL] Loaded. Employers:', kb.employers?.length, '| SDK:', !!Anthropic);

// Rate limiting
const rateLimitStore = new Map();
const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 60 * 60 * 1000;

function isRateLimited(ip) {
    const now = Date.now();
    const entry = rateLimitStore.get(ip);
    if (!entry || now - entry.windowStart > RATE_WINDOW_MS) {
        rateLimitStore.set(ip, { count: 1, windowStart: now });
        return false;
    }
    if (entry.count >= RATE_LIMIT) return true;
    entry.count++;
    return false;
}

function buildSystemPrompt(mode) {
    const identity = kb.identity;
    const modeInstructions = {
        career_guide: `You are in CAREER GUIDE mode. Answer questions about Ian's background, roles, industries, technologies, leadership style, and achievements. Ground every answer in the provided knowledge base. When a visitor shows genuine interest in working with Ian, naturally surface his contact details. Be concise — 2-4 short paragraphs maximum. Suggest relevant sections of the site when helpful.`,
        systems_explainer: `You are in SYSTEMS EXPLAINER mode. Narrate the RDC/Gateway scaling problem as Ian would explain it to a client or hiring manager. When the user adjusts the simulator, explain what the numbers mean in plain language — what is happening, why it matters, and what the insight is. Show how Ian diagnoses invisible systems problems. Be clear and accessible — this must land with a CEO or CTO who is not an IoT engineer.`,
        discovery_guide: `You are in DISCOVERY GUIDE mode. Help visitors find the most relevant part of Ian's site. When they describe what they're looking for, point them to the right section. Offer concise answers with section references. If their need matches Ian's background well, explain why and suggest they get in touch.`
    };

    return `You are SIGNAL — an AI assistant embedded in Ian P Stokes's engineering portfolio at ianpstokes.com.

ABOUT IAN:
Name: ${identity.name}
Credentials: ${identity.credentials.join(', ')}
Location: ${identity.location}
Positioning: ${identity.positioning}
Unique strength: ${identity.unique_strength}
Current focus: ${identity.current_focus}
Availability: ${identity.availability}

CAREER SUMMARY:
${kb.employers.map(e => `• ${e.name} — ${e.role} (${e.period || ''}): ${e.description}`).join('\n')}

SIGNATURE ACHIEVEMENTS:
${kb.signature_achievements.map(a => `• ${a.title}: ${a.description}`).join('\n')}

INDUSTRIES: ${kb.industries.join(', ')}

EXPERTISE:
${kb.expertise_domains.map(d => `• ${d.domain}: ${d.summary}`).join('\n')}

RDC/GATEWAY PROBLEM:
Context: ${kb.rdc_gateway_problem.context}
Scaling problem: ${kb.rdc_gateway_problem.scaling_problem.description}
Naive approach failure: ${kb.rdc_gateway_problem.scaling_problem.naive_approach}
Solution: ${kb.rdc_gateway_problem.scaling_problem.solution}
Ian's role: ${kb.rdc_gateway_problem.ians_role}

SITE SECTIONS:
${kb.site_sections.map(s => `• #${s.id} — ${s.label}: ${s.description}`).join('\n')}

MODE: ${modeInstructions[mode] || modeInstructions.career_guide}

RULES:
1. Only state facts in this knowledge base. Never invent roles, dates, or figures.
2. Never state Ian's age or total years of experience as a number.
3. ETSI: Ian was "aide to the rapporteur" — never "rapporteur".
4. Tone: direct, technically credible, no buzzwords.
5. If asked something outside the knowledge base, say so and suggest contacting Ian.
6. Never discuss salary or make comparative claims about other engineers.
7. Keep responses concise — short paragraphs, chat interface.
8. After 2+ genuine exchanges, naturally offer contact details if appropriate.

CONTACT: Email ${identity.contact.email} | LinkedIn ${identity.contact.linkedin}`;
}

exports.handler = async (event) => {
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers: corsHeaders, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers: corsHeaders, body: 'Method not allowed' };
    }

    const ip = event.headers['x-forwarded-for'] || 'unknown';
    if (isRateLimited(ip)) {
        return {
            statusCode: 429,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'Too many requests. Please try again later.' })
        };
    }

    let body;
    try {
        body = JSON.parse(event.body);
    } catch {
        return { statusCode: 400, headers: corsHeaders, body: 'Invalid JSON' };
    }

    const { mode = 'career_guide', messages = [], simulator_state = null } = body;

    if (!messages.length) {
        return { statusCode: 400, headers: corsHeaders, body: 'No messages provided' };
    }

    const validModes = ['career_guide', 'systems_explainer', 'discovery_guide'];
    const safeMode = validModes.includes(mode) ? mode : 'career_guide';

    const conversationMessages = messages.slice(-8).map(m => ({
        role: m.role,
        content: String(m.content).slice(0, 2000)
    }));

    if (safeMode === 'systems_explainer' && simulator_state) {
        const last = conversationMessages[conversationMessages.length - 1];
        if (last.role === 'user') {
            last.content = `[Simulator state: ${JSON.stringify(simulator_state)}]\n\n${last.content}`;
        }
    }

    try {
        console.log('[SIGNAL] Mode:', safeMode, '| Key present:', !!process.env.ANTHROPIC_API_KEY);

        const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
        const response = await client.messages.create({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 600,
            system: buildSystemPrompt(safeMode),
            messages: conversationMessages
        });

        console.log('[SIGNAL] OK. Stop reason:', response.stop_reason);
        return {
            statusCode: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: response.content[0]?.text || '' })
        };

    } catch (err) {
        console.error('[SIGNAL] Error:', err.constructor?.name, err.message, 'status:', err.status);
        return {
            statusCode: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'Something went wrong. Please try again.' })
        };
    }
};
