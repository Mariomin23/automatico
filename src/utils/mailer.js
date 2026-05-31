const nodemailer = require('nodemailer');
const fs = require('fs');

function log(msg) {
  const hora = new Date().toTimeString().slice(0, 5);
  console.log(`[${hora}] ${msg}`);
}

async function enviarResumen(rutaResumen) {
  const { EMAIL_FROM, EMAIL_TO, EMAIL_SMTP_HOST, EMAIL_SMTP_PORT, EMAIL_SMTP_USER, EMAIL_SMTP_PASS } =
    process.env;

  // Si no hay config de email, omite silenciosamente
  if (!EMAIL_SMTP_HOST || !EMAIL_SMTP_USER || !EMAIL_SMTP_PASS) {
    log('Email omitido — EMAIL_SMTP_HOST/USER/PASS no configurados');
    return;
  }

  const transporter = nodemailer.createTransport({
    host: EMAIL_SMTP_HOST,
    port: parseInt(EMAIL_SMTP_PORT || '587', 10),
    secure: false,
    auth: { user: EMAIL_SMTP_USER, pass: EMAIL_SMTP_PASS },
  });

  const cuerpo = fs.readFileSync(rutaResumen, 'utf-8');
  const hoy = new Date().toISOString().slice(0, 10);

  try {
    await transporter.sendMail({
      from: EMAIL_FROM || EMAIL_SMTP_USER,
      to: EMAIL_TO || EMAIL_SMTP_USER,
      subject: `job-hunter-ai — Resumen ${hoy}`,
      text: cuerpo,
    });
    log(`Email enviado a ${EMAIL_TO}`);
  } catch (err) {
    console.error(`[Mailer] Error al enviar email: ${err.message}`);
  }
}

module.exports = { enviarResumen };
