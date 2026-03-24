const axios = require('axios');
require('dotenv').config();

const BREVO_API_KEY = process.env.BREVO_API_KEY;

/**
 * Send email using Brevo API
 * @param {string} to - Recipient email
 * @param {string} subject - Email subject
 * @param {string} htmlContent - HTML content of email
 * @returns {Promise<Object>} - { success: boolean, messageId?: string, error?: string }
 */
const sendEmail = async (to, subject, htmlContent) => {
  try {
    const response = await axios.post('https://api.brevo.com/v3/smtp/email', {
      sender: {
        name: "Virtual Classroom",
        email: "virtualclassroom32@gmail.com"
      },
      to: [{
        email: to,
        name: to.split('@')[0]
      }],
      subject: subject,
      htmlContent: htmlContent
    }, {
      headers: {
        'api-key': BREVO_API_KEY,
        'Content-Type': 'application/json'
      }
    });

    console.log(`✅ Email sent successfully to ${to}`);
    return { success: true, messageId: response.data.messageId };
  } catch (error) {
    console.error('❌ Brevo email error:', error.response?.data || error.message);
    return { 
      success: false, 
      error: error.response?.data?.message || error.message 
    };
  }
};

module.exports = { sendEmail };