const flw = require('../config/flutterwave');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, '../exodus.db'));

// Devises par pays
const CURRENCIES = {
    'Guinée': 'GNF',
    'Sénégal': 'XOF',
    'Côte d\'Ivoire': 'XOF',
    'Mali': 'XOF',
    'Burkina Faso': 'XOF',
    'Niger': 'XOF',
    'Togo': 'XOF',
    'Bénin': 'XOF',
    'Ghana': 'GHS',
    'Nigeria': 'NGN'
};

// Taux de conversion approximatifs (à jour en production)
const EXCHANGE_RATES = {
    'GNF': 8500, // 1 USD = 8500 GNF
    'XOF': 600,  // 1 USD = 600 XOF
    'GHS': 15,   // 1 USD = 15 GHS
    'NGN': 1500  // 1 USD = 1500 NGN
};

// Initialiser un paiement
async function initiatePayment(req, res) {
    try {
        const { booking_id, email, amount, phone, service_name, country } = req.body;

        console.log('📝 Initiation paiement Flutterwave:', { booking_id, email, amount, phone, country });

        // Vérifier que la réservation existe
        db.get('SELECT * FROM unified_bookings WHERE id = ?', [booking_id], async (err, booking) => {
            if (err || !booking) {
                return res.status(404).json({ error: 'Réservation non trouvée' });
            }

            if (booking.payment_status === 'paid') {
                return res.status(400).json({ error: 'Cette réservation est déjà payée' });
            }

            // Déterminer la devise
            const currency = CURRENCIES[country] || 'GNF';
            const rate = EXCHANGE_RATES[currency] || 8500;
            const amountInLocalCurrency = Math.round(amount * rate);

            const tx_ref = `EXO_${Date.now()}_${Math.floor(Math.random() * 10000)}`;

            try {
                // Créer la transaction Flutterwave
                const response = await flw.Payment.initialize({
                    tx_ref: tx_ref,
                    amount: amountInLocalCurrency,
                    currency: currency,
                    payment_options: 'card,mobilemoney',
                    redirect_url: process.env.FLW_CALLBACK_URL,
                    customer: {
                        email: email,
                        phone_number: phone || '0000000000',
                        name: `Client EXODUS`
                    },
                    customizations: {
                        title: 'EXODUS TRAVEL',
                        description: service_name || 'Réservation voyage',
                        logo: 'https://exodus-travel.com/logo.png'
                    },
                    meta: {
                        booking_id: booking_id,
                        user_email: email,
                        phone: phone || '',
                        country: country || 'Guinée'
                    }
                });

                console.log('✅ Transaction Flutterwave créée:', response);

                // Sauvegarder la référence de transaction
                db.run(`
                    UPDATE unified_bookings 
                    SET payment_reference = ?, 
                        payment_status = 'pending',
                        payment_method = 'flutterwave',
                        currency = ?
                    WHERE id = ?
                `, [tx_ref, currency, booking_id]);

                res.json({
                    success: true,
                    authorization_url: response.data.link,
                    reference: tx_ref
                });

            } catch (flutterwaveError) {
                console.error('❌ Erreur Flutterwave:', flutterwaveError);
                res.status(500).json({ 
                    error: 'Erreur lors de l\'initialisation du paiement',
                    details: flutterwaveError.message 
                });
            }
        });
    } catch (error) {
        console.error('❌ Erreur:', error);
        res.status(500).json({ error: 'Erreur interne du serveur' });
    }
}

// Vérifier le statut d'un paiement
async function verifyPayment(req, res) {
    try {
        const { reference } = req.params;

        console.log('🔍 Vérification paiement Flutterwave:', reference);

        const response = await flw.Transaction.verify({ id: reference });

        if (response.data.status === 'successful') {
            // Mettre à jour la réservation
            db.run(`
                UPDATE unified_bookings 
                SET payment_status = 'paid', 
                    payment_date = datetime('now')
                WHERE payment_reference = ?
            `, [reference]);

            res.json({
                success: true,
                message: 'Paiement confirmé !',
                data: response.data
            });
        } else {
            res.json({
                success: false,
                message: 'Paiement non confirmé',
                status: response.data.status
            });
        }
    } catch (error) {
        console.error('❌ Erreur vérification:', error);
        res.status(500).json({ error: 'Erreur lors de la vérification' });
    }
}

// Callback après paiement
async function paymentCallback(req, res) {
    try {
        const { status, tx_ref, transaction_id } = req.query;

        console.log('🔄 Callback Flutterwave reçu:', { status, tx_ref, transaction_id });

        if (status === 'successful') {
            // Mettre à jour la réservation
            db.run(`
                UPDATE unified_bookings 
                SET payment_status = 'paid', 
                    payment_date = datetime('now'),
                    payment_transaction_id = ?
                WHERE payment_reference = ?
            `, [transaction_id, tx_ref]);

            // Rediriger vers la page de succès
            res.redirect(`/payment-success.html?reference=${tx_ref}`);
        } else {
            res.redirect(`/payment-failed.html?reference=${tx_ref}`);
        }
    } catch (error) {
        console.error('❌ Erreur callback:', error);
        res.redirect('/payment-failed.html');
    }
}

// Webhook Flutterwave
async function paymentWebhook(req, res) {
    try {
        const event = req.body;
        console.log('📨 Webhook Flutterwave reçu:', event);

        if (event.event === 'charge.completed' && event.data.status === 'successful') {
            const data = event.data;
            
            // Mettre à jour la réservation
            db.run(`
                UPDATE unified_bookings 
                SET payment_status = 'paid', 
                    payment_date = datetime('now'),
                    payment_transaction_id = ?
                WHERE payment_reference = ?
            `, [data.id, data.tx_ref]);

            console.log(`✅ Paiement confirmé via webhook: ${data.tx_ref}`);
        }

        res.sendStatus(200);
    } catch (error) {
        console.error('❌ Erreur webhook:', error);
        res.sendStatus(500);
    }
}

// Obtenir le statut de paiement
async function getPaymentStatus(req, res) {
    try {
        const { booking_id } = req.params;

        db.get(`
            SELECT payment_status, payment_reference, payment_date, currency 
            FROM unified_bookings 
            WHERE id = ?
        `, [booking_id], (err, row) => {
            if (err || !row) {
                return res.status(404).json({ error: 'Réservation non trouvée' });
            }

            res.json({
                booking_id: parseInt(booking_id),
                payment_status: row.payment_status || 'pending',
                payment_reference: row.payment_reference,
                payment_date: row.payment_date,
                currency: row.currency || 'GNF'
            });
        });
    } catch (error) {
        console.error('❌ Erreur:', error);
        res.status(500).json({ error: 'Erreur interne du serveur' });
    }
}

// Liste des pays supportés
async function getSupportedCountries(req, res) {
    res.json({
        countries: Object.keys(CURRENCIES),
        currencies: CURRENCIES
    });
}

module.exports = {
    initiatePayment,
    verifyPayment,
    paymentCallback,
    paymentWebhook,
    getPaymentStatus,
    getSupportedCountries,
    CURRENCIES,
    EXCHANGE_RATES
};