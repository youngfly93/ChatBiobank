const crypto = require('crypto');

// 内存会话存储
const conversations = new Map();

function generateId() {
    return crypto.randomUUID();
}

/**
 * 创建新会话
 */
function createConversation(user, name) {
    const id = generateId();
    const now = Math.floor(Date.now() / 1000);
    const conversation = {
        id,
        name: name || '新对话',
        user,
        created_at: now,
        updated_at: now,
        messages: [] // { role, content } 数组
    };
    conversations.set(id, conversation);
    return conversation;
}

/**
 * 获取单个会话
 */
function getConversation(id) {
    return conversations.get(id) || null;
}

/**
 * 列出用户的会话（兼容前端期望的 Dify 格式）
 */
function listConversations(user, limit = 20) {
    const userConversations = [];
    for (const conv of conversations.values()) {
        if (conv.user === user) {
            userConversations.push(conv);
        }
    }
    // 按更新时间倒序
    userConversations.sort((a, b) => b.updated_at - a.updated_at);

    return {
        data: userConversations.slice(0, limit).map(c => ({
            id: c.id,
            name: c.name,
            created_at: c.created_at,
            updated_at: c.updated_at
        }))
    };
}

/**
 * 添加消息到会话
 */
function addMessage(conversationId, role, content) {
    const conv = conversations.get(conversationId);
    if (!conv) return null;

    const msg = {
        id: generateId(),
        role,
        content,
        created_at: Math.floor(Date.now() / 1000)
    };
    conv.messages.push(msg);
    conv.updated_at = msg.created_at;

    // 如果是第一条用户消息，用它更新会话名称
    if (role === 'user' && conv.messages.filter(m => m.role === 'user').length === 1) {
        conv.name = content.length > 30 ? content.substring(0, 30) + '...' : content;
    }

    return msg;
}

/**
 * 获取会话消息（兼容前端期望的 Dify 格式）
 * Dify 返回 { data: [{ id, query, answer }] }，每对 user+assistant 合并为一条
 */
function getMessages(conversationId, limit = 20) {
    const conv = conversations.get(conversationId);
    if (!conv) return null;

    const pairs = [];
    const msgs = conv.messages;

    for (let i = 0; i < msgs.length; i++) {
        if (msgs[i].role === 'user') {
            const pair = {
                id: msgs[i].id,
                query: msgs[i].content,
                answer: ''
            };
            // 找到紧跟其后的 assistant 消息
            if (i + 1 < msgs.length && msgs[i + 1].role === 'assistant') {
                pair.answer = msgs[i + 1].content;
                i++; // 跳过 assistant 消息
            }
            pairs.push(pair);
        }
    }

    return {
        data: pairs.slice(-limit)
    };
}

/**
 * 获取会话的 OpenAI 格式消息历史（用于发送给 Kimi API）
 */
function getChatHistory(conversationId) {
    const conv = conversations.get(conversationId);
    if (!conv) return [];
    return conv.messages.map(m => ({ role: m.role, content: m.content }));
}

/**
 * 删除会话
 */
function deleteConversation(id) {
    return conversations.delete(id);
}

module.exports = {
    createConversation,
    getConversation,
    listConversations,
    addMessage,
    getMessages,
    getChatHistory,
    deleteConversation,
    generateId
};
