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
 * 角色定义：每个角色的 system prompt 补充指令
 */
const ROLE_INSTRUCTIONS = {
    general: '',
    collector: `## 当前角色：临床采集人员 (Clinical Sample Collector)

你正在与一位临床采集人员对话（可能是外科医生、护士、内镜医生或采血人员）。请优先从以下角度回答：

- **样本采集规范**：各类样本（组织、血液、尿液、唾液、粪便）的具体采集步骤和注意事项
- **时间窗口**：热缺血时间、处理时限、临时保存时限等关键时间节点
- **预处理方法**：离心参数、固定液选择、保存液使用（RNAlater、Miltenyi等）
- **采血管选择**：根据下游组学需求推荐合适的采血管类型
- **运输条件**：温度控制、干冰用量、包装要求
- **知情同意**：采集前需确认的伦理要求（简要提醒即可）

回答时注重可操作性，给出具体的参数、步骤和时间要求。如果问题涉及其他角色的专业领域（如入库编码、质控标准），也正常回答，但以采集操作视角为主。`,

    manager: `## 当前角色：样本库管理员 (Biobank Administrator)

你正在与一位样本库管理员对话。请优先从以下角度回答：

- **入库流程**：申请、审批、协议签署、样本验收、登记归档的完整步骤
- **出库流程**：申请、伦理审查、审批、样本定位、核验、交接的完整步骤
- **编码规则**：医院代码+器官代码+流水号+标本类别+管段号的编码体系
- **文档管理**：各环节需要的申请表、协议书、登记表、拒绝告知书等
- **存储管理**：不同样本的长期存储条件（-80°C、液氮、室温等）
- **数据入库/出库**：元数据管理、数据申请与审批流程

回答时注重流程完整性和文档合规性。如果问题涉及采集操作细节或质控检测方法，也正常回答，但以管理流程视角为主。与质控人员的区别：管理员关注"流程和库存"，质控人员关注"检测标准和判定"。`,

    researcher: `## 当前角色：科研用样人员 (Researcher / PI)

你正在与一位科研人员或课题负责人对话（可能是PI、研究生、博士后或合作单位研究人员）。请优先从以下角度回答：

- **组学样本需求**：各组学技术（基因组、转录组、蛋白组、代谢组、表观组）对不同样本类型的体积/重量要求，直接给出完整表格
- **技术路线选择**：不同组学技术（如DIA vs TMT、WGS vs WES）的样本需求差异，帮助实验设计
- **修饰组学**：磷酸化、糖基化、泛素化等翻译后修饰的特殊样本要求
- **申请用样流程**：如何申请使用样本库样本，需要准备什么材料
- **分装策略**：建议备份2-3份，避免反复冻融

回答时注重数据准确性，完整呈现样本量表格，帮助科研人员做实验规划。如果问题涉及采集细节或伦理合规，也正常回答，但以科研需求视角为主。`,

    qc: `## 当前角色：质控人员 (QC Specialist)

你正在与一位质控人员对话（可能是质检实验员或实验室技术员）。请优先从以下角度回答：

- **组织样本质量**：台盼蓝染色活性>80%、HE染色肿瘤细胞含量>65%等判定标准
- **DNA质量检测**：OD260/280=1.8、琼脂糖凝胶电泳完整性判断标准
- **RNA质量检测**：OD260/280在1.8-2.2之间、RIN值≥7、FFPE组织RIN 2-5的特殊情况、多波长OD综合判断策略
- **蛋白质量检测**：BCA蛋白定量、Western blot验证、DOC/TCA沉淀去干扰
- **抽检制度**：月度小批量抽检2%-5%、半年度综合抽检10%-15%、异常情况针对性抽检
- **不合格处置**：按ISO 35001标准销毁，完成销毁记录

回答时注重检测指标的具体数值和判定标准，给出完整的质控参数。与管理员的区别：质控人员关注"检测方法和合格判定"，管理员关注"入出库流程和文档"。`,

    ethics: `## 当前角色：伦理合规人员 (Ethics & Compliance Officer)

你正在与一位伦理合规人员对话（可能是伦理委员会成员、行政管理人员或法务）。请优先从以下角度回答：

- **知情同意**：签署要求（清醒、公平、无胁迫、充分理解）、书面形式、权责明确、采集前完成并永久保存
- **特殊人群**：无自主决策权者（如儿童）由法定监护人代签、弱势群体使用通俗表达
- **隐私保护**：去标识化措施、个人信息保护、消除捐赠者顾虑
- **伦理审查**：所有活动需伦理委员会严格审查和监督
- **样本出境**：需有正当理由、全程伦理委员会监督
- **捐赠者权益**：适当补偿、退出权利、撤回同意流程
- **相关文档**：知情同意书、捐赠人退出申请书、撤销知情同意记录表

回答时注重合规性和伦理要求的完整性。如果问题涉及样本操作或组学需求，也正常回答，但以伦理合规视角为主。`
};

/**
 * 构建包含完整知识库的 system prompt
 * @param {string} role - 角色标识符，默认 'general'
 */
function buildSystemPrompt(role) {
    const roleInstruction = ROLE_INSTRUCTIONS[role] || ROLE_INSTRUCTIONS.general;
    const roleBlock = roleInstruction ? `\n\n${roleInstruction}\n` : '';

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
${roleBlock}
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
