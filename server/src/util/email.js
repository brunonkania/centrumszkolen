import nodemailer from 'nodemailer';

let transporter = null;

function haveSmtp() {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function getTransporter() {
  if (!haveSmtp()) return null;
  if (transporter) return transporter;
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: false,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
  });
  return transporter;
}

export async function sendEmail({ to, subject, html, text }) {
  const t = getTransporter();
  if (!t) {
    console.log('[DEV EMAIL]', { to, subject, html });
    return { dev: true };
  }
  const from = process.env.SMTP_FROM || 'no-reply@local';
  await t.sendMail({ from, to, subject, html, text: text || html.replace(/<[^>]+>/g, '') });
  return { ok: true };
}
