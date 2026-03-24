const crypto = require('crypto');
const { sendEmail } = require('./emailService');

let otpStorage = {}; // In-memory storage; consider Redis for production

const generateOTP = () => crypto.randomInt(100000, 999999).toString();

/**
 * Sends an OTP email to the user
 * @param {string} email - User's email address
 * @param {string} otp - The OTP to send
 * @returns {Promise<Object>} - { success: boolean, error?: string }
 */
const sendOtpEmail = async (email, otp) => {
  try {
    const subject = 'Your OTP Code for Virtual Classroom';
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
        <h2 style="color: #1a73e8; text-align: center;">Virtual Classroom OTP Verification</h2>
        <p style="font-size: 16px;">Hello,</p>
        <p style="font-size: 16px;">Your One-Time Password (OTP) for verification is:</p>
        <div style="background-color: #f5f5f5; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
          <h1 style="font-size: 36px; letter-spacing: 8px; color: #1a73e8; margin: 0;">${otp}</h1>
        </div>
        <p style="font-size: 14px; color: #666;">This OTP is valid for <strong>5 minutes</strong>.</p>
        <p style="font-size: 14px; color: #666;">If you didn't request this, please ignore this email.</p>
        <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 20px 0;">
        <p style="font-size: 12px; color: #999; text-align: center;">© ${new Date().getFullYear()} Virtual Classroom. All rights reserved.</p>
      </div>
    `;

    const result = await sendEmail(email, subject, htmlContent);

    if (!result.success) {
      console.error('❌ OTP email sending failed:', result.error);
      return { success: false, error: result.error };
    }

    return { success: true };
  } catch (error) {
    console.error('❌ OTP email sending exception:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Generates and sends an OTP to the user's email
 * @param {string} email - User's email address
 * @returns {Object} - { success: boolean, message: string, error?: string }
 */
const generateAndSendOtp = async (email) => {
  try {
    const otp = generateOTP();
    console.log(`🔐 Generated OTP for ${email}: ${otp}`); // For debugging
    
    const sent = await sendOtpEmail(email, otp);

    if (sent.success) {
      otpStorage[email] = { otp, expiresAt: Date.now() + 5 * 60 * 1000 };
      console.log(`✅ OTP stored for ${email}`);
      return { success: true, message: 'OTP sent successfully!' };
    }

    return { success: false, message: 'Failed to send OTP.', error: sent.error };
  } catch (error) {
    console.error('❌ OTP generation/sending error:', error);
    return { success: false, message: 'Server error while sending OTP.', error: error.message };
  }
};

/**
 * Verifies the provided OTP against the stored one
 * @param {string} email - User's email address
 * @param {string} userOtp - OTP provided by the user
 * @returns {Object} - { success: boolean, message: string }
 */
const verifyOtp = (email, userOtp) => {
  const storedOtpDetails = otpStorage[email];
  if (!storedOtpDetails) return { success: false, message: 'OTP not found or expired.' };

  const { otp, expiresAt } = storedOtpDetails;
  if (Date.now() > expiresAt) {
    delete otpStorage[email];
    return { success: false, message: 'OTP has expired.' };
  }

  if (userOtp === otp) {
    delete otpStorage[email];
    return { success: true, message: 'OTP verified successfully!' };
  }

  return { success: false, message: 'Invalid OTP.' };
};

module.exports = { generateAndSendOtp, verifyOtp };