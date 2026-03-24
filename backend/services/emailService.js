const axios = require('axios');

const sendEmail = async (to, subject, htmlContent) => {
  try {
    const response = await axios.post(
      'https://api.brevo.com/v3/smtp/email',
      {
        sender: {
          name: "Virtual Classroom",
          email: "virtualclassroom32@gmail.com"
        },
        to: [{ email: to }],
        subject: subject,
        htmlContent: htmlContent
      },
      {
        headers: {
          'api-key': process.env.BREVO_API_KEY,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log("✅ Email sent:", response.data);
    return { success: true };

  } catch (error) {
    console.error("❌ Brevo error:", error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data?.message || error.message
    };
  }
};

module.exports = { sendEmail };