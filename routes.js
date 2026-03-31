const express = require('express');
const router = express.Router();
const { connectFabric } = require('./fabric');

// 4. Misreporting Prevention (Immutable Transparency)
router.get('/invoice/:id', async (req, res) => {
    try {
        const { gateway, contract } = await connectFabric('AUDITOR');
        const result = await contract.evaluateTransaction('QueryInvoice', req.params.id);
        await gateway.disconnect();
        res.json(JSON.parse(result.toString()));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Process P2P Payment
router.post('/pay', async (req, res) => {
    try {
        const { invoiceId, toWallet, role } = req.body;
        if (role !== 'BUYER') return res.status(403).send("Only Buyers can pay.");

        const { gateway, contract } = await connectFabric('BUYER');
        await contract.submitTransaction('ProcessPayment', invoiceId, toWallet);
        await gateway.disconnect();
        res.json({ success: true, message: "Payment successful, status locked to PAID." });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

module.exports = router;
