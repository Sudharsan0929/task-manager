const dotenv = require("dotenv");
dotenv.config();

const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "Gmail",
  host: "in-v3.mailjet.com", // Use correct Mailjet SMTP server
  port: 587, // Mailjet supports 587 (STARTTLS) and 465 (SSL)
  secure: false,
  auth: {
    user: process.env.SENDER_MAIL,
    pass: process.env.MAIL_PWD,
  },
  tls: {
    rejectUnauthorized: false, // Ignore self-signed certificate errors
  },
});

const sendMail = async (to, subject, html) => {
  try {
    await transporter.sendMail({
      from: process.env.SENDER_MAIL,
      to,
      subject,
      html,
    });
      console.log(`Mail sent to${to}`)
  } catch (error) {
      console.error(`Error sending mail to${to}`, error.message);
      throw new Error('Failed to sent mail')
  }
};


module.exports = sendMail
