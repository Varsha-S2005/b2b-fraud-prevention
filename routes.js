'use strict';

const express = require('express');
const router = express.Router();
const { connectFabric, disconnectFabric } = require('./fabric');

// ===================== HELPER =====================
function validate(fields, body) {
    for (const field of fields) {
        if (!body[field]) {
            return `${field} is required`;
        }
    }
    return null;
}

// ===================== REGISTER VENDOR =====================
router.post('/register-vendor', async (req, res) => {
    let gateway;

    try {
        const error = validate(['id', 'name', 'wallet'], req.body);
        if (error) return res.status(400).json({ error });

        const { id, name, wallet } = req.body;

        const result = await connectFabric('VENDOR');
        gateway = result.gateway;
        const contract = result.contract;

        await contract.submitTransaction('RegisterVendor', id, name, wallet);

        res.json({
            success: true,
            message: '✅ Vendor registered successfully'
        });

    } catch (e) {
        res.status(500).json({ error: e.message });
    } finally {
        await disconnectFabric(gateway);
    }
});

// ===================== UPLOAD INVOICE =====================
router.post('/upload-invoice', async (req, res) => {
    let gateway;

    try {
        const error = validate(['id', 'vendorId', 'amount', 'poId'], req.body);
        if (error) return res.status(400).json({ error });

        const { id, vendorId, amount, poId } = req.body;

        const result = await connectFabric('VENDOR');
        gateway = result.gateway;
        const contract = result.contract;

        await contract.submitTransaction(
            'UploadInvoice',
            id,
            vendorId,
            amount.toString(),
            poId
        );

        res.json({
            success: true,
            message: '📄 Invoice uploaded (Pending)'
        });

    } catch (e) {
        res.status(400).json({ error: e.message });
    } finally {
        await disconnectFabric(gateway);
    }
});

// ===================== VERIFY INVOICE (3-WAY MATCH) =====================
router.post('/verify-invoice', async (req, res) => {
    let gateway;

    try {
        const error = validate(['invoiceId'], req.body);
        if (error) return res.status(400).json({ error });

        const { invoiceId } = req.body;

        const result = await connectFabric('BUYER');
        gateway = result.gateway;
        const contract = result.contract;

        await contract.submitTransaction('VerifyInvoice', invoiceId);

        res.json({
            success: true,
            message: '✅ Invoice verified (3-way match passed)'
        });

    } catch (e) {
        res.status(400).json({ error: e.message });
    } finally {
        await disconnectFabric(gateway);
    }
});

// ===================== PROCESS PAYMENT =====================
router.post('/pay', async (req, res) => {
    let gateway;

    try {
        const error = validate(['invoiceId', 'toWallet'], req.body);
        if (error) return res.status(400).json({ error });

        const { invoiceId, toWallet } = req.body;

        const result = await connectFabric('BUYER');
        gateway = result.gateway;
        const contract = result.contract;

        await contract.submitTransaction(
            'ProcessPayment',
            invoiceId,
            toWallet
        );

        res.json({
            success: true,
            message: '💰 Payment processed securely (Fraud checks passed)'
        });

    } catch (e) {
        res.status(400).json({ error: e.message });
    } finally {
        await disconnectFabric(gateway);
    }
});

// ===================== QUERY INVOICE (AUDITOR) =====================
router.get('/invoice/:id', async (req, res) => {
    let gateway;

    try {
        const invoiceId = req.params.id;

        const result = await connectFabric('AUDITOR');
        gateway = result.gateway;
        const contract = result.contract;

        const response = await contract.evaluateTransaction('QueryInvoice', invoiceId);

        res.json({
            success: true,
            data: JSON.parse(response.toString())
        });

    } catch (e) {
        res.status(404).json({ error: e.message });
    } finally {
        await disconnectFabric(gateway);
    }
});

module.exports = router;
