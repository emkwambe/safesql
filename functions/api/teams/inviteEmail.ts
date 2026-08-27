// Sprint 6B — team invitation email.
//
// Pure functions, no Env and no fetch, so the copy and the URL construction are
// unit-testable without a mail provider. The sending itself lives in
// _shared.ts sendEmail().

export interface InviteEmailInput {
  teamName: string;
  /** Display name of the inviter, falling back to their email. */
  inviterName: string;
  /** Absolute accept URL, including the token. */
  acceptUrl: string;
  /** Days until the invitation expires. Matches team_invitations.expires_at. */
  expiresInDays?: number;
}

export function inviteSubject(teamName: string): string {
  return `You've been invited to join ${teamName} on SafeSQL Pro`;
}

/** Escape interpolated values: team names and display names are user input. */
function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function inviteEmailHtml(input: InviteEmailInput): string {
  const { teamName, inviterName, acceptUrl, expiresInDays = 7 } = input;
  const team = esc(teamName);
  const inviter = esc(inviterName);

  // Table-based layout and inline styles: Outlook and Gmail strip <style>
  // blocks and do not support flex/grid.
  return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:10px;padding:32px;">
          <tr>
            <td style="font-size:18px;font-weight:700;color:#7c3aed;padding-bottom:20px;">
              SafeSQL Pro
            </td>
          </tr>
          <tr>
            <td style="font-size:15px;line-height:1.6;color:#27272a;">
              <p style="margin:0 0 16px;">Hi,</p>

              <p style="margin:0 0 16px;">
                <strong>${inviter}</strong> has invited you to join <strong>${team}</strong>
                on SafeSQL Pro — semantic SQL validation for your entire team.
              </p>

              <p style="margin:0 0 24px;">
                SafeSQL Pro catches dangerous SQL before it runs: wrong JOINs,
                hallucinated AI columns, fan-out aggregates that silently corrupt
                your data.
              </p>

              <p style="margin:0 0 12px;font-weight:600;">Accept your invitation:</p>

              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 26px;">
                <tr>
                  <td style="background:#7c3aed;border-radius:6px;">
                    <a href="${acceptUrl}"
                       style="display:inline-block;padding:12px 24px;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;">
                      Accept Invite &rarr;
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 6px;font-size:13px;color:#71717a;">
                This invitation expires in ${expiresInDays} days.
              </p>
              <p style="margin:0 0 24px;font-size:13px;color:#71717a;">
                If you didn't expect this invitation, you can ignore this email.
              </p>

              <p style="margin:0;font-size:13px;color:#71717a;">
                — The SafeSQL Pro team<br />
                <a href="https://safesqlpro.dev" style="color:#7c3aed;text-decoration:none;">safesqlpro.dev</a>
              </p>
            </td>
          </tr>
        </table>

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
          <tr>
            <td style="padding:16px 8px;font-size:11px;color:#a1a1aa;line-height:1.5;">
              If the button does not work, paste this link into your browser:<br />
              <span style="color:#71717a;word-break:break-all;">${acceptUrl}</span>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/** Plain-text alternative for clients that refuse HTML. */
export function inviteEmailText(input: InviteEmailInput): string {
  const { teamName, inviterName, acceptUrl, expiresInDays = 7 } = input;
  return [
    'Hi,',
    '',
    `${inviterName} has invited you to join ${teamName} on SafeSQL Pro —`,
    'semantic SQL validation for your entire team.',
    '',
    'SafeSQL Pro catches dangerous SQL before it runs: wrong JOINs,',
    'hallucinated AI columns, fan-out aggregates that silently corrupt your data.',
    '',
    'Accept your invitation:',
    acceptUrl,
    '',
    `This invitation expires in ${expiresInDays} days.`,
    "If you didn't expect this invitation, you can ignore this email.",
    '',
    '— The SafeSQL Pro team',
    'safesqlpro.dev',
  ].join('\n');
}

/** Canonical accept URL. One definition, so the email and the route agree. */
export function acceptInviteUrl(origin: string, token: string): string {
  return `${origin}/#/accept-invite?token=${encodeURIComponent(token)}`;
}
