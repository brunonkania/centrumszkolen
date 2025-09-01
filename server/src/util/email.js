import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';

const SMTP_HOST = process.env.SMTP_HOST || '';
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const SMTP_FROM = process.env.SMTP_FROM || 'no-reply@local';

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  if (!SMTP_HOST) {
    // DEV transport (console)
    transporter = {
      sendMail: async (opts) => {
        console.log('[DEV EMAIL]', { to: opts.to, subject: opts.subject });
        console.log('--- HTML ---\n' + (opts.html || ''));
        console.log('--- TEXT ---\n' + (opts.text || ''));
        return { messageId: 'dev-' + Date.now() };
      }
    };
    return transporter;
  }

  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465, // 465 = SSL
    auth: (SMTP_USER && SMTP_PASS) ? { user: SMTP_USER, pass: SMTP_PASS } : undefined
  });

  return transporter;
}

export async function sendEmail({ to, subject, html, text }) {
  const t = getTransporter();
  const info = await t.sendMail({
    from: SMTP_FROM,
    to,
    subject,
    html,
    text
  });
  return info;
}

export function renderTemplate(name, params = {}) {
  const base = path.resolve(process.cwd(), 'server', 'templates');
  const layoutPath = path.join(base, 'layout.html');
  const bodyPath = path.join(base, `${name}.html`);

  let layout = '';
  let body = '';

  try { layout = fs.readFileSync(layoutPath, 'utf8'); } catch { /* ignore */ }
  try { body = fs.readFileSync(bodyPath, 'utf8'); } catch { /* ignore */ }

  const render = (tpl) =>
    tpl.replace(/\{\{\s*([a-zA-Z0-9_\.]+)\s*\}\}/g, (_, key) => {
      const parts = key.split('.');
      let v = params;
      for (const p of parts) v = (v && v[p] !== undefined) ? v[p] : '';
      return String(v);
    });

  const content = render(body);
  if (!layout) return content;
  return render(layout).replace('<!-- {{content}} -->', content);
}
