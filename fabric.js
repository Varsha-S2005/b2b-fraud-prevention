'use strict';
const { Gateway, Wallets } = require('fabric-network');
const path = require('path');
const fs = require('fs');

async function connectFabric(role) {
    let gateway;
    try {
        const ccpPath = path.resolve(__dirname, 'fabric', 'connection-org1.json');
        const ccp = JSON.parse(fs.readFileSync(ccpPath, 'utf8'));
        const walletPath = path.join(process.cwd(), 'wallet');
        const wallet = await Wallets.newFileSystemWallet(walletPath);

        const identityName = `${role}User`;
        const identity = await wallet.get(identityName);
        if (!identity) { throw new Error(`❌ Identity ${identityName} not found`); }

        gateway = new Gateway();
        await gateway.connect(ccp, {
            wallet,
            identity: identityName,
            discovery: { enabled: true, asLocalhost: true }
        });

        const network = await gateway.getNetwork('mychannel');
        // Fix: Chaincode name alignment
        const contract = network.getContract('b2b-fraud');

        return { gateway, contract };
    } catch (error) {
        if (gateway) { await gateway.disconnect(); }
        throw error;
    }
}

async function disconnectFabric(gateway) {
    if (gateway) { await gateway.disconnect(); }
}

module.exports = { connectFabric, disconnectFabric };
