'use strict';

const express = require('express');
const cors = require('cors');
const routes = require('./routes');

const app = express();

// ===================== MIDDLEWARE =====================

// Built-in body parser (no need for body-parser package)
app.use(express.json());

// Enable CORS (for frontend connection)
app.use(cors());

// Simple request logger (helps debugging)
app.use((req, res, next) => {
    console.log(`📡 ${req.method} ${req.url}`);
    next();
});

// ===================== ROUTES =====================
app.use('/api', routes);

// ===================== HEALTH CHECK =====================
app.get('/', (req, res) => {
    res.send('🚀 Fabric Backend is running');
});

// ===================== ERROR HANDLER =====================
app.use((err, req, res, next) => {
    console.error('❌ Unhandled Error:', err);

    res.status(500).json({
        success: false,
        error: 'Internal Server Error'
    });
});

// ===================== START SERVER =====================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`🔥 Server running on http://localhost:${PORT}`);
});
