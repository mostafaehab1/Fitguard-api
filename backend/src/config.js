import dotenv from "dotenv";

dotenv.config();

function required(name) {
  const v = process.env[name];
  if (v == null || String(v).trim() === "") {
    throw new Error(`Missing required env var: ${name}`);
  }
  return v;
}

function optional(name, fallback = null) {
  const v = process.env[name];
  if (v == null || String(v).trim() === "") {
    return fallback;
  }
  return v;
}

function optionalNumber(name, fallback) {
  const value = optional(name);
  if (value == null) {
    return fallback;
  }

  const n = Number(value);
  if (!Number.isFinite(n)) {
    throw new Error(`Invalid number env var: ${name}`);
  }
  return n;
}

function optionalBoolean(name, fallback) {
  const value = optional(name);
  if (value == null) {
    return fallback;
  }

  const normalized = String(value).trim().toLowerCase();
  if (["true", "1", "yes"].includes(normalized)) {
    return true;
  }
  if (["false", "0", "no"].includes(normalized)) {
    return false;
  }
  throw new Error(`Invalid boolean env var: ${name}`);
}

const port = Number(process.env.PORT ?? 3000);
const appBaseUrl = optional("APP_BASE_URL", `http://localhost:${port}`);
const smtpPort = optionalNumber("SMTP_PORT", 587);
const mail = {
  from: optional("MAIL_FROM"),
  smtp: {
    host: optional("SMTP_HOST"),
    port: smtpPort,
    secure: optionalBoolean("SMTP_SECURE", smtpPort === 465),
    user: optional("SMTP_USER"),
    pass: optional("SMTP_PASS"),
  },
  verifyEmailUrl: optional("VERIFY_EMAIL_URL", `${appBaseUrl}/api/auth/verify-email`),
  resetPasswordUrl: optional("RESET_PASSWORD_URL", `${appBaseUrl}/reset-password`),
};

function validateMailConfig(nodeEnv) {
  const hasAnyMailConfig = [
    mail.from,
    mail.smtp.host,
    mail.smtp.user,
    mail.smtp.pass,
  ].some(Boolean);

  if ((nodeEnv === "production" || hasAnyMailConfig) && (!mail.from || !mail.smtp.host)) {
    throw new Error("SMTP email requires SMTP_HOST and MAIL_FROM");
  }

  if ((mail.smtp.user && !mail.smtp.pass) || (!mail.smtp.user && mail.smtp.pass)) {
    throw new Error("SMTP_USER and SMTP_PASS must be provided together");
  }
}

const nodeEnv = process.env.NODE_ENV ?? "development";
validateMailConfig(nodeEnv);

export const env = {
  nodeEnv,
  port,
  mongoUri: required("MONGODB_URI"),
  jwtSecret: required("JWT_SECRET"),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "7d",
  appBaseUrl,
  mail,
};
