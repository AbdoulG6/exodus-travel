const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'abdoul6265@gmail.com',      // Remplace par ton email
    pass: 'rbfk aroq elhs bcch'      // Remplace par mot de passe application
  }
});

async function sendBookingConfirmation(email, bookingData) {
  const { bookingRef, serviceName, providerName, serviceType, quantity, totalPrice, qrCodeUrl, date } = bookingData;
  
  const serviceIcon = {
    transport: '🚌',
    hotel: '🏨',
    restaurant: '🍽️',
    park: '🏞️'
  }[serviceType] || '🎫';
  
  const mailOptions = {
    from: '"EXODUS TRAVEL" <TON_EMAIL@gmail.com>',
    to: email,
    subject: '✅ Confirmation de réservation - EXODUS TRAVEL',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; background: #f5f7fa; padding: 20px; }
          .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #0e5b8a 0%, #083b5c 100%); color: white; padding: 30px; text-align: center; }
          .header h1 { margin: 0; font-size: 1.8em; }
          .header span { background: white; color: #0e5b8a; padding: 2px 8px; border-radius: 6px; }
          .content { padding: 30px; }
          .info-box { background: #f8f9fa; border-radius: 12px; padding: 20px; margin: 20px 0; border-left: 4px solid #c0392b; }
          .info-item { margin: 10px 0; }
          .label { font-weight: bold; color: #0e5b8a; }
          .qr-code { text-align: center; margin: 20px 0; }
          .qr-code img { max-width: 180px; border: 2px solid #0e5b8a; border-radius: 12px; padding: 10px; }
          .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 0.8em; color: #7f8c8d; }
          .total { font-size: 1.3em; font-weight: bold; color: #c0392b; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>EXODUS<span>TRAVEL</span></h1>
            <p>Sierra Leone Limited</p>
          </div>
          <div class="content">
            <h2>✅ Réservation confirmée !</h2>
            <p>Bonjour,<br>Nous vous remercions pour votre réservation avec <strong>EXODUS TRAVEL</strong>.</p>
            
            <div class="info-box">
              <div class="info-item"><span class="label">📌 Référence :</span> ${bookingRef}</div>
              <div class="info-item"><span class="label">${serviceIcon} Service :</span> ${serviceName}</div>
              <div class="info-item"><span class="label">👥 Quantité :</span> ${quantity}</div>
              <div class="info-item"><span class="label">💰 Total :</span> <span class="total">${totalPrice} USD</span></div>
              <div class="info-item"><span class="label">📅 Date :</span> ${date}</div>
            </div>
            
            <div class="qr-code">
              <img src="${qrCodeUrl}" alt="QR Code">
              <p><strong>📱 Présentez ce QR code</strong><br>à l'embarquement ou à l'accueil</p>
            </div>
            
            <p>Pour toute question, n'hésitez pas à nous contacter.</p>
            <p style="margin-top: 20px;">L'équipe EXODUS TRAVEL<br>📞 +221 33 123 45 67</p>
          </div>
          <div class="footer">
            <p>&copy; 2024 EXODUS TRAVEL Sierra Leone Limited - Tous droits réservés</p>
          </div>
        </div>
      </body>
      </html>
    `
  };
  
  try {
    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error('Erreur envoi email:', error);
    return false;
  }
}

module.exports = { sendBookingConfirmation };