const { Gateway, Wallets } = require('fabric-network');
const path = require('path');
const fs = require('fs');

async function connectFabric(role = 'VENDOR') {
    let gateway;
    try {
        // Load the network configuration
        const connectionProfilePath = path.resolve(__dirname, 'fabric', 'connection-org1.json');
        const connectionProfile = JSON.parse(fs.readFileSync(connectionProfilePath, 'utf8'));

        // Create a new file system based wallet for managing identities.
        const walletPath = path.join(process.cwd(), 'wallet');
        const wallet = await Wallets.newFileSystemWallet(walletPath);
        console.log(`📁 Wallet path: ${walletPath}`);

        // Role mapping: API role -> Wallet identity name
        const roleToIdentityMap = {
            'VENDOR': 'VENDORUser',
            'BUYER': 'BUYERUser', 
            'BANK': 'BANKUser',
            'AUDITOR': 'AUDITORUser',
            'INVESTOR': 'INVESTORUser',
            'ADMIN': 'ADMINUser',
            'admin': 'Admin@org1.example.com', // Fallback for bootstrap admin
            'ADMIN@org1.example.com': 'Admin@org1.example.com' // Full admin identity
        };

        // Determine the identity name to use
        let identityName = roleToIdentityMap[role] || roleToIdentityMap['admin'];
        
        // If no specific mapping found, try the role directly (e.g., 'VENDORUser')
        if (!identityName && role) {
            identityName = role;
        }

        console.log(`🔍 Looking for identity: ${identityName} for role: ${role}`);

        // Identity lookup using fabric-network SDK
        const identity = await wallet.get(identityName);
        
        if (!identity) {
            // List available identities for debugging
            const availableIdentities = await wallet.list();
            console.log(`❌ Identity '${identityName}' not found in wallet.`);
            console.log(`📋 Available identities in wallet:`, Array.from(availableIdentities.keys()));
            throw new Error(`Identity '${identityName}' not found in wallet. Please run registerUser.js`);
        }

        console.log(`✅ Found identity: ${identityName}`);

        // Create a new gateway for connecting to our peer node.
        gateway = new Gateway();
        
        // Connect to the gateway using the identity and discovery service
        await gateway.connect(connectionProfile, {
            wallet,
            identity: identityName,
            discovery: { 
                enabled: true, 
                asLocalhost: true  // Network in Docker, API on host machine
            }
        });

        // Get the network (channel) our contract is deployed to.
        const network = await gateway.getNetwork('mychannel');

        // Get the contract from the network.
        const contract = network.getContract('basic');

        console.log(`🌐 Connected to Fabric network using identity: ${identityName}`);

        return { gateway, contract, identity: identityName };

    } catch (error) {
        console.error('❌ Failed to connect to Fabric network:', error);
        
        // Enhanced error logging
        if (error.responses) {
            console.error('🔍 Peer responses:', JSON.stringify(error.responses, null, 2));
        }
        
        if (error.message && error.message.includes('not found in wallet')) {
            console.error('💡 Solution: Run node registerUser.js to create the required identities');
        }

        // Clean up gateway connection if it was created
        if (gateway) {
            try {
                await gateway.disconnect();
                console.log('🔌 Gateway connection closed');
            } catch (disconnectError) {
                console.error('⚠️ Error closing gateway:', disconnectError);
            }
        }
        
        throw error;
    }
}

module.exports = { connectFabric };