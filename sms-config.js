const twilio = require('twilio');

// Configuration Twilio (remplace par tes identifiants)
const accountSid = 'AC8588077f5e8bb5161d29c2002fbb8d3f';     // À récupérer sur Twilio
const authToken = '5b86eaae31087f1d7dfa7186bc04cf55';       // À récupérer sur Twilio
const twilioPhone = '+19016692072';          // Ton numéro Twilio acheté

const client = twilio(accountSid, authToken);

// Fonction d'envoi de SMS
async function sendSmsConfirmation(phoneNumber, bookingData) {
    const { bookingRef, serviceName, quantity, totalPrice, date } = bookingData;
    
    // Formater le numéro (supprimer les espaces, ajouter indicatif pays)
    let formattedNumber = phoneNumber.replace(/\s/g, '');
    if (!formattedNumber.startsWith('+')) {
        formattedNumber = '+221' + formattedNumber; // Indicatif Sénégal, à adapter
    }
    
    const message = `EXODUS TRAVEL: Votre réservation ${bookingRef} est confirmée. 
${serviceName} - ${quantity} place(s) - ${totalPrice} USD le ${date}. 
Merci de voyager avec EXODUS TRAVEL !`;
    
    try {
        const sms = await client.messages.create({
            body: message,
            from: twilioPhone,
            to: formattedNumber
        });
        console.log(`✅ SMS envoyé à ${phoneNumber}, SID: ${sms.sid}`);
        return true;
    } catch (error) {
        console.error('❌ Erreur envoi SMS:', error.message);
        return false;
    }
}

module.exports = { sendSmsConfirmation };