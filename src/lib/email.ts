import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || "465"),
  secure: true, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
});

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail({ to, subject, html }: SendEmailOptions) {
  const mailOptions = {
    from: process.env.SMTP_FROM || "MyXploit <noreply@myxploit.fr>",
    to,
    subject,
    html,
  };

  return transporter.sendMail(mailOptions);
}

export async function sendInvitationEmail(
  email: string,
  firstName: string | null,
  token: string
) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://myxploit.fr";
  const inviteUrl = `${appUrl}/set-password?token=${token}`;
  const name = firstName || "Utilisateur";

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
      <table role="presentation" style="width: 100%; border-collapse: collapse;">
        <tr>
          <td align="center" style="padding: 40px 0;">
            <table role="presentation" style="width: 100%; max-width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
              <!-- Header -->
              <tr>
                <td style="padding: 40px 40px 20px; text-align: center;">
                  <h1 style="margin: 0; font-size: 28px; font-weight: 700; color: #1a1a1a;">
                    MyXploit
                  </h1>
                </td>
              </tr>

              <!-- Content -->
              <tr>
                <td style="padding: 20px 40px;">
                  <h2 style="margin: 0 0 20px; font-size: 22px; font-weight: 600; color: #1a1a1a;">
                    Bienvenue ${name} !
                  </h2>
                  <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.6; color: #4a4a4a;">
                    Vous avez été invité(e) à rejoindre MyXploit, la plateforme de gestion de patrimoine technique.
                  </p>
                  <p style="margin: 0 0 30px; font-size: 16px; line-height: 1.6; color: #4a4a4a;">
                    Cliquez sur le bouton ci-dessous pour créer votre mot de passe et accéder à votre compte :
                  </p>

                  <!-- CTA Button -->
                  <table role="presentation" style="width: 100%; border-collapse: collapse;">
                    <tr>
                      <td align="center" style="padding: 10px 0 30px;">
                        <a href="${inviteUrl}"
                           style="display: inline-block; padding: 14px 32px; background-color: #10b981; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; border-radius: 8px;">
                          Créer mon mot de passe
                        </a>
                      </td>
                    </tr>
                  </table>

                  <p style="margin: 0 0 10px; font-size: 14px; color: #6b6b6b;">
                    Ce lien expire dans 7 jours.
                  </p>
                  <p style="margin: 0; font-size: 14px; color: #6b6b6b;">
                    Si vous n'avez pas demandé cette invitation, vous pouvez ignorer cet email.
                  </p>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="padding: 30px 40px; border-top: 1px solid #e5e5e5;">
                  <p style="margin: 0; font-size: 12px; color: #9a9a9a; text-align: center;">
                    © ${new Date().getFullYear()} MyXploit. Tous droits réservés.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  return sendEmail({
    to: email,
    subject: "Invitation à rejoindre MyXploit",
    html,
  });
}
