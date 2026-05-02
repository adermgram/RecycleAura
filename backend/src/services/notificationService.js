const nodemailer = require('nodemailer');
const User = require('../models/User');
const Coupon = require('../models/Coupon');

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: parseInt(process.env.EMAIL_PORT) || 465,
  secure: process.env.EMAIL_PORT === '465',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  }
});

const sendEmail = async (to, subject, html) => {
  try {
    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM || `"RecycleAura" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html
    });
    console.log('Email sent:', info.messageId);
    return true;
  } catch (error) {
    console.error('Email sending failed:', error.message);
    return false;
  }
};

const sendWelcomeEmail = async (user) => {
  if (!user.email) return;
  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#f9fafb;border-radius:12px;">
      <h1 style="color:#10b981;margin-bottom:8px;">Welcome to RecycleAura! ♻️</h1>
      <p style="color:#374151;font-size:16px;">Hi <strong>${user.name}</strong>,</p>
      <p style="color:#374151;">Thanks for joining our recycling community. Every item you recycle earns you points and helps the environment.</p>
      <div style="background:#ecfdf5;border-left:4px solid #10b981;padding:16px;border-radius:8px;margin:20px 0;">
        <p style="margin:0;color:#065f46;font-weight:600;">How it works:</p>
        <ul style="color:#065f46;margin:8px 0;padding-left:20px;">
          <li>Scan QR codes on recyclable items</li>
          <li>Earn points for each item recycled</li>
          <li>Fill your can to trigger a collection request</li>
          <li>Redeem your reward coupons</li>
        </ul>
      </div>
      <p style="color:#6b7280;font-size:14px;">Happy recycling!<br/><strong>The RecycleAura Team</strong></p>
    </div>
  `;
  await sendEmail(user.email, 'Welcome to RecycleAura!', html);
};

const sendCouponEmail = async (user, couponCode) => {
  if (!user.email) return;
  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#f9fafb;border-radius:12px;">
      <h1 style="color:#10b981;">Your Recycling Reward 🎉</h1>
      <p style="color:#374151;">Hi <strong>${user.name}</strong>, your recycling can is full — great work!</p>
      <p style="color:#374151;">A collection team has been notified and will visit you soon. Here is your reward coupon:</p>
      <div style="background:#ecfdf5;border:2px dashed #10b981;padding:20px;border-radius:12px;text-align:center;margin:20px 0;">
        <p style="margin:0 0 8px;color:#6b7280;font-size:14px;">Your coupon code</p>
        <p style="margin:0;font-size:28px;font-weight:700;font-family:monospace;color:#065f46;letter-spacing:2px;">${couponCode}</p>
      </div>
      <p style="color:#6b7280;font-size:13px;">Keep recycling and earn more rewards!</p>
      <p style="color:#6b7280;font-size:13px;"><strong>The RecycleAura Team</strong></p>
    </div>
  `;
  await sendEmail(user.email, 'Your Recycling Can is Full — Here is Your Reward!', html);
};

const handleCanFull = async (userId) => {
  try {
    const user = await User.findById(userId);
    if (!user) throw new Error('User not found');

    const coupon = new Coupon({
      code: `RECYCLE-${Date.now()}`,
      type: 'discount',
      value: 100,
      description: 'Recycling reward coupon',
      pointsRequired: 0,
      isActive: true
    });
    await coupon.save();

    user.coupons.push(coupon._id);
    await user.save();

    // Notify company
    const ghanaCardId = `GHA-${user.aadhaar.slice(0, 9)}-${user.aadhaar[user.aadhaar.length - 1]}`;
    const companyHtml = `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#f9fafb;border-radius:12px;">
        <h1 style="color:#10b981;">Collection Request ♻️</h1>
        <p style="color:#374151;">A user's recycling can is full and ready for collection.</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0;">
          <tr><td style="padding:8px;color:#6b7280;font-weight:600;">Name</td><td style="padding:8px;color:#111827;">${user.name}</td></tr>
          <tr style="background:#f3f4f6;"><td style="padding:8px;color:#6b7280;font-weight:600;">Ghana Card ID</td><td style="padding:8px;color:#111827;">${ghanaCardId}</td></tr>
          <tr><td style="padding:8px;color:#6b7280;font-weight:600;">Address</td><td style="padding:8px;color:#111827;">${user.address}</td></tr>
          <tr style="background:#f3f4f6;"><td style="padding:8px;color:#6b7280;font-weight:600;">Coupon Issued</td><td style="padding:8px;color:#111827;">${coupon.code}</td></tr>
        </table>
      </div>
    `;

    const emailSent = await sendEmail(
      process.env.COMPANY_EMAIL,
      `Collection Request — ${user.name}`,
      companyHtml
    );

    // Send coupon to user (non-blocking)
    sendCouponEmail(user, coupon.code).catch(() => {});

    if (!emailSent) throw new Error('Failed to send collection notification email');

    return { success: true, coupon: coupon.code };
  } catch (error) {
    console.error('handleCanFull error:', error.message);
    return { success: false, error: error.message };
  }
};

module.exports = { sendEmail, sendWelcomeEmail, handleCanFull };
