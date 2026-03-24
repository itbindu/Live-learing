const { TransactionalEmailsApi, SendSmtpEmail } = require("@getbrevo/brevo");

let apiInstance = new TransactionalEmailsApi();

// Set your API key
const setApiKey = () => {
  const apiKey = apiInstance.authentications['apiKey'];
  apiKey.apiKey = process.env.BREVO_API_KEY;
};

/**
 * Send email using Brevo API
 * @param {string} to - Recipient email
 * @param {string} subject - Email subject
 * @param {string} htmlContent - HTML content of email
 * @returns {Promise<Object>} - { success: boolean, message?: string, error?: string }
 */
const sendEmail = async (to, subject, htmlContent) => {
  try {
    setApiKey();

    let sendSmtpEmail = new SendSmtpEmail();
    sendSmtpEmail.subject = subject;
    sendSmtpEmail.htmlContent = htmlContent;
    sendSmtpEmail.sender = { 
      name: "Virtual Classroom", 
      email: "noreply@virtualclassroom.com" 
    };
    sendSmtpEmail.to = [{ email: to, name: to.split('@')[0] }];

    const data = await apiInstance.sendTransacEmail(sendSmtpEmail);
    console.log(`✅ Email sent successfully to ${to}`);
    return { success: true, messageId: data.messageId };
  } catch (error) {
    console.error('❌ Brevo email error:', error);
    return { 
      success: false, 
      error: error.message 
    };
  }
};

module.exports = { sendEmail };