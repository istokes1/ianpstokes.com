const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');
const path = require('path');

// Rate limiting — simple in-memory store (resets on cold start, fine for portfolio traffic)
const rateLimitStore = new Map();
const RATE_LIMIT = 30; // requests per window
const RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour

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

// Load knowledge base once at cold start
let knowledgeBase;
function getKnowledgeBase() {
    if (!knowledgeBase) {
        const kbPath = path.join(__dirname, '../../data/knowledge-base.json');
        knowledgeBase = JSON.parse(fs.readFileSync(kbPath, 'utf8'));
    }
    return knowledgeBase;
}

function buildSystemPrompt(kb, mode) {
    const identity = kb.identity;
    const modeInstructions = {
        career_guide: `You are in CAREER GUIDE mode. Answer questions about Ian's background, roles, industries, technologies, leadership style, and achievements. Ground every answer in the provided knowledge base. When a visitor shows genuine interest in working with Ian, naturally surface his contact details. Be concise — 2-4 short paragraphs maximum. Suggest relevant sections of the site when helpful.`,
        systems_explainer: `You are in SYSTEMS EXPLAINER mode. Your job is to narrate the RDC/Gateway scaling problem as Ian would explain it to a client or hiring manager. Use the rdc_gateway_problem section of the knowledge base. When the user adjusts the simulator, explain what the numbers mean in plain language — what is happening, why it matters, and what the insight is. Show how Ian diagnoses invisible systems problems. Be clear and non-technical where possible — this explanation must land with a CEO or CTO who is not an IoT engineer.`,
        discovery_guide: `You are in DISCOVERY GUIDE mode. Help visitors find the most relevant part of Ian's site based on their needs or questions. When they describe what they're looking for, point them to the right section using the site_sections in the knowledge base. Offer concise answers with section references. If their need matches Ian's background well, explain why and suggest they get in touch.`
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
${kb.employers.map(e => `• ${e.name} — ${e.role} (${e.period || 'dates not specified'}): ${e.description}`).join('\n')}

EDUCATION:
${kb.education.map(e => `• ${e.qualification}, ${e.institution} (${e.period})`).join('\n')}

SIGNATURE ACHIEVEMENTS:
${kb.signature_achievements.map(a => `• ${a.title}: ${a.description}`).join('\n')}

INDUSTRIES COVERED:
${kb.industries.join(', ')}

EXPERTISE DOMAINS:
${kb.expertise_domains.map(d => `• ${d.domain}: ${d.summary}`).join('\n')}

RDC/GATEWAY SYSTEMS PROBLEM:
${JSON.stringify(kb.rdc_gateway_problem, null, 2)}

SITE SECTIONS (for directing visitors):
${kb.site_sections.map(s => `• #${s.id} — ${s.label}: ${s.description}`).join('\n')}

YOUR MODE: ${modeInstructions[mode] || modeInstructions.career_guide}

GROUNDING RULES — follow these without exception:
1. Only state facts present in this knowledge base. Never invent roles, dates, figures, or claims.
2. Never state Ian's age or total years of experience as a number.
3. ETSI role: Ian was "actively involved in ETSI standards committees as aide to the rapporteur" — never "rapporteur".
4. Maintain Ian's tone: direct, technically credible, no corporate buzzwords, no superlatives.
5. If asked something not in the knowledge base, say so honestly and suggest contacting Ian directly.
6. Never discuss salary expectations, compensation, or make comparative claims about other engineers.
7. Keep responses concise — this is a chat interface, not a document. Use short paragraphs.
8. When a visitor has been engaged for 2+ exchanges and shows genuine professional interest, naturally offer contact details.

CONTACT DETAILS (surface when appropriate, never pushy):
Email: ${identity.contact.email}
LinkedIn: ${identity.contact.linkedin}
Website: ${identity.contact.website}`;
}

exports.handler = async (event) => {
    // CORS preflight
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Methods': 'POST, OPTIONS'
            },
            body: ''
        };
    }

    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method not allowed' };
    }

    // Rate limiting
    const ip = event.headers['x-forwarded-for'] || event.headers['client-ip'] || 'unknown';
    if (isRateLimited(ip)) {
        return {
            statusCode: 429,
            headers: { 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ error: 'Too many requests. Please try again later.' })
        };
    }

    let body;
    try {
        body = JSON.parse(event.body);
    } catch {
        return { statusCode: 400, body: 'Invalid JSON' };
    }

    const { mode = 'career_guide', messages = [], simulator_state = null } = body;

    if (!messages.length) {
        return { statusCode: 400, body: 'No messages provided' };
    }

    // Validate mode
    const validModes = ['career_guide', 'systems_explainer', 'discovery_guide'];
    const safeMode = validModes.includes(mode) ? mode : 'career_guide';

    const kb = getKnowledgeBase();
    const systemPrompt = buildSystemPrompt(kb, safeMode);

    // Build messages — keep last 8 turns to limit token cost
    const conversationMessages = messages.slice(-8).map(m => ({
        role: m.role,
        content: String(m.content).slice(0, 2000) // cap individual message length
    }));

    // Inject simulator state for systems explainer mode
    if (safeMode === 'systems_explainer' && simulator_state) {
        const lastMessage = conversationMessages[conversationMessages.length - 1];
        if (lastMessage.role === 'user') {
            lastMessage.content = `[Current simulator state: ${JSON.stringify(simulator_state)}]\n\n${lastMessage.content}`;
        }
    }

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    try {
        // Non-streaming response (Netlify Functions don't support streaming responses natively)
        // For streaming, a different deployment (Vercel Edge / Cloudflare Workers) would be needed
        const response = await client.messages.create({
            model: 'claude-sonnet-4-5',
            max_tokens: 600,
            system: systemPrompt,
            messages: conversationMessages
        });

        const text = response.content[0]?.text || '';

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({ text, mode: safeMode })
        };

    } catch (err) {
        console.error('Anthropic API error:', err);
        return {
            statusCode: 500,
            headers: { 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ error: 'Something went wrong. Please try again.' })
        };
    }
};
