const express = require('express');
const path = require('path');

const app = express();

app.use(express.static('public'));

// SPA fallback - but don't catch /3m/* (those are static files)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

module.exports = app;
