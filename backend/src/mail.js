import nodemailer from "nodemailer";

export async function sendOtp(email, code) {
  console.log(`\n[PupilsWeb] Password reset code for ${email}: ${code}\n`);
  if (!process.env.SMTP_HOST) return { emailed: false };

  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS || "" }
      : undefined,
  });

  await transport.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: email,
    subject: "Your PupilsWeb code",
    text: `Your password reset code is ${code}. It expires in 10 minutes.`,
  });
  return { emailed: true };
}
