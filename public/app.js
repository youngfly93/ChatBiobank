// 应用状态管理
const appState = {
    conversationId: null,
    messages: [],
    currentUser: 'user-' + Date.now()
};

// DOM 元素
const elements = {
    welcomeSection: document.getElementById('welcomeSection'),
    chatContainer: document.getElementById('chatContainer'),
    messages: document.getElementById('messages'),
    messageInput: document.getElementById('messageInput'),
    sendBtn: document.getElementById('sendBtn'),
    chatForm: document.getElementById('chatForm'),
    attachBtn: document.getElementById('attachBtn'),
    fileInput: document.getElementById('fileInput'),
    newChatBtn: document.getElementById('newChatBtn'),
    featureButtons: document.querySelectorAll('.feature-btn'),
    sidebar: document.getElementById('sidebar'),
    chatHistory: document.getElementById('chatHistory'),
    mobileMenuBtn: document.getElementById('mobileMenuBtn'),
    mobileOverlay: document.getElementById('mobileOverlay')
};

// 自动调整文本框高度
function autoResizeTextarea() {
    elements.messageInput.style.height = 'auto';
    elements.messageInput.style.height = elements.messageInput.scrollHeight + 'px';
}

// 显示/隐藏欢迎界面
function toggleWelcomeSection(show) {
    const mainContent = elements.welcomeSection.parentElement;
    
    if (show) {
        elements.welcomeSection.style.display = 'flex';
        elements.chatContainer.style.display = 'none';
        // 移除聊天模式类
        mainContent.classList.remove('chat-mode');
    } else {
        elements.welcomeSection.style.display = 'none';
        elements.chatContainer.style.display = 'block';
        // 添加聊天模式类
        mainContent.classList.add('chat-mode');
    }
}

// 添加消息到聊天界面
function addMessage(role, content, messageId = null) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}`;
    
    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.textContent = role === 'user' ? '👤' : '🤖';
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    
    const textDiv = document.createElement('div');
    textDiv.className = 'message-text';
    textDiv.textContent = content;
    
    contentDiv.appendChild(textDiv);
    messageDiv.appendChild(avatar);
    messageDiv.appendChild(contentDiv);
    
    if (messageId) {
        messageDiv.dataset.messageId = messageId;
    }
    
    elements.messages.appendChild(messageDiv);
    elements.chatContainer.scrollTop = elements.chatContainer.scrollHeight;
    
    return { messageDiv, textDiv };
}

// 显示加载动画
function showTypingIndicator() {
    const typingDiv = document.createElement('div');
    typingDiv.className = 'message assistant typing';
    typingDiv.innerHTML = `
        <div class="message-avatar">🤖</div>
        <div class="message-content">
            <div class="typing-indicator">
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
            </div>
        </div>
    `;
    elements.messages.appendChild(typingDiv);
    elements.chatContainer.scrollTop = elements.chatContainer.scrollHeight;
    return typingDiv;
}

// 发送消息到后端
async function sendMessage(message, fileData = null) {
    try {
        // 隐藏欢迎界面
        toggleWelcomeSection(false);
        
        // 添加用户消息到界面
        addMessage('user', message);
        
        // 显示加载动画
        const typingIndicator = showTypingIndicator();
        
        // 准备请求数据
        const requestData = {
            query: message,
            user: appState.currentUser,
            conversation_id: appState.conversationId,
            response_mode: 'streaming'
        };
        
        // 如果有文件，添加文件信息
        if (fileData) {
            requestData.files = [{
                type: 'image',
                transfer_method: 'remote_url',
                url: fileData.url
            }];
        }
        
        // 发送请求到后端
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestData)
        });
        
        // 移除加载动画
        typingIndicator.remove();
        
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        
        // 处理流式响应
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let assistantMessage = '';
        let messageElements = null;
        
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');
            
            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    try {
                        const data = JSON.parse(line.slice(6));
                        
                        if (data.event === 'message') {
                            assistantMessage += data.answer;
                            
                            if (!messageElements) {
                                messageElements = addMessage('assistant', assistantMessage, data.message_id);
                            } else {
                                messageElements.textDiv.textContent = assistantMessage;
                            }
                            
                            // 保存会话ID
                            if (data.conversation_id && !appState.conversationId) {
                                appState.conversationId = data.conversation_id;
                            }
                        } else if (data.event === 'message_end') {
                            // 消息结束，可以在这里处理元数据等
                            console.log('Message completed:', data);
                        }
                    } catch (e) {
                        console.error('Error parsing SSE data:', e);
                    }
                }
            }
        }
        
        // 添加到消息历史
        appState.messages.push({ role: 'user', content: message });
        appState.messages.push({ role: 'assistant', content: assistantMessage });
        
        // 如果是新对话，添加到侧边栏历史
        if (appState.conversationId && appState.messages.length === 2) { // 第一次对话（一个用户消息+一个助手回复）
            const title = message.length > 30 ? message.substring(0, 30) + '...' : message;
            addChatToHistory(appState.conversationId, title);
        }
        
    } catch (error) {
        console.error('Error sending message:', error);
        const typingIndicator = document.querySelector('.typing');
        if (typingIndicator) {
            typingIndicator.remove();
        }
        addMessage('assistant', '抱歉，发送消息时出现错误。请稍后再试。');
    }
}

// 处理文件上传
async function handleFileUpload(file) {
    try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('user', appState.currentUser);
        
        const response = await fetch('/api/files/upload', {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            throw new Error('File upload failed');
        }
        
        const fileData = await response.json();
        return fileData;
    } catch (error) {
        console.error('Error uploading file:', error);
        alert('文件上传失败，请重试。');
        return null;
    }
}

// 移动端侧边栏开关
function toggleMobileSidebar() {
    elements.sidebar.classList.toggle('mobile-open');
    
    if (elements.sidebar.classList.contains('mobile-open')) {
        document.body.style.overflow = 'hidden';
        elements.mobileOverlay.style.display = 'block';
    } else {
        document.body.style.overflow = '';
        elements.mobileOverlay.style.display = 'none';
    }
}

// 关闭移动端侧边栏
function closeMobileSidebar() {
    if (elements.sidebar) {
        elements.sidebar.classList.remove('mobile-open');
        document.body.style.overflow = '';
        if (elements.mobileOverlay) {
            elements.mobileOverlay.style.display = 'none';
        }
    }
}

// 使函数全局可访问
window.closeMobileSidebar = closeMobileSidebar;

// 添加聊天历史到侧边栏
function addChatToHistory(conversationId, title, time = '刚刚') {
    const historyItem = document.createElement('div');
    historyItem.className = 'history-item';
    historyItem.dataset.conversation = conversationId;
    
    historyItem.innerHTML = `
        <div class="history-icon">
            <i class="fas fa-message"></i>
        </div>
        <div class="history-content">
            <div class="history-title">${title}</div>
            <div class="history-time">${time}</div>
        </div>
        <div class="history-actions">
            <button class="action-btn edit-btn" onclick="editChatTitle('${conversationId}')">
                <i class="fas fa-edit"></i>
            </button>
            <button class="action-btn delete-btn" onclick="deleteChatHistory('${conversationId}')">
                <i class="fas fa-trash"></i>
            </button>
        </div>
    `;
    
    // 移除其他激活状态
    elements.chatHistory.querySelectorAll('.history-item').forEach(item => {
        item.classList.remove('active');
    });
    
    // 添加到历史列表顶部
    elements.chatHistory.insertBefore(historyItem, elements.chatHistory.firstChild);
    historyItem.classList.add('active');
    
    // 添加点击事件
    historyItem.addEventListener('click', (e) => {
        e.preventDefault();
        loadChatHistory(conversationId);
    });
}

// 编辑聊天标题
function editChatTitle(conversationId) {
    const historyItem = elements.chatHistory.querySelector(`[data-conversation="${conversationId}"]`);
    const titleElement = historyItem.querySelector('.history-title');
    const currentTitle = titleElement.textContent;
    
    const newTitle = prompt('编辑对话标题:', currentTitle);
    if (newTitle && newTitle !== currentTitle) {
        titleElement.textContent = newTitle;
        // 这里可以调用API更新标题
    }
}

// 删除聊天历史
function deleteChatHistory(conversationId) {
    if (confirm('确定要删除这个对话吗？')) {
        const historyItem = elements.chatHistory.querySelector(`[data-conversation="${conversationId}"]`);
        if (historyItem) {
            historyItem.remove();
            
            // 如果删除的是当前对话，开始新对话
            if (appState.conversationId === conversationId) {
                startNewChat();
            }
        }
        
        // 这里可以调用API删除对话
    }
}

// 加载聊天历史
function loadChatHistory(conversationId) {
    // 移除其他激活状态
    elements.chatHistory.querySelectorAll('.history-item').forEach(item => {
        item.classList.remove('active');
    });
    
    // 激活当前项
    const historyItem = elements.chatHistory.querySelector(`[data-conversation="${conversationId}"]`);
    if (historyItem) {
        historyItem.classList.add('active');
    }
    
    appState.conversationId = conversationId;
    
    // 这里可以调用API加载历史消息
    // 暂时清空消息列表
    elements.messages.innerHTML = '';
    toggleWelcomeSection(false);
    
    console.log('Loading chat history for:', conversationId);
}

// 开始新对话
function startNewChat() {
    appState.conversationId = null;
    appState.messages = [];
    elements.messages.innerHTML = '';
    toggleWelcomeSection(true);
    elements.messageInput.value = '';
    autoResizeTextarea();
    
    // 移除所有历史项的激活状态
    elements.chatHistory.querySelectorAll('.history-item').forEach(item => {
        item.classList.remove('active');
    });
}

// 初始化事件监听器
function initializeEventListeners() {
    // 监听文本框输入
    elements.messageInput.addEventListener('input', autoResizeTextarea);
    
    // 监听表单提交
    elements.chatForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const message = elements.messageInput.value.trim();
        if (!message) return;
        
        // 禁用发送按钮
        elements.sendBtn.disabled = true;
        elements.messageInput.value = '';
        autoResizeTextarea();
        
        // 发送消息
        await sendMessage(message);
        
        // 重新启用发送按钮
        elements.sendBtn.disabled = false;
        elements.messageInput.focus();
    });
    
    // 监听回车键
    elements.messageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            elements.chatForm.dispatchEvent(new Event('submit'));
        }
    });
    
    // 监听附件按钮
    elements.attachBtn.addEventListener('click', () => {
        elements.fileInput.click();
    });
    
    // 监听文件选择
    elements.fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        // 检查文件类型
        if (!file.type.startsWith('image/')) {
            alert('目前只支持图片文件');
            return;
        }
        
        // 上传文件
        const fileData = await handleFileUpload(file);
        if (fileData) {
            // 可以在输入框显示文件名或直接发送
            const message = elements.messageInput.value || '请分析这张图片';
            await sendMessage(message, fileData);
        }
        
        // 清空文件输入
        e.target.value = '';
    });
    
    // 监听新对话按钮
    elements.newChatBtn.addEventListener('click', (e) => {
        e.preventDefault();
        startNewChat();
        closeMobileSidebar();
    });
    
    // 监听移动端菜单按钮
    if (elements.mobileMenuBtn) {
        elements.mobileMenuBtn.addEventListener('click', toggleMobileSidebar);
    }
    
    // 监听移动端遮罩层点击
    if (elements.mobileOverlay) {
        elements.mobileOverlay.addEventListener('click', closeMobileSidebar);
    }
    
    // 监听功能按钮
    elements.featureButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const feature = btn.querySelector('span').textContent;
            let prompt = '';
            
            switch (feature) {
                case 'Write':
                    prompt = '帮我写一篇';
                    break;
                case 'Learn':
                    prompt = '教我学习';
                    break;
                case 'Code':
                    prompt = '帮我编写代码';
                    break;
                case 'Life stuff':
                    prompt = '给我一些生活建议';
                    break;
            }
            
            elements.messageInput.value = prompt;
            elements.messageInput.focus();
            autoResizeTextarea();
        });
    });
}

// 初始化应用
function initializeApp() {
    initializeEventListeners();
    autoResizeTextarea();
    elements.messageInput.focus();
    
    // 监听ESC键关闭移动端侧边栏
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeMobileSidebar();
        }
    });
}

// 启动应用
document.addEventListener('DOMContentLoaded', initializeApp);