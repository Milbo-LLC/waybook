import { env } from "./env.js";

type InviteEmailInput = {
  to: string;
  inviterName: string;
  waybookTitle: string;
  acceptUrl: string;
  role: "editor" | "viewer";
};

export const sendInviteEmail = async (input: InviteEmailInput) => {
  if (!env.RESEND_API_KEY || !env.INVITE_EMAIL_FROM) {
    throw new Error("invite_email_not_configured");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: env.INVITE_EMAIL_FROM,
      to: [input.to],
      reply_to: env.INVITE_EMAIL_REPLY_TO,
      subject: `${input.inviterName} invited you to join "${input.waybookTitle}" on Waybook`,
      html: `
        <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;line-height:1.5;color:#0f172a">
          <h2 style="margin:0 0 12px">You've been invited to a Waybook trip</h2>
          <p style="margin:0 0 12px"><strong>${input.inviterName}</strong> invited you as a <strong>${input.role}</strong> on <strong>${input.waybookTitle}</strong>.</p>
          <p style="margin:0 0 16px">
            <a href="${input.acceptUrl}" style="display:inline-block;background:#14532d;color:#fff;text-decoration:none;padding:10px 14px;border-radius:8px">
              Accept Invite
            </a>
          </p>
          <p style="margin:0;color:#475569;font-size:13px">If the button doesn’t work, open this link: ${input.acceptUrl}</p>
        </div>
      `
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`invite_email_failed:${response.status}:${errorText}`);
  }
};
