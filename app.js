/*
 * SPDX-License-Identifier: Apache-2.0
 * B2B Invoice Fraud Prevention System - Main Server
 */

'use strict';

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const invoiceRoutes = require('./routes');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve static frontend files if you have a 'public' folder
app.use(express.static(path.join(__dirname, 'public')));

// Logging Middleware for Blockchain Transactions
app.use((req, res, next) => {
    if (req.method === 'POST') {
        console.log(`[${new Date().toISOString()}] Transaction Attempt: ${req.path} by Role: ${req.body.role || 'Unknown'}`);
    }
    next();
});

// API Routes
app.use('/api', invoiceRoutes);

// Health Check Endpoint
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'UP', network: 'Hyperledger Fabric', channel: 'mychannel' });
});

// Global Error Handler
app.use((err, req, res, next) => {
    console.error('Unhandled Server Error:', err.stack);
    res.status(500).json({
        error: 'Internal Server Error',
        message: err.message
    });
});

// Start the server
app.listen(PORT, () => {
    console.log(`
    🚀 B2B Fraud Prevention Server Running
    --------------------------------------
    Local URL: http://localhost:${PORT}
    Network:   Hyperledger Fabric v2.x
    Status:    Awaiting P2P Settlements...
    --------------------------------------
    `);
});
