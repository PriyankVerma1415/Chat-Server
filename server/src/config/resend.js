const { Resend } = require('resend');

const resendApiKey = process.env.RESEND_API_KEY;

if (!resendApiKey) {
  console.warn('Missing RESEND_API_KEY environment variable. OTP emails will not send successfully.');
}

const resend = new Resend(resendApiKey || 'placeholder_key');

module.exports = resend;
