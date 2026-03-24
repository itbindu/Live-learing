const { TransactionalEmailsApi, SendSmtpEmail } = require("@getbrevo/brevo");

const apiInstance = new TransactionalEmailsApi();

const sendEmail = async (to, subject, htmlContent) => {
  try {

    const apiKey = apiInstance.authentications['apiKey'];
    apiKey.apiKey = process.env.BREVO_API_KEY;

    const sendSmtpEmail = new SendSmtpEmail();

    sendSmtpEmail.subject = subject;
    sendSmtpEmail.htmlContent = htmlContent;

    sendSmtpEmail.sender = {
      name: "Live Learning",
      email: "virtualclassroom32@gmail.com"
    };

    sendSmtpEmail.to = [
      { email: to }
    ];

    const response = await apiInstance.sendTransacEmail(sendSmtpEmail);

    console.log("Email sent:", response.messageId);

    return { success: true };

  } catch (error) {

    console.error("Brevo error:", error);

    return {
      success: false,
      error: error.message
    };
  }
};

module.exports = { sendEmail };