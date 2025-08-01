const express = require('express');
const path = require('path');

const app = express();

// 静态文件服务
app.use(express.static('public'));

// 根路径路由 - 服务index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 所有其他路径也重定向到index.html (SPA支持)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

module.exports = app;