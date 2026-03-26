import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import * as cheerio from 'cheerio';

const HTML_FILES = ['introduction.html','omics.html','sample_management.html','ethics.html','workflow.html','discussion.html','authors.html'];
const CONTENT_DIR = join(process.cwd(), 'public', '3m');

function tableToMarkdown($, table) {
    const rows = [];
    $(table).find('tr').each((_, tr) => {
        const cells = [];
        $(tr).find('th, td').each((_, cell) => cells.push($(cell).text().trim()));
        rows.push(cells);
    });
    if (!rows.length) return '';
    const lines = ['| ' + rows[0].join(' | ') + ' |', '| ' + rows[0].map(() => '---').join(' | ') + ' |'];
    for (let i = 1; i < rows.length; i++) lines.push('| ' + rows[i].join(' | ') + ' |');
    return lines.join('\n');
}

function buildKnowledgeBase() {
    const allContent = [];
    for (const file of HTML_FILES) {
        const filePath = join(CONTENT_DIR, file);
        if (!existsSync(filePath)) continue;
        const html = readFileSync(filePath, 'utf-8');
        const $ = cheerio.load(html);
        const pageTitle = $('title').text().split(' - ')[0].trim() || $('h2').first().text().trim();
        const baseUrl = `/3m/${file}`;
        let pageContent = `## ${pageTitle} [Source: ${baseUrl}]\n\n`;
        $('main').find('section, .sub-section, .sample-type, .workflow-step').each((_, el) => {
            const $el = $(el);
            const hasChildren = $el.find('.sub-section, .sample-type, .workflow-step').length > 0;
            const heading = $el.find('> h3, > h4, > h5').first();
            const title = heading.length ? heading.text().trim() : '';
            const anchor = $el.attr('id') ? '#' + $el.attr('id') : ($el.closest('[id]').attr('id') ? '#' + $el.closest('[id]').attr('id') : '');
            const paragraphs = [];
            $el.find('> p').each((_, p) => { const t = $(p).text().trim(); if (t) paragraphs.push(t); });
            const tables = [];
            if (!hasChildren) {
                $el.find('.table-header').each((_, header) => {
                    const tt = $(header).find('h5').text().trim();
                    const te = $(header).next('.table-container').find('table');
                    if (te.length) { const md = tableToMarkdown($, te); if (md) tables.push(tt ? `${tt}\n${md}` : md); }
                });
                if (!tables.length) $el.find('> .table-container > table, > table').each((_, t) => { const md = tableToMarkdown($, t); if (md) tables.push(md); });
            }
            if (paragraphs.length || tables.length) {
                if (title) pageContent += `### ${title} [Source: ${baseUrl}${anchor}]\n\n`;
                if (paragraphs.length) pageContent += paragraphs.join('\n\n') + '\n\n';
                if (tables.length) pageContent += tables.join('\n\n') + '\n\n';
            }
        });
        allContent.push(pageContent);
    }
    return allContent.join('\n---\n\n');
}

let cachedKB = null;
function getKnowledgeBase() {
    if (!cachedKB) cachedKB = buildKnowledgeBase();
    return cachedKB;
}

function buildSystemPrompt() {
    return `You are ChatBiobank, an AI assistant specializing in the 3M Framework for Multi-omics Biobank Development (3M = multi-omics, multimodal biospecimen, and multi-departmental coordination).

You have complete knowledge of the 3M Framework, which covers:
- Omics requirements (genomics, transcriptomics, proteomics, metabolomics, epigenomics) with detailed sample volume specifications
- Sample management SOPs (tissue, blood, urine, saliva, feces collection, processing, storage)
- Sample aliquoting, transport, and quality control procedures
- Ethics & security (informed consent, privacy protection, data security)
- Biobank workflows (sample accession, release, metadata management)

When answering:
- **Tables**: Reproduce COMPLETE tables. Do NOT merge rows or rephrase cell values.
- **QC thresholds**: List ALL metrics and thresholds. Do not summarize.
- **Source links**: Add clickable Markdown links like [Section Name](url) after relevant content.
- Match the user's language.
- Be precise and professional.

## Complete Knowledge Base

${getKnowledgeBase()}`;
}

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const { query, user, conversation_id } = req.body;
        const API_KEY = process.env.MOONSHOT_API_KEY;
        const API_BASE = process.env.MOONSHOT_API_BASE_URL || 'https://api.moonshot.cn/v1';
        const MODEL = process.env.MOONSHOT_MODEL || 'kimi-k2.5';

        if (!API_KEY) return res.status(500).json({ error: 'MOONSHOT_API_KEY not configured' });

        const messages = [
            { role: 'system', content: buildSystemPrompt() },
            { role: 'user', content: query }
        ];

        const response = await fetch(`${API_BASE}/chat/completions`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: MODEL, messages, stream: true })
        });

        if (!response.ok) throw new Error(`Kimi API error: ${response.status}`);

        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let assistantMsg = '', msgId = 'msg-' + Date.now();

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n');
                for (const line of lines) {
                    if (!line.startsWith('data: ') || line.includes('[DONE]')) continue;
                    try {
                        const data = JSON.parse(line.slice(6));
                        const delta = data.choices?.[0]?.delta?.content || '';
                        if (delta) {
                            assistantMsg += delta;
                            res.write(`data: ${JSON.stringify({ event: 'message', answer: delta, message_id: msgId, conversation_id: conversation_id || 'conv-' + Date.now() })}\n\n`);
                        }
                    } catch (e) {}
                }
            }
            res.write(`data: ${JSON.stringify({ event: 'message_end', message_id: msgId })}\n\n`);
        } finally {
            reader.releaseLock();
            res.end();
        }
    } catch (error) {
        console.error('Chat API error:', error.message);
        res.status(500).json({ error: error.message });
    }
}
