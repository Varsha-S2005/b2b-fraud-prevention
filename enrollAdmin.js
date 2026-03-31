'use strict';

const FabricCAServices = require('fabric-ca-client');
const { Wallets } = require('fabric-network');
const fs = require('fs');
const path = require('path');

async function main() {
    try {
        // ===================== LOAD CONNECTION PROFILE =====================
        const ccpPath = path.resolve(__dirname, 'fabric', 'connection-org1.json');

        if (!fs.existsSync(ccpPath)) {
            throw new Error(`Connection profile not found at ${ccpPath}`);
        }

        const ccp = JSON.parse(fs.readFileSync(ccpPath, 'utf8'));

        // ===================== CA SETUP =====================
        const caInfo = ccp.certificateAuthorities['ca.org1.example.com'];
        if (!caInfo) {
            throw new Error('CA info not found in connection profile');
        }

        const tlsCACerts = caInfo.tlsCACerts?.path
            ? fs.readFileSync(caInfo.tlsCACerts.path)
            : null;

        const ca = new FabricCAServices(
            caInfo.url,
            {
                trustedRoots: tlsCACerts,
                verify: false
            },
            caInfo.caName
        );

        // ===================== WALLET SETUP =====================
        const walletPath = path.join(process.cwd(), 'wallet');

        if (!fs.existsSync(walletPath)) {
            fs.mkdirSync(walletPath, { recursive: true });
        }

        const wallet = await Wallets.newFileSystemWallet(walletPath);

        console.log(`Wallet path: ${walletPath}`);

        // ===================== CHECK EXISTING ADMIN =====================
        const identity = await wallet.get('Admin@org1.example.com');
        if (identity) {
            console.log('✅ Admin already exists in wallet');
            return;
        }

        // ===================== ENROLL ADMIN =====================
        const enrollment = await ca.enroll({
            enrollmentID: 'admin',
            enrollmentSecret: 'adminpw'
        });

        const x509Identity = {
            credentials: {
                certificate: enrollment.certificate,
                privateKey: enrollment.key.toBytes(),
            },
            mspId: 'Org1MSP',
            type: 'X.509',
        };

        // ===================== STORE IN WALLET =====================
        await wallet.put('Admin@org1.example.com', x509Identity);

        console.log('🎉 Successfully enrolled admin user and imported into wallet');

    } catch (error) {
        console.error('❌ Failed to enroll admin user:', error);
        process.exit(1);
    }
}

main();
