'use strict';

const { Wallets } = require('fabric-network');
const FabricCAServices = require('fabric-ca-client');
const fs = require('fs');
const path = require('path');

async function main() {
    try {
        // ===================== LOAD CCP =====================
        const ccpPath = path.resolve(__dirname, 'fabric', 'connection-org1.json');

        if (!fs.existsSync(ccpPath)) {
            throw new Error(`❌ Connection profile not found at ${ccpPath}`);
        }

        const ccp = JSON.parse(fs.readFileSync(ccpPath, 'utf8'));

        // ===================== CA SETUP =====================
        const caInfo = ccp.certificateAuthorities['ca.org1.example.com'];
        if (!caInfo) {
            throw new Error('❌ CA info missing in CCP');
        }

        const tlsCACerts = caInfo.tlsCACerts?.path
            ? fs.readFileSync(caInfo.tlsCACerts.path)
            : null;

        const ca = new FabricCAServices(
            caInfo.url,
            {
                trustedRoots: tlsCACerts,
                verify: false,
            },
            caInfo.caName
        );

        // ===================== WALLET =====================
        const walletPath = path.join(process.cwd(), 'wallet');

        if (!fs.existsSync(walletPath)) {
            fs.mkdirSync(walletPath, { recursive: true });
        }

        const wallet = await Wallets.newFileSystemWallet(walletPath);

        console.log(`📁 Wallet path: ${walletPath}`);

        // ===================== ADMIN CHECK =====================
        const adminIdentity = await wallet.get('Admin@org1.example.com');

        if (!adminIdentity) {
            throw new Error('❌ Admin identity not found. Run enrollAdmin.js first');
        }

        const provider = wallet.getProviderRegistry().getProvider(adminIdentity.type);
        const adminUser = await provider.getUserContext(adminIdentity, 'admin');

        // ===================== ROLES =====================
        const roles = ['VENDOR', 'BUYER', 'AUDITOR'];

        for (const role of roles) {
            const userId = `${role}User`;

            try {
                // 🔹 Skip if already exists
                const userExists = await wallet.get(userId);
                if (userExists) {
                    console.log(`⚠️ ${userId} already exists, skipping...`);
                    continue;
                }

                // ===================== REGISTER =====================
                const secret = await ca.register({
                    affiliation: 'org1.department1',
                    enrollmentID: userId,
                    role: 'client',
                    attrs: [
                        {
                            name: 'role',
                            value: role,
                            ecert: true
                        }
                    ]
                }, adminUser);

                // ===================== ENROLL =====================
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

                // ===================== STORE =====================
                await wallet.put(userId, x509Identity);

                console.log(`✅ Successfully registered and enrolled ${userId}`);

            } catch (err) {
                console.error(`❌ Failed for ${role}:`, err.message);
            }
        }

        console.log('🎉 All roles processed successfully');

    } catch (error) {
        console.error('❌ Error in registration script:', error);
        process.exit(1);
    }
}

main();
