import "server-only";

import nodemailer, { type Transporter } from "nodemailer";

// Outgoing email (magic links, password resets) over any SMTP relay. In
// development, `bun run db:up` also starts Mailpit on 127.0.0.1:1025 with a
// web inbox at http://localhost:8025.
//
// Never send manuscript content through here.

export type Mail = {
  to: string;
  subject: string;
  text: string;
};

export function isSmtpConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST);
}

/**
 * Whether flows that depend on email (magic link, password reset) should be
 * offered. Without SMTP they are hidden, except in development, where
 * `sendMail` prints the message to the server console instead.
 */
export function isEmailEnabled(): boolean {
  return isSmtpConfigured() || process.env.NODE_ENV === "development";
}

let transporter: Transporter | undefined;

function getTransporter(): Transporter {
  transporter ??= nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    // Port 465 is implicit TLS; every other port upgrades with STARTTLS.
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
      : undefined,
  });
  return transporter;
}

export async function sendMail(mail: Mail): Promise<void> {
  if (!isSmtpConfigured()) {
    if (process.env.NODE_ENV === "development") {
      console.info(
        `[mail] SMTP is not configured; not sending.\n` +
          `  to: ${mail.to}\n  subject: ${mail.subject}\n\n${mail.text}\n`,
      );
      return;
    }
    throw new Error("Email is not configured (set SMTP_HOST)");
  }

  await getTransporter().sendMail({
    from: process.env.SMTP_FROM || "ManuHaven <no-reply@localhost>",
    to: mail.to,
    subject: mail.subject,
    text: mail.text,
  });
}
