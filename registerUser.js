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
        const ca = new FabricCAServices(caInfo.url, { trustedRoots: caInfo.caName, verify: false }, caInfo.caName);

        console.log('🔗 Connecting to Fabric CA Server at:', caInfo.url);

        // Create a new file system based wallet for managing identities.
        const walletPath = path.join(process.cwd(), 'wallet');
        const wallet = await Wallets.newFileSystemWallet(walletPath);
        console.log('📁 Wallet path:', walletPath);

        // Check to see if we've already enrolled the admin user.
        const adminIdentity = await wallet.get('Admin@org1.example.com');
        if (!adminIdentity) {
            console.log('❌ An identity for the admin user "Admin@org1.example.com" does not exist in the wallet');
            console.log('💡 Run the enrollAdmin.js application first');
            return;
        }
        console.log('✅ Admin identity found in wallet');

        // build a user object for authenticating with the CA
        const provider = wallet.getProviderRegistry().getProvider(adminIdentity.type);
        const adminUser = await provider.getUserContext(adminIdentity, 'admin');
        console.log('👤 Admin user context created');

        // Register the user, enroll the user, and import the new identity into the wallet.
        const userId = 'appUser';
        const userSecret = await ca.register({
            affiliation: 'org1.department1',
            enrollmentID: userId,
            role: 'client',
            attrs: [
                { name: 'role', value: 'USER', ecert: true }
            ]
        }, adminUser);
        console.log('📝 Successfully registered user:', userId);

        const enrollment = await ca.enroll({
            enrollmentID: userId,
            enrollmentSecret: userSecret
        });
        console.log('🔐 Successfully enrolled user:', userId);

        const x509Identity = {
            credentials: {
                certificate: enrollment.certificate,
                privateKey: enrollment.key.toBytes(),
            },
            mspId: 'Org1MSP',
            type: 'X.509',
        };
        console.log('📋 Created X.509 identity structure for user:', userId);

        await wallet.put(userId, x509Identity);
        console.log('💾 Successfully enrolled and imported user:', userId, 'into the wallet');

        // Also create role-based identities for testing
        const roles = ['VENDOR', 'BUYER', 'BANK', 'AUDITOR', 'INVESTOR', 'ADMIN'];
        
        for (const role of roles) {
            const roleId = `${role}User`;
            const roleSecret = await ca.register({
                affiliation: 'org1.department1',
                enrollmentID: roleId,
                role: 'client',
                attrs: [
                    { name: 'role', value: role, ecert: true }
                ]
            }, adminUser);
            console.log(`📝 Successfully registered ${role} user:`, roleId);

            const roleEnrollment = await ca.enroll({
                enrollmentID: roleId,
                enrollmentSecret: roleSecret
            });
            console.log(`🔐 Successfully enrolled ${role} user:`, roleId);

            const roleX509Identity = {
                credentials: {
                    certificate: roleEnrollment.certificate,
                    privateKey: roleEnrollment.key.toBytes(),
                },
                mspId: 'Org1MSP',
                type: 'X.509',
            };

            await wallet.put(roleId, roleX509Identity);
            console.log(`💾 Successfully enrolled and imported ${role} user:`, roleId, 'into the wallet');
        }

    } catch (error) {
        console.error('❌ Failed to register user:', error);
        process.exit(1);
    }
}

main();
