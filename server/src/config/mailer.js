// Shared – SMTP mailer (used by HIPO 2.0 account recovery).
const nodemailer = require("nodemailer");

const isConfigured = () => Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS && process.env.MAIL_FROM);

const getTransporter = () => {
    if (!isConfigured()) throw new Error("SMTP is not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASS, and MAIL_FROM.");
    return nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: process.env.SMTP_SECURE === "true",
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    });
};

const sendMail = async ({ to, subject, text, html }) => {
    const transporter = getTransporter();
    return transporter.sendMail({ from: process.env.MAIL_FROM, to, subject, text, html });
};

module.exports = { sendMail };