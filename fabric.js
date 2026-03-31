const { Gateway, Wallets } = require('fabric-network');
const path = require('path');
const fs = require('fs');

async function connectFabric(role = 'VENDOR') {
    let gateway = new Gateway(); // Initialize early for easier cleanup
    try {
        const connectionProfilePath = path.resolve(__dirname, 'fabric', 'connection-org1.json');
        const connectionProfile = JSON.parse(fs.readFileSync(connectionProfilePath, 'utf8'));

        const walletPath = path.join(process.cwd(), 'wallet');
        const wallet = await Wallets.newFileSystemWallet(walletPath);

        // Updated mapping to support P2P roles
        const roleToIdentityMap = {
            'VENDOR': 'VENDORUser',
            'BUYER': 'BUYERUser', 
            'AUDITOR': 'AUDITORUser',
            'INVESTOR': 'INVESTORUser',
            'ADMIN': 'ADMINUser',
            'admin': 'Admin@org1.example.com'
        };

        let identityName = roleToIdentityMap[role] || role; // Try map, then fallback to literal
        const identity = await wallet.get(identityName);
        
        if (!identity) {
            const availableIdentities = await wallet.list();
            console.error(`❌ Identity '${identityName}' not found.`);
            console.log(`📋 Wallet contains:`, Array.from(availableIdentities.keys()));
            throw new Error(`Run registerUser.js to create '${identityName}'`);
        }

        await gateway.connect(connectionProfile, {
            wallet,
            identity: identityName,
            discovery: { enabled: true, asLocalhost: true }
        });

        const network = await gateway.getNetwork('mychannel');
        
        // CRITICAL: Ensure this matches your peer chaincode list output
        const contract = network.getContract('basic'); 

        console.log(`🌐 Connected as: ${identityName}`);
        return { gateway, contract, identity: identityName };

    } catch (error) {
        console.error('❌ Connection Failed:', error.message);
        if (gateway) await gateway.disconnect();
        throw error;
    }
}

module.exports = { connectFabric };
