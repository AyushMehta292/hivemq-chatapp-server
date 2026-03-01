import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export const sendOTPEmail = async (to, otp) => {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    const err = new Error('SMTP not configured (missing SMTP_HOST, SMTP_USER, or SMTP_PASS)');
    console.error('[Email]', err.message);
    throw err;
  }
  const mailOptions = {
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject: 'Verify your email - MERN Chat',
    text: `Your verification code is: ${otp}. It expires in 10 minutes.`,
    html: `
      <p>Your verification code is: <strong>${otp}</strong></p>
      <p>It expires in 10 minutes.</p>
    `,
  };
  try {
    await transporter.sendMail(mailOptions);
    console.log('[Email] OTP sent to', to);
  } catch (err) {
    console.error('[Email] Send failed:', err.message);
    if (err.response) console.error('[Email] Response:', err.response);
    if (err.code) console.error('[Email] Code:', err.code);
    throw err;
  }
};

export const sendPasswordResetEmail = async (to, otp) => {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    const err = new Error('SMTP not configured');
    console.error('[Email]', err.message);
    throw err;
  }
  const mailOptions = {
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject: 'Reset your password - MERN Chat',
    text: `Your password reset code is: ${otp}. It expires in 15 minutes.`,
    html: `
      <p>Your password reset code is: <strong>${otp}</strong></p>
      <p>It expires in 15 minutes.</p>
    `,
  };
  try {
    await transporter.sendMail(mailOptions);
    console.log('[Email] Password reset OTP sent to', to);
  } catch (err) {
    console.error('[Email] Send failed:', err.message);
    throw err;
  }
};
