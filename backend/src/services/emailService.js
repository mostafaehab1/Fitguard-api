import nodemailer from "nodemailer";
import { env } from "../config.js";

let transporter;

function isConfigured() {
  return Boolean(env.mail.smtp.host && env.mail.from);
}

function getTransporter() {
  if (!isConfigured()) {
    if (env.nodeEnv === "production") {
      throw new Error("SMTP email is not configured");
    }
    return null;
  }

  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.mail.smtp.host,
      port: env.mail.smtp.port,
      secure: env.mail.smtp.secure,
      ...(env.mail.smtp.user
        ? {
            auth: {
              user: env.mail.smtp.user,
              pass: env.mail.smtp.pass,
            },
          }
        : {}),
    });
  }

  return transporter;
}

function appendToken(url, token) {
  const target = new URL(url);
  target.searchParams.set("token", token);
  return target.toString();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

async function sendMail({ to, subject, text, html }) {
  const tx = getTransporter();
  if (!tx) {
    console.warn(`[email] SMTP is not configured; skipped email to ${to}: ${subject}`);
    return { skipped: true };
  }

  await tx.sendMail({
    from: env.mail.from,
    to,
    subject,
    text,
    html,
  });

  return { skipped: false };
}

export async function sendVerificationEmail({ to, token }) {
  const verifyUrl = appendToken(env.mail.verifyEmailUrl, token);
  const safeVerifyUrl = escapeHtml(verifyUrl);

  return sendMail({
    to,
    subject: "Verify your FitGuard email",
    text: [
      "Welcome to FitGuard.",
      "",
      "Verify your email address by opening this link:",
      verifyUrl,
      "",
      "If you did not create this account, you can ignore this email.",
    ].join("\n"),
    html: `
      <p>Welcome to FitGuard.</p>
      <p>Verify your email address by opening this link:</p>
      <p><a href="${safeVerifyUrl}">${safeVerifyUrl}</a></p>
      <p>If you did not create this account, you can ignore this email.</p>
    `,
  });
}

export async function sendPasswordResetEmail({ to, token }) {
  const resetUrl = appendToken(env.mail.resetPasswordUrl, token);
  const safeResetUrl = escapeHtml(resetUrl);

  return sendMail({
    to,
    subject: "Reset your FitGuard password",
    text: [
      "We received a request to reset your FitGuard password.",
      "",
      "Open this link to choose a new password:",
      resetUrl,
      "",
      "This link expires in 1 hour. If you did not request this, you can ignore this email.",
    ].join("\n"),
    html: `
      <p>We received a request to reset your FitGuard password.</p>
      <p>Open this link to choose a new password:</p>
      <p><a href="${safeResetUrl}">${safeResetUrl}</a></p>
      <p>This link expires in 1 hour. If you did not request this, you can ignore this email.</p>
    `,
  });
}
