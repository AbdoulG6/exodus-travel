const Paystack = require('paystack');

// Vérifier que la clé existe
if (!process.env.PAYSTACK_SECRET_KEY) {
    console.warn('⚠️ PAYSTACK_SECRET_KEY non définie dans .env');
}

const paystack = Paystack(process.env.PAYSTACK_SECRET_KEY || 'sk_test_xxx');

module.exports = paystack;