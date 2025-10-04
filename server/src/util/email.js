import nodemailer from 'nodemailer';
import mustache from 'mustache';
import { readFile } from 'fs/promises';
import { resolve } from 'path';
import { SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, SMTP_FROM } from '../config.js';

function emailConfigured() {
  // Wystarczy host i port – auth jest opcjonalne (Mailpit/Mailhog nie wymaga)
  return Boolean(SMTP_HOST && SMTP_PORT);
}

function getTransporter() {
  if (!emailConfigured()) return null;
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined
  });
}

/**
 * Wysyła magic link e-mailem; jeżeli SMTP nie jest skonfigurowane lub jest błąd
 * – NIE rzuca wyjątku. Zwraca obiekt z informacją, co się stało.
 */
export async function sendMagicLinkEmail({ to, courseTitle, linkUrl, expiresAt }) {
  if (!emailConfigured()) {
    console.warn('[EMAIL] Pomijam wysyłkę – brak konfiguracji SMTP_HOST/SMTP_PORT');
    return { ok: false, reason: 'not_configured' };
  }

  const transporter = getTransporter();
  try {
    const templatePath = resolve(process.cwd(), 'server/templates/guest_link.html');
    const template = await readFile(templatePath, 'utf8');
    const html = mustache.render(template, { courseTitle, linkUrl, expiresAt });

    const info = await transporter.sendMail({
      from: SMTP_FROM,
      to,
      subject: `Dostęp do materiałów: ${courseTitle}`,
      html
    });
    return { ok: true, info };
  } catch (err) {
    console.error('[EMAIL] Błąd wysyłki:', err?.message || err);
    return { ok: false, reason: 'send_error', error: String(err?.message || err) };
  }
}
