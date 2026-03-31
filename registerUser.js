/*
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const { Wallets } = require('fabric-network');
const FabricCAServices = require('fabric-ca-client');
const fs = require('fs');
const path = require('path');

async function main() {
    try {
        // 1. Load the network configuration
        const ccpPath = path.resolve(__dirname, 'fabric', 'connection-org1.json');
        const ccp = JSON.parse(fs.readFileSync(ccpPath, 'utf8'));

        // 2. Create a new CA client for interacting with the CA.
        const caURL = ccp.certificateAuthorities['ca.org1.example.com'].url;
        const ca = new FabricCAServices(caURL);

        // 3. Create a new file system based wallet for managing identities.
        const walletPath = path.join(process.cwd(), 'wallet');
        const wallet = await Wallets.newFileSystemWallet(walletPath);
        console.log(`Wallet path: ${walletPath}`);

        // 4. Define the roles to be registered based on your Use Case Diagram
        const rolesToRegister = ['VENDORUser', 'BUYERUser', 'AUDITORUser', 'INVESTORUser', 'ADMINUser'];

        // Check if admin exists to act as the registrar
        const adminIdentity = await wallet.get('admin');
        if (!adminIdentity) {
            console.log('An identity for the admin user "admin" does not exist in the wallet');
            console.log('Run enrollAdmin.js before retrying');
            return;
        }

        // Build a user object for authenticating with the CA
        const provider = wallet.getProviderRegistry().getProvider(adminIdentity.type);
        const adminUser = await provider.getUserContext(adminIdentity, 'admin');

        for (const userId of rolesToRegister) {
            // Check if user already exists
            const userIdentity = await wallet.get(userId);
            if (userIdentity) {
                console.log(`- Identity for "${userId}" already exists in the wallet`);
                continue;
            }

            // 5. Register the user, enroll the user, and import the new identity into the wallet.
            // Note: 'client' affiliation is standard for basic Org1 setups
            const secret = await ca.register({
                affiliation: 'org1.department1',
                enrollmentID: userId,
                role: 'client'
            }, adminUser);

            const enrollment = await ca.enroll({
                enrollmentID: userId,
                enrollmentSecret: secret
            });

            const x509Identity = {
                credentials: {
                    certificate: enrollment.certificate,
                    privateKey: enrollment.key.toBytes(),
                },
                mspId: 'Org1MSP',
                type: 'X.509',
            };

            await wallet.put(userId, x509Identity);
            console.log(`- Successfully registered and enrolled user "${userId}" and imported it into the wallet`);
        }

    } catch (error) {
        console.error(`Failed to register users: ${error}`);
        process.exit(1);
    }
}

main();
