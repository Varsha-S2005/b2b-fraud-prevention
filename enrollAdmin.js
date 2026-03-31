/*
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const FabricCAServices = require('fabric-ca-client');
const { Wallets } = require('fabric-network');
const path = require('path');
const fs = require('fs');

async function main() {
    try {
        // load the network configuration
        const ccpPath = path.resolve(__dirname, 'fabric', 'connection-org1.json');
        const ccp = JSON.parse(fs.readFileSync(ccpPath, 'utf8'));

        // Create a new CA client for interacting with the CA.
        const caInfo = ccp.certificateAuthorities['ca.org1.example.com'];
        const ca = new FabricCAServices(caInfo.url, { trustedRoots: caInfo.tlsCACerts.path, verify: false }, caInfo.caName);

        console.log('🔗 Connecting to Fabric CA Server at:', caInfo.url);

        // Create a new file system based wallet for managing identities.
        const walletPath = path.join(process.cwd(), 'wallet');
        const wallet = await Wallets.newFileSystemWallet(walletPath);
        console.log('📁 Wallet path:', walletPath);

        // Check to see if we've already enrolled the admin user.
        const identity = await wallet.get('Admin@org1.example.com');
        if (identity) {
            console.log('✅ An identity for the admin user "Admin@org1.example.com" already exists in the wallet');
            return;
        }

        // Enroll the admin user, and import the new identity into the wallet.
        const enrollment = await ca.enroll({
            enrollmentID: 'admin',
            enrollmentSecret: 'adminpw'
        });
        console.log('🔐 Successfully enrolled admin user');

        const x509Identity = {
            credentials: {
                certificate: enrollment.certificate,
                privateKey: enrollment.key.toBytes(),
            },
            mspId: 'Org1MSP',
            type: 'X.509',
        };
        console.log('📋 Created X.509 identity structure');

        await wallet.put('Admin@org1.example.com', x509Identity);
        console.log('💾 Successfully enrolled admin user "Admin@org1.example.com" and imported it into the wallet');

    } catch (error) {
        console.error('❌ Failed to enroll admin user:', error);
        process.exit(1);
    }
}

main();
