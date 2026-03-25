const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

// 要索引的 HTML 文件（排除 index.html 导航页和 copy 文件）
const HTML_FILES = [
    'introduction.html',
    'omics.html',
    'sample_management.html',
    'ethics.html',
    'workflow.html',
    'discussion.html',
    'authors.html'
];

const CONTENT_DIR = path.join(__dirname, '..', 'public', '3m');

let knowledgeBase = '';

/**
 * 将 HTML 表格转为 Markdown 格式
 */
function tableToMarkdown($, table) {
    const rows = [];
    $(table).find('tr').each((_, tr) => {
        const cells = [];
        $(tr).find('th, td').each((_, cell) => {
            cells.push($(cell).text().trim());
        });
        rows.push(cells);
    });

    if (rows.length === 0) return '';

    const lines = [];
    // 表头
    lines.push('| ' + rows[0].join(' | ') + ' |');
    lines.push('| ' + rows[0].map(() => '---').join(' | ') + ' |');
    // 数据行
    for (let i = 1; i < rows.length; i++) {
        lines.push('| ' + rows[i].join(' | ') + ' |');
    }
    return lines.join('\n');
}

/**
 * 查找元素最近的带 id 的祖先或自身，返回锚点
 */
function findAnchor($, el) {
    let $el = $(el);
    // 先检查自身
    if ($el.attr('id')) return '#' + $el.attr('id');
    // 向上查找带 id 的祖先
    const $parent = $el.closest('[id]');
    if ($parent.length) return '#' + $parent.attr('id');
    return '';
}

/**
 * 从单个 HTML 文件提取结构化文本（含来源链接）
 */
function extractContent(fileName) {
    const filePath = path.join(CONTENT_DIR, fileName);
    const html = fs.readFileSync(filePath, 'utf-8');
    const $ = cheerio.load(html);

    // 获取页面标题
    const pageTitle = $('title').text().split(' - ')[0].trim() || $('h2').first().text().trim();
    const baseUrl = `/3m/${fileName}`;

    const sections = [];

    // 遍历 main 中的内容区域
    $('main').find('section, .sub-section, .sample-type, .workflow-step').each((_, el) => {
        const $el = $(el);

        // 如果这个元素包含子区域，只提取自身直属内容（子区域会单独处理）
        const hasChildren = $el.find('.sub-section, .sample-type, .workflow-step').length > 0;

        // 提取标题（h3/h4/h5 — 只取直属的第一个）
        const heading = $el.find('> h3, > h4, > h5').first();
        const title = heading.length ? heading.text().trim() : '';

        // 构建来源链接
        const anchor = findAnchor($, el);
        const sourceUrl = baseUrl + anchor;

        // 提取段落文本（只取直属段落）
        const paragraphs = [];
        $el.find('> p').each((_, p) => {
            const text = $(p).text().trim();
            if (text) paragraphs.push(text);
        });

        // 提取表格（只取直属的，不深入子区域）
        const tables = [];
        if (!hasChildren) {
            // 叶子节点：提取所有表格，每张表配自己的标题
            $el.find('.table-header').each((_, header) => {
                const tableTitle = $(header).find('h5').text().trim();
                const tableEl = $(header).next('.table-container').find('table');
                if (tableEl.length) {
                    const md = tableToMarkdown($, tableEl);
                    if (md) tables.push(tableTitle ? `${tableTitle}\n${md}` : md);
                }
            });
            // 如果没有 .table-header 结构，回退到直接查找表格
            if (tables.length === 0) {
                $el.find('> .table-container > table, > table').each((_, table) => {
                    const md = tableToMarkdown($, table);
                    if (md) tables.push(md);
                });
            }
        }

        // 提取列表（只取直属）
        const lists = [];
        $el.find('> ol > li, > ul > li').each((_, li) => {
            lists.push('- ' + $(li).text().trim());
        });

        if (paragraphs.length || tables.length || lists.length) {
            let content = '';
            if (paragraphs.length) content += paragraphs.join('\n\n');
            if (lists.length) content += '\n' + lists.join('\n');
            if (tables.length) content += '\n\n' + tables.join('\n\n');
            sections.push({ title, content, sourceUrl });
        }
    });

    // 如果 section 解析为空，回退到提取 main 下所有文本
    if (sections.length === 0) {
        $('main table').each((_, table) => {
            const md = tableToMarkdown($, table);
            $(table).replaceWith(md);
        });
        const text = $('main').text().trim().replace(/\s+/g, ' ');
        if (text) {
            sections.push({ title: pageTitle, content: text, sourceUrl: baseUrl });
        }
    }

    return { pageTitle, sections, baseUrl };
}

/**
 * 初始化：读取所有 HTML，构建完整知识库文本（含来源标注）
 */
function initialize() {
    const allContent = [];

    for (const file of HTML_FILES) {
        const filePath = path.join(CONTENT_DIR, file);
        if (!fs.existsSync(filePath)) {
            console.warn(`RAG: 文件不存在，跳过: ${file}`);
            continue;
        }

        const { pageTitle, sections, baseUrl } = extractContent(file);

        let pageContent = `## ${pageTitle} [Source: ${baseUrl}]\n\n`;
        for (const section of sections) {
            if (section.title) {
                pageContent += `### ${section.title} [Source: ${section.sourceUrl}]\n\n`;
            }
            pageContent += section.content + '\n\n';
        }

        allContent.push(pageContent);
    }

    knowledgeBase = allContent.join('\n---\n\n');

    // 统计
    const wordCount = knowledgeBase.split(/\s+/).length;
    const charCount = knowledgeBase.length;
    console.log(`RAG 引擎初始化完成: ${HTML_FILES.length} 个文件, ${wordCount} 词, ${charCount} 字符`);

    return knowledgeBase;
}

/**
 * 构建包含完整知识库的 system prompt
 */
function buildSystemPrompt() {
    return `You are ChatBiobank, an AI assistant specializing in the 3M Framework for Multi-omics Biobank Development (3M = multi-omics, multimodal biospecimen, and multi-departmental coordination).

You have complete knowledge of the 3M Framework, which covers:
- Omics requirements (genomics, transcriptomics, proteomics, metabolomics, epigenomics) with detailed sample volume specifications
- Sample management SOPs (tissue, blood, urine, saliva, feces collection, processing, storage)
- Sample aliquoting, transport, and quality control procedures
- Ethics & security (informed consent, privacy protection, data security)
- Biobank workflows (sample accession, release, metadata management)

When answering:
- **Tables**: When the user asks about sample requirements or specifications, reproduce the COMPLETE table from the knowledge base. Do NOT merge rows (e.g., keep "Surgical tissue" and "Biopsy tissue" as separate rows), do NOT rephrase cell values — copy them exactly as written (e.g., "≥20 pieces (5-10μm thick, 50mm2 size)" not a shortened version).
- **QC thresholds**: When asked about quality control, list ALL metrics and thresholds mentioned in the knowledge base (e.g., OD ratios, RIN values, electrophoresis criteria). Do not summarize — be exhaustive.
- **Source links**: Each section has a [Source: /3m/...] tag. When you reference information, add a clickable Markdown link like: [📖 Section Name](url). Place them naturally after the relevant content.
- If the user asks about something not covered in the knowledge base, say so honestly.
- Match the user's language: if the user writes in Chinese, respond in Chinese; if in English, respond in English.
- Be precise and professional, suitable for biobank researchers and clinical staff.

## Complete Knowledge Base

${knowledgeBase}`;
}

/**
 * 获取知识库原始文本（调试用）
 */
function getKnowledgeBase() {
    return knowledgeBase;
}

module.exports = {
    initialize,
    buildSystemPrompt,
    getKnowledgeBase
};
