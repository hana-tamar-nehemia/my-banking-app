const crypto = require('crypto');
const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const router = express.Router();

// Adjust this to your deployed frontend URL.
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://YOUR-VERCEL-URL.vercel.app';

// Render's free tier blocks outbound SMTP ports, so we send email over HTTPS
// using Brevo's transactional email API (https://developers.brevo.com/).
// Required env vars: BREVO_API_KEY and EMAIL_USER (a Brevo-verified sender).
async function sendEmail({ to, subject, html }) {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    throw new Error('BREVO_API_KEY is not configured');
  }

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'Content-Type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify({
      sender: { name: 'Banking App', email: process.env.EMAIL_USER },
      to: [{ email: to }],
      subject,
      htmlContent: html,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Brevo API error ${response.status}: ${detail}`);
  }
}

function buildVerificationEmail(username, verificationUrl) {
  return `
  <!DOCTYPE html>
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    </head>
    <body style="margin:0; padding:0; background-color:#f4f6fb; font-family:'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6fb; padding:40px 0;">
        <tr>
          <td align="center">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px; background-color:#ffffff; border-radius:16px; overflow:hidden; box-shadow:0 8px 30px rgba(15,23,42,0.08);">
              <tr>
                <td style="background:linear-gradient(135deg,#2563eb,#1d4ed8); padding:32px 40px; text-align:center;">
                  <h1 style="margin:0; color:#ffffff; font-size:22px; font-weight:600; letter-spacing:0.3px;">Welcome to Banking App</h1>
                </td>
              </tr>
              <tr>
                <td style="padding:40px;">
                  <p style="margin:0 0 16px; color:#0f172a; font-size:18px; font-weight:600;">Hi ${username || 'there'},</p>
                  <p style="margin:0 0 28px; color:#475569; font-size:15px; line-height:1.6;">
                    Thanks for signing up. To activate your account and keep it secure, please confirm your email address by clicking the button below.
                  </p>
                  <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
                    <tr>
                      <td align="center" bgcolor="#2563eb" style="border-radius:10px;">
                        <a href="${verificationUrl}" target="_blank"
                          style="display:inline-block; padding:14px 36px; font-size:16px; font-weight:600; color:#ffffff; text-decoration:none; border-radius:10px;">
                          Verify My Account
                        </a>
                      </td>
                    </tr>
                  </table>
                  <p style="margin:32px 0 8px; color:#94a3b8; font-size:13px; line-height:1.6;">
                    If the button doesn't work, copy and paste this link into your browser:
                  </p>
                  <p style="margin:0; word-break:break-all;">
                    <a href="${verificationUrl}" target="_blank" style="color:#2563eb; font-size:13px;">${verificationUrl}</a>
                  </p>
                </td>
              </tr>
              <tr>
                <td style="padding:24px 40px; background-color:#f8fafc; text-align:center;">
                  <p style="margin:0; color:#94a3b8; font-size:12px; line-height:1.6;">
                    You received this email because an account was created with this address.<br />
                    If this wasn't you, you can safely ignore this message.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
  </html>`;
}

// Generates a fresh token + 15-minute expiry on the user, persists it, and
// emails the magic link. Throws if the email fails so callers can react.
async function issueVerificationEmail(user) {
  user.verificationCode = crypto.randomBytes(32).toString('hex');
  user.verificationCodeExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
  await user.save();

  const verificationUrl = `${FRONTEND_URL}/verify?token=${user.verificationCode}`;

  await sendEmail({
    to: user.email,
    subject: 'Verify your Banking App account',
    html: buildVerificationEmail(user.username, verificationUrl),
  });
}

function userWithoutPassword(user) {
  return {
    id: user._id.toString(),
    username: user.username,
    email: user.email,
    balance: user.balance,
  };
}

/**
 * @swagger
 * /api/auth/signup:
 *   post:
 *     summary: Register a new user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - email
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *                 example: jane_doe
 *               email:
 *                 type: string
 *                 format: email
 *                 example: jane@example.com
 *               password:
 *                 type: string
 *                 format: password
 *                 example: secret123
 *     responses:
 *       201:
 *         description: Registration pending verification
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Registration pending verification
 *                 verificationCode:
 *                   type: string
 *                   example: "123456"
 *       400:
 *         description: Email already exists
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Email already exists
 */
router.post('/signup', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    const normalizedEmail = email?.toLowerCase();

    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already exists' });
    }

    const newUser = new User({
      username,
      email: normalizedEmail,
      password,
    });

    try {
      await issueVerificationEmail(newUser);
    } catch (mailErr) {
      console.error('Failed to send verification email:', mailErr);
      // Roll back the half-finished signup so the user can retry cleanly.
      await User.deleteOne({ _id: newUser._id });
      return res.status(500).json({
        error: 'Could not send verification email. Please try again later.',
      });
    }

    console.log(`Verification link sent to ${normalizedEmail}`);

    res.status(201).json({
      message: 'Registration pending verification. Please check your email.',
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ error: 'Email already exists' });
    }
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * @swagger
 * /api/auth/verify:
 *   post:
 *     summary: Verify account with a magic-link token
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *             properties:
 *               token:
 *                 type: string
 *                 example: a1b2c3d4e5f6...
 *     responses:
 *       200:
 *         description: Account verified successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Account verified successfully
 *                 user:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                     username:
 *                       type: string
 *                     email:
 *                       type: string
 *                     balance:
 *                       type: number
 *       400:
 *         description: Missing or invalid token
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Invalid or expired verification token
 */
router.post('/verify', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Verification token is required' });
    }

    const user = await User.findOne({ verificationCode: token });
    if (!user) {
      return res
        .status(400)
        .json({ error: 'Invalid or expired verification token' });
    }

    if (
      !user.verificationCodeExpires ||
      user.verificationCodeExpires.getTime() < Date.now()
    ) {
      return res
        .status(400)
        .json({ error: 'Invalid or expired verification token' });
    }

    user.isVerified = true;
    user.verificationCode = undefined;
    user.verificationCodeExpires = undefined;
    await user.save();

    const authToken = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.status(200).json({
      message: 'Account verified successfully',
      user: {
        _id: user._id,
        username: user.username,
        email: user.email,
        balance: user.balance,
      },
      token: authToken,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * @swagger
 * /api/auth/resend-verification:
 *   post:
 *     summary: Resend the magic-link verification email
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: jane@example.com
 *     responses:
 *       200:
 *         description: A new verification link was sent (if the account exists)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: If an unverified account exists for this email, a new link has been sent.
 *       400:
 *         description: Email missing or account already verified
 *       500:
 *         description: Failed to send the verification email
 */
router.post('/resend-verification', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const genericMessage =
      'If an unverified account exists for this email, a new link has been sent.';

    const user = await User.findOne({ email: email.toLowerCase() });

    // Don't reveal whether the email exists (avoids account enumeration).
    if (!user) {
      return res.status(200).json({ message: genericMessage });
    }

    if (user.isVerified) {
      return res
        .status(400)
        .json({ error: 'This account is already verified. Please log in.' });
    }

    try {
      await issueVerificationEmail(user);
    } catch (mailErr) {
      console.error('Failed to resend verification email:', mailErr);
      return res.status(500).json({
        error: 'Could not send verification email. Please try again later.',
      });
    }

    console.log(`Verification link resent to ${user.email}`);
    res.status(200).json({ message: genericMessage });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login with email and password
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: jane@example.com
 *               password:
 *                 type: string
 *                 format: password
 *                 example: secret123
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Login successful
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     username:
 *                       type: string
 *                     email:
 *                       type: string
 *       401:
 *         description: Invalid credentials
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Invalid credentials
 *       403:
 *         description: Account not verified
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Please verify your account first
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email: email?.toLowerCase() });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (!user.isVerified) {
      return res
        .status(403)
        .json({ error: 'Please verify your account first' });
    }

    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.status(200).json({
      message: 'Login successful',
      user: userWithoutPassword(user),
      token,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
