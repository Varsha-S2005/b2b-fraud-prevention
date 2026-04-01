'use strict';
const FabricCAServices = require('fabric-ca-client');
const { Wallets } = require('fabric-network');
const fs = require('fs');
const path = require('path');

async function main() {
    try {
        const ccpPath = path.resolve(__dirname, 'fabric', 'connection-org1.json');
        const ccp = JSON.parse(fs.readFileSync(ccpPath, 'utf8'));
        const caInfo = ccp.certificateAuthorities['ca.org1.example.com'];
        
        // Fix: Use the path from the JSON directly to avoid ENOENT
        const tlsCACerts = fs.readFileSync(caInfo.tlsCACerts.path);
        const ca = new FabricCAServices(caInfo.url, { trustedRoots: tlsCACerts, verify: false }, caInfo.caName);

        const walletPath = path.join(process.cwd(), 'wallet');
        if (!fs.existsSync(walletPath)) { fs.mkdirSync(walletPath, { recursive: true }); }
        const wallet = await Wallets.newFileSystemWallet(walletPath);

        const enrollment = await ca.enroll({ enrollmentID: 'admin', enrollmentSecret: 'adminpw' });
        const x509Identity = {
            credentials: { certificate: enrollment.certificate, privateKey: enrollment.key.toBytes() },
            mspId: 'Org1MSP',
            type: 'X.509',
        };

        // Added these so your fabric.js roles work
        await wallet.put('Admin@org1.example.com', x509Identity);
        await wallet.put('VENDORUser', x509Identity);
        await wallet.put('BUYERUser', x509Identity);

        console.log('🎉 Successfully enrolled identities');
    } catch (error) {
        console.error('❌ Failed to enroll:', error);
    }
}
main();
