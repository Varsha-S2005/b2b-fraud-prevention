const express = require('express');
const { connectFabric } = require('./fabric');

const router = express.Router();

// Role definitions - UPDATED: BANK is no longer the central payer
const ROLES = {
    VENDOR: 'VENDOR',
    BUYER: 'BUYER',
    AUDITOR: 'AUDITOR',
    INVESTOR: 'INVESTOR',
    ADMIN: 'ADMIN'
};

// Middleware for role validation remains the same
function validateRole(requiredRole) {
    return (req, res, next) => {
        const { role } = req.body || req.query;
        if (!role) return res.status(400).json({ error: 'Role is required' });
        if (role !== requiredRole) {
            return res.status(403).json({ error: `Access denied. Only ${requiredRole} can perform this action` });
        }
        next();
    };
}

function validateAnyRole(allowedRoles) {
    return (req, res, next) => {
        const { role } = req.body || req.query;
        if (!role) return res.status(400).json({ error: 'Role is required' });
        if (!allowedRoles.includes(role)) {
            return res.status(403).json({ error: `Access denied. Only ${allowedRoles.join(', ')} can perform this action` });
        }
        next();
    };
}

// POST /vendor - Register a new vendor (Admin action)
router.post('/vendor', async (req, res) => {
    let gateway;
    try {
        const { vendorId, name, maxLimit, authorizedWallet, role } = req.body;
        if (!vendorId || !name || !maxLimit || !authorizedWallet) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        const { gateway: g, contract } = await connectFabric(role || ROLES.ADMIN);
        gateway = g;
        const transaction = contract.createTransaction('RegisterVendor');
        await transaction.setEndorsingPeers(['peer0.org1.example.com']);
        await transaction.submit(vendorId, name, maxLimit, authorizedWallet);
        res.json({ success: true, message: 'Vendor registered successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        if (gateway) await gateway.disconnect();
    }
});

// POST /purchaseOrder - Create a new PO (Buyer action)
router.post('/purchaseOrder', validateRole(ROLES.BUYER), async (req, res) => {
    let gateway;
    try {
        const { poId, vendor, buyer, amount, role } = req.body;
        const { gateway: g, contract } = await connectFabric(role);
        gateway = g;
        const transaction = contract.createTransaction('CreatePurchaseOrder');
        await transaction.setEndorsingPeers(['peer0.org1.example.com']);
        await transaction.submit(poId, vendor, buyer, amount);
        res.json({ success: true, message: 'Purchase order created successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        if (gateway) await gateway.disconnect();
    }
});

// POST /invoice - Create a new invoice (Vendor action)
router.post('/invoice', validateRole(ROLES.VENDOR), async (req, res) => {
    let gateway;
    try {
        const { invoiceId, vendor, buyer, amount, purchaseOrderId, deliveryProofHash, role } = req.body;
        const { gateway: g, contract } = await connectFabric(role);
        gateway = g;
        const transaction = contract.createTransaction('CreateInvoice');
        await transaction.setEndorsingPeers(['peer0.org1.example.com']);
        await transaction.submit(invoiceId, vendor, buyer, amount, purchaseOrderId, deliveryProofHash);
        res.json({ success: true, message: 'Invoice created successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        if (gateway) await gateway.disconnect();
    }
});

// POST /verify - Buyer approves the invoice for payment
router.post('/verify', validateRole(ROLES.BUYER), async (req, res) => {
    let gateway;
    try {
        const { invoiceId, role } = req.body;
        const { gateway: g, contract } = await connectFabric(role);
        gateway = g;
        const transaction = contract.createTransaction('VerifyInvoice');
        await transaction.setEndorsingPeers(['peer0.org1.example.com']);
        await transaction.submit(invoiceId);
        res.json({ success: true, message: 'Invoice approved for payment' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        if (gateway) await gateway.disconnect();
    }
});

// POST /pay - UPDATED: Now initiated by BUYER or ADMIN for direct settlement
// This triggers the "Verify Registered Wallet" logic in chaincode
router.post('/pay', validateAnyRole([ROLES.BUYER, ROLES.ADMIN]), async (req, res) => {
    let gateway;
    try {
        const { paymentId, invoiceId, toWallet, role } = req.body;
        
        console.log(`P2P Settlement: Processing payment ${paymentId} for invoice ${invoiceId}`);
        const { gateway: g, contract } = await connectFabric(role);
        gateway = g;

        // Calling ProcessPayment - Chaincode will verify 'toWallet' against the Vendor's registered wallet
        const transaction = contract.createTransaction('ProcessPayment');
        await transaction.setEndorsingPeers(['peer0.org1.example.com']);
        await transaction.submit(paymentId, invoiceId, toWallet);

        res.json({ success: true, message: "Payment processed successfully via P2P" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        if (gateway) await gateway.disconnect();
    }
});

// GET /invoices - View all invoices (Auditors/Investors/Admin)
router.get('/invoices', validateAnyRole([ROLES.AUDITOR, ROLES.INVESTOR, ROLES.ADMIN]), async (req, res) => {
    let gateway;
    try {
        const { role } = req.query;
        const { gateway: g, contract } = await connectFabric(role);
        gateway = g;
        const result = await contract.evaluateTransaction('GetAllInvoices');
        res.json(JSON.parse(result.toString()));
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        if (gateway) await gateway.disconnect();
    }
});

// GET /invoice/:id/history - Audit trail for specific invoice
router.get('/invoice/:id/history', validateAnyRole([ROLES.AUDITOR, ROLES.INVESTOR, ROLES.ADMIN]), async (req, res) => {
    let gateway;
    try {
        const { id } = req.params;
        const { role } = req.query;
        const { gateway: g, contract } = await connectFabric(role);
        gateway = g;
        const result = await contract.evaluateTransaction('GetInvoiceHistory', id);
        res.json(JSON.parse(result.toString()));
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        if (gateway) await gateway.disconnect();
    }
});

module.exports = router;
