import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { useAppUser } from '../hooks/useAppUser';

// Sprint 6B — #/accept-invite?token=… Redeems a team invitation.
//
// Goes through POST /api/teams/accept rather than the browser Supabase client.
// That route runs with the service role, so it can enforce the seat cap, mark
// the invitation used, and raise the joining member's plan to the team's plan —
// none of which the client-side path can do.
//
// The older #/team/join route now renders this same component, so invitation
// links already in inboxes get the better path.

const REDIRECT_MS = 2000;

function tokenFromHash(): string | null {
  const m = /[?&]token=([^&]+)/.exec(window.location.hash);
  return m ? decodeURIComponent(m[1]) : null;
}

type Status = 'signin' | 'accepting' | 'done' | 'error';

export function AcceptInvitePage() {
  const { appUser } = useAppUser();
  const { getToken, isLoaded } = useAuth();
  const [status, setStatus] = useState<Status>('accepting');
  const [teamName, setTeamName] = useState<string>('');
  const [message, setMessage] = useState<string>('');
  const ran = useRef(false);

  const accept = useCallback(async () => {
    const token = tokenFromHash();
    if (!token) {
      setStatus('error');
      setMessage('Invite expired or invalid');
      return;
    }

    let jwt: string | null = null;
    try {
      jwt = await getToken();
    } catch {
      jwt = null;
    }
    if (!jwt) {
      setStatus('error');
      setMessage('Could not verify your session. Try signing in again.');
      return;
    }

    try {
      const res = await fetch('/api/teams/accept', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${jwt}` },
        body: JSON.stringify({
          token,
          email: appUser?.email,
        }),
      });
      const data = (await res.json()) as {
        team?: { name?: string };
        error?: string;
      };

      if (!res.ok) {
        setStatus('error');
        // Show the server's reason (expired, already used, team full) rather
        // than a generic string — each one has a different remedy.
        setMessage(data.error || 'Invite expired or invalid');
        return;
      }

      setTeamName(data.team?.name ?? 'your team');
      setStatus('done');
      setTimeout(() => {
        window.location.hash = '#/team';
      }, REDIRECT_MS);
    } catch {
      setStatus('error');
      setMessage('Could not reach the server. Check your connection and try again.');
    }
  }, [appUser?.email, getToken]);

  useEffect(() => {
    if (ran.current || !isLoaded) return;
    if (!appUser) {
      setStatus('signin'); // wait for Clerk to resolve a signed-in user
      return;
    }
    ran.current = true;
    setStatus('accepting');
    void accept();
  }, [appUser, isLoaded, accept]);

  return (
    <div
      style={{
        background: '#09090b',
        color: '#e4e4e7',
        minHeight: '100vh',
        padding: 32,
        textAlign: 'center',
      }}
    >
      <div style={{ maxWidth: 460, margin: '96px auto 0' }}>
        <a
          href="#/"
          style={{ color: '#a78bfa', textDecoration: 'none', fontSize: 18, fontWeight: 700 }}
        >
          SafeSQL Pro
        </a>

        {status === 'signin' && (
          <>
            <div style={{ fontSize: 34, margin: '28px 0 10px' }}>👥</div>
            <p style={{ color: '#a1a1aa', fontSize: 14.5, lineHeight: 1.6 }}>
              Sign in to accept your team invitation.
            </p>
          </>
        )}

        {status === 'accepting' && (
          <>
            <div style={{ fontSize: 34, margin: '28px 0 10px' }}>⏳</div>
            <p style={{ color: '#a1a1aa', fontSize: 14.5 }}>Accepting your invitation…</p>
          </>
        )}

        {status === 'done' && (
          <>
            <div style={{ fontSize: 34, margin: '28px 0 10px' }}>🎉</div>
            <h1 style={{ fontSize: 22, margin: '0 0 8px' }}>Welcome to {teamName}!</h1>
            <p style={{ color: '#a1a1aa', fontSize: 13.5 }}>Taking you to your team…</p>
            <a
              href="#/team"
              style={{ color: '#a78bfa', fontSize: 13, display: 'inline-block', marginTop: 14 }}
            >
              Go now →
            </a>
          </>
        )}

        {status === 'error' && (
          <>
            <div style={{ fontSize: 34, margin: '28px 0 10px' }}>⚠️</div>
            <h1 style={{ fontSize: 20, margin: '0 0 8px' }}>Invite expired or invalid</h1>
            <p style={{ color: '#a1a1aa', fontSize: 13.5, lineHeight: 1.6 }}>{message}</p>
            <p style={{ color: '#71717a', fontSize: 12.5, marginTop: 14 }}>
              Ask whoever invited you to send a new invitation.
            </p>
            <a
              href="#/editor"
              style={{ color: '#a78bfa', fontSize: 13, display: 'inline-block', marginTop: 14 }}
            >
              Open the editor →
            </a>
          </>
        )}
      </div>
    </div>
  );
}
