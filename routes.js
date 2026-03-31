const express = require('express');
const { connectFabric } = require('./fabric');

const router = express.Router();

// Role definitions
const ROLES = {
    VENDOR: 'VENDOR',
    BUYER: 'BUYER',
    BANK: 'BANK',
    AUDITOR: 'AUDITOR',
    INVESTOR: 'INVESTOR',
    ADMIN: 'ADMIN'
};

// Middleware to validate a single role
function validateRole(requiredRole) {
    return (req, res, next) => {
        const { role } = req.body || req.query;

        if (!role) {
            return res.status(400).json({ error: 'Role is required' });
        }

        if (role !== requiredRole) {
            return res.status(403).json({ error: `Access denied. Only ${requiredRole} can perform this action` });
        }

        next();
    };
}

// Middleware to validate any of multiple roles
function validateAnyRole(allowedRoles) {
    return (req, res, next) => {
        const { role } = req.body || req.query;

        if (!role) {
            return res.status(400).json({ error: 'Role is required' });
        }

        if (!allowedRoles.includes(role)) {
            return res.status(403).json({ error: `Access denied. Only ${allowedRoles.join(', ')} can perform this action` });
        }

        next();
    };
}

// POST /vendor - Register a new vendor
router.post('/vendor', async (req, res) => {
    let gateway;
    try {
        const { vendorId, name, maxLimit, authorizedWallet, role } = req.body;
        
        if (!vendorId || !name || !maxLimit || !authorizedWallet) {
            return res.status(400).json({ 
                error: 'Missing required fields: vendorId, name, maxLimit, authorizedWallet' 
            });
        }

        console.log(`Registering vendor ${vendorId} using role: ${role || 'ADMIN'}`);
        const { gateway: g, contract } = await connectFabric(role || 'ADMIN');
        gateway = g;
        
        const transaction = contract.createTransaction('RegisterVendor');
        await transaction.setEndorsingPeers(['peer0.org1.example.com']);
        await transaction.submit(vendorId, name, maxLimit, authorizedWallet);
        console.log(`Vendor ${vendorId} registered successfully`);
        res.json({ success: true, message: 'Vendor registered successfully' });
        
    } catch (error) {
        console.error('POST /vendor error:', error);
        
        // Log detailed peer response if available
        if (error.responses && error.responses.length > 0) {
            console.error('Peer response details:', error.responses[0].response);
            if (error.responses[0].response && error.responses[0].response.message) {
                console.error('Peer response message:', error.responses[0].response.message);
            }
        }
        
        res.status(500).json({ error: error.message });
    } finally {
        if (gateway) {
            await gateway.disconnect();
        }
    }
});

// POST /purchaseOrder - Create a new purchase order
router.post('/purchaseOrder', async (req, res) => {
    let gateway;
    try {
        const { poId, vendor, buyer, amount, role } = req.body;
        
        if (!poId || !vendor || !buyer || !amount) {
            return res.status(400).json({ 
                error: 'Missing required fields: poId, vendor, buyer, amount' 
            });
        }

        console.log(`Creating purchase order ${poId} using role: ${role || 'BUYER'}`);
        const { gateway: g, contract } = await connectFabric(role || 'BUYER');
        gateway = g;
        
        const transaction = contract.createTransaction('CreatePurchaseOrder');
        await transaction.setEndorsingPeers(['peer0.org1.example.com']);
        await transaction.submit(poId, vendor, buyer, amount);
        console.log(`Purchase order ${poId} created successfully`);
        res.json({ success: true, message: 'Purchase order created successfully' });
        
    } catch (error) {
        console.error('POST /purchaseOrder error:', error);
        
        // Log detailed peer response if available
        if (error.responses && error.responses.length > 0) {
            console.error('Peer response details:', error.responses[0].response);
            if (error.responses[0].response && error.responses[0].response.message) {
                console.error('Peer response message:', error.responses[0].response.message);
            }
        }
        
        res.status(500).json({ error: error.message });
    } finally {
        if (gateway) {
            await gateway.disconnect();
        }
    }
});

// POST /invoice - Create a new invoice
router.post('/invoice', validateRole(ROLES.VENDOR), async (req, res) => {
    let gateway;
    try {
        const { invoiceId, vendor, buyer, amount, purchaseOrderId, deliveryProofHash, role } = req.body;
        
        if (!invoiceId || !vendor || !buyer || !amount || !purchaseOrderId || !deliveryProofHash) {
            return res.status(400).json({ 
                error: 'Missing required fields: invoiceId, vendor, buyer, amount, purchaseOrderId, deliveryProofHash' 
            });
        }

        console.log(`Creating invoice ${invoiceId} using role: ${role}`);
        const { gateway: g, contract } = await connectFabric(role);
        gateway = g;
        
        const transaction = contract.createTransaction('CreateInvoice');
        await transaction.setEndorsingPeers(['peer0.org1.example.com']);
        await transaction.submit(invoiceId, vendor, buyer, amount, purchaseOrderId, deliveryProofHash);
        console.log(`Invoice ${invoiceId} created successfully`);
        res.json({ success: true, message: 'Invoice created successfully' });
        
    } catch (error) {
        console.error('POST /invoice error:', error);
        
        // Log detailed peer response if available
        if (error.responses && error.responses.length > 0) {
            console.error('Peer response details:', error.responses[0].response);
            if (error.responses[0].response && error.responses[0].response.message) {
                console.error('Peer response message:', error.responses[0].response.message);
            }
        }
        
        res.status(500).json({ error: error.message });
    } finally {
        if (gateway) {
            await gateway.disconnect();
        }
    }
});

// POST /verify - Verify an invoice (BUYER only)
router.post('/verify', validateRole(ROLES.BUYER), async (req, res) => {
    let gateway;
    try {
        const { invoiceId, role } = req.body;
        
        if (!invoiceId) {
            return res.status(400).json({ error: 'Missing required field: invoiceId' });
        }

        console.log(`Verifying invoice ${invoiceId} using role: ${role}`);
        const { gateway: g, contract } = await connectFabric(role);
        gateway = g;
        
        const transaction = contract.createTransaction('VerifyInvoice');
        await transaction.setEndorsingPeers(['peer0.org1.example.com']);
        await transaction.submit(invoiceId);
        console.log(`Invoice ${invoiceId} verified successfully`);
        res.json({ success: true, message: 'Invoice verified successfully' });
        
    } catch (error) {
        console.error('POST /verify error:', error);
        
        // Log detailed peer response if available
        if (error.responses && error.responses.length > 0) {
            console.error('Peer response details:', error.responses[0].response);
            if (error.responses[0].response && error.responses[0].response.message) {
                console.error('Peer response message:', error.responses[0].response.message);
            }
        }
        
        res.status(500).json({ error: error.message });
    } finally {
        if (gateway) {
            await gateway.disconnect();
        }
    }
});

// POST /finance - Approve financing for an invoice (BANK only)
router.post('/finance', validateRole(ROLES.BANK), async (req, res) => {
    let gateway;
    try {
        const { invoiceId, role } = req.body;
        
        if (!invoiceId) {
            return res.status(400).json({ error: 'Missing required field: invoiceId' });
        }

        console.log(`Approving financing for invoice ${invoiceId} using role: ${role}`);
        const { gateway: g, contract } = await connectFabric(role);
        gateway = g;
        
        const transaction = contract.createTransaction('ApproveFinancing');
        await transaction.setEndorsingPeers(['peer0.org1.example.com']);
        await transaction.submit(invoiceId);
        console.log(`Financing approved for invoice ${invoiceId}`);
        res.json({ success: true, message: 'Financing approved successfully' });
        
    } catch (error) {
        console.error('POST /finance error:', error);
        
        // Log detailed peer response if available
        if (error.responses && error.responses.length > 0) {
            console.error('Peer response details:', error.responses[0].response);
            if (error.responses[0].response && error.responses[0].response.message) {
                console.error('Peer response message:', error.responses[0].response.message);
            }
        }
        
        res.status(500).json({ error: error.message });
    } finally {
        if (gateway) {
            await gateway.disconnect();
        }
    }
});
// Add this to your routes.js
router.post('/pay', validateAnyRole(['BANK', 'ADMIN']), async (req, res) => {
    try {
        const { paymentId, invoiceId, amount, toWallet, role } = req.body;
        
        // Connect to Fabric using the specific role
        const { contract, gateway } = await connectFabric(role);

        console.log(`Processing payment ${paymentId} for invoice ${invoiceId} using role: ${role}`);

        // Call the ProcessPayment function from your Go chaincode
        await contract.submitTransaction('ProcessPayment', paymentId, invoiceId, amount, toWallet);

        await gateway.disconnect();
        res.json({ success: true, message: "Payment processed successfully" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// GET /invoices - Get all invoices (AUDITOR, BANK, INVESTOR only)
router.get('/invoices', validateAnyRole([ROLES.AUDITOR, ROLES.BANK, ROLES.INVESTOR]), async (req, res) => {
    let gateway;
    try {
        const { role } = req.query;
        
        console.log(`Getting all invoices using role: ${role}`);
        const { gateway: g, contract } = await connectFabric(role);
        gateway = g;
        
        const result = await contract.evaluateTransaction('GetAllInvoices');
        const invoices = JSON.parse(result.toString());
        res.json(invoices);
        
    } catch (error) {
        console.error('GET /invoices error:', error);
        
        // Log detailed peer response if available
        if (error.responses && error.responses.length > 0) {
            console.error('Peer response details:', error.responses[0].response);
            if (error.responses[0].response && error.responses[0].response.message) {
                console.error('Peer response message:', error.responses[0].response.message);
            }
        }
        
        res.status(500).json({ error: error.message });
    } finally {
        if (gateway) {
            await gateway.disconnect();
        }
    }
});

// GET /invoice/:id - Get a specific invoice by ID
router.get('/invoice/:id', async (req, res) => {
    let gateway;
    try {
        const { id } = req.params;
        const { role } = req.query;
        
        if (!role) {
            return res.status(400).json({ error: 'Role is required in query parameters' });
        }

        console.log(`Getting invoice ${id} using role: ${role}`);
        const { gateway: g, contract } = await connectFabric(role);
        gateway = g;
        
        const result = await contract.evaluateTransaction('ReadInvoice', id);
        const invoice = JSON.parse(result.toString());
        res.json(invoice);
        
    } catch (error) {
        console.error('GET /invoice/:id error:', error);
        
        // Log detailed peer response if available
        if (error.responses && error.responses.length > 0) {
            console.error('Peer response details:', error.responses[0].response);
            if (error.responses[0].response && error.responses[0].response.message) {
                console.error('Peer response message:', error.responses[0].response.message);
            }
        }
        
        res.status(500).json({ error: error.message });
    } finally {
        if (gateway) {
            await gateway.disconnect();
        }
    }
});

// GET /invoice/:id/history - Get complete transaction history for an invoice (AUDITOR, BANK, INVESTOR only)
router.get('/invoice/:id/history', validateAnyRole([ROLES.AUDITOR, ROLES.BANK, ROLES.INVESTOR]), async (req, res) => {
    let gateway;
    try {
        const { id } = req.params;
        const { role } = req.query;
        
        console.log(`Getting invoice history for ${id} using role: ${role}`);
        const { gateway: g, contract } = await connectFabric(role);
        gateway = g;
        
        const result = await contract.evaluateTransaction('GetInvoiceHistory', id);
        const history = JSON.parse(result.toString());
        res.json(history);
        
    } catch (error) {
        console.error('GET /invoice/:id/history error:', error);
        
        // Log detailed peer response if available
        if (error.responses && error.responses.length > 0) {
            console.error('Peer response details:', error.responses[0].response);
            if (error.responses[0].response && error.responses[0].response.message) {
                console.error('Peer response message:', error.responses[0].response.message);
            }
        }
        
        res.status(500).json({ error: error.message });
    } finally {
        if (gateway) {
            await gateway.disconnect();
        }
    }
});

// GET /invoice/:id/history - Get complete transaction history for an invoice (AUDITOR, BANK, INVESTOR, ADMIN only)
router.get('/invoice/:id/history', validateAnyRole([ROLES.AUDITOR, ROLES.BANK, ROLES.INVESTOR, ROLES.ADMIN]), async (req, res) => {
    let gateway;
    try {
        const { id } = req.params;
        const { role } = req.query; // Ensure the role is passed in the URL: ?role=INVESTOR
        
        console.log(`Getting invoice history for ${id} using role: ${role}`);
        const { gateway: g, contract } = await connectFabric(role);
        gateway = g;
        
        // This calls the GetInvoiceHistory function we talked about in the Go chaincode
        const result = await contract.evaluateTransaction('GetInvoiceHistory', id);
        const history = JSON.parse(result.toString());
        
        res.json(history);
        
    } catch (error) {
        console.error('GET /invoice/:id/history error:', error);
        res.status(500).json({ error: error.message });
    } finally {
        if (gateway) {
            await gateway.disconnect();
        }
    }
});

module.exports = router;