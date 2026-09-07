const Flutterwave = require('flutterwave-node-v3');

// Vérifier que les clés existent
if (!process.env.FLW_SECRET_KEY) {
    console.warn('⚠️ FLW_SECRET_KEY non définie dans .env');
}

const flw = new Flutterwave(
    process.env.FLW_PUBLIC_KEY || 'FLWPUBK_TEST_xxx',
    process.env.FLW_SECRET_KEY || 'FLWSECK_TEST_xxx',
    process.env.FLW_ENCRYPTION_KEY || 'xxx'
);

module.exports = flw;