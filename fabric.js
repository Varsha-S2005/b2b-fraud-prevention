'use strict';

const { Gateway, Wallets } = require('fabric-network');
const path = require('path');
const fs = require('fs');

async function connectFabric(role) {
    let gateway;

    try {
        // ===================== LOAD CCP =====================
        const ccpPath = path.resolve(__dirname, 'fabric', 'connection-org1.json');

        if (!fs.existsSync(ccpPath)) {
            throw new Error(`❌ Connection profile not found at ${ccpPath}`);
        }

        const ccp = JSON.parse(fs.readFileSync(ccpPath, 'utf8'));

        // ===================== WALLET =====================
        const walletPath = path.join(process.cwd(), 'wallet');

        if (!fs.existsSync(walletPath)) {
            throw new Error('❌ Wallet not found. Run enroll scripts first');
        }

        const wallet = await Wallets.newFileSystemWallet(walletPath);

        const identityName = `${role}User`;

        const identity = await wallet.get(identityName);
        if (!identity) {
            throw new Error(`❌ Identity ${identityName} not found in wallet`);
        }

        console.log(`🔐 Using identity: ${identityName}`);

        // ===================== CONNECT GATEWAY =====================
        gateway = new Gateway();

        await gateway.connect(ccp, {
            wallet,
            identity: identityName,
            discovery: {
                enabled: true,
                asLocalhost: true
            },
            eventHandlerOptions: {
                commitTimeout: 100
            }
        });

        // ===================== NETWORK =====================
        const network = await gateway.getNetwork('mychannel');

        // 🔥 IMPORTANT: change if your chaincode name differs
        const contract = network.getContract('invoice-chaincode');

        return { gateway, contract };

    } catch (error) {
        console.error('❌ Fabric connection failed:', error.message);

        if (gateway) {
            try {
                await gateway.disconnect();
            } catch (e) {}
        }

        throw error;
    }
}

// ===================== SAFE DISCONNECT =====================
async function disconnectFabric(gateway) {
    if (gateway) {
        await gateway.disconnect();
        console.log('🔌 Disconnected from Fabric');
    }
}

module.exports = {
    connectFabric,
    disconnectFabric
};
