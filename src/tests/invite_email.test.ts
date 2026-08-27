import { describe, expect, it } from 'vitest';
import {
  acceptInviteUrl,
  inviteEmailHtml,
  inviteEmailText,
  inviteSubject,
} from '../../functions/api/teams/inviteEmail';

// Sprint 6B — invitation email copy and URL construction.

const INPUT = {
  teamName: 'Acme Data',
  inviterName: 'Priya Raman',
  acceptUrl: 'https://safesqlpro.dev/#/accept-invite?token=abc123',
};

describe('inviteSubject', () => {
  it('matches the specified subject line', () => {
    expect(inviteSubject('Acme Data')).toBe(
      "You've been invited to join Acme Data on SafeSQL Pro",
    );
  });
});

describe('acceptInviteUrl', () => {
  it('builds the canonical accept URL', () => {
    expect(acceptInviteUrl('https://safesqlpro.dev', 'abc123')).toBe(
      'https://safesqlpro.dev/#/accept-invite?token=abc123',
    );
  });

  it('encodes tokens containing URL-significant characters', () => {
    expect(acceptInviteUrl('https://safesqlpro.dev', 'a+b/c=d')).toContain('a%2Bb%2Fc%3Dd');
  });
});

describe('inviteEmailHtml', () => {
  const html = inviteEmailHtml(INPUT);

  it('names the inviter and the team', () => {
    expect(html).toContain('Priya Raman');
    expect(html).toContain('Acme Data');
  });

  it('carries the accept button and the fallback link', () => {
    expect(html).toContain('Accept Invite');
    // href plus the paste-it-yourself copy at the foot
    expect(html.match(/https:\/\/safesqlpro\.dev\/#\/accept-invite\?token=abc123/g)?.length).toBe(2);
  });

  it('states the 7-day expiry and the ignore-if-unexpected line', () => {
    expect(html).toContain('expires in 7 days');
    expect(html).toContain("didn't expect this invitation");
  });

  it('signs off as specified', () => {
    expect(html).toContain('The SafeSQL Pro team');
    expect(html).toContain('safesqlpro.dev');
  });

  it('escapes HTML in a team name — team names are user input', () => {
    const evil = inviteEmailHtml({ ...INPUT, teamName: '<script>alert(1)</script>' });
    expect(evil).not.toContain('<script>');
    expect(evil).toContain('&lt;script&gt;');
  });

  it('escapes HTML in an inviter display name', () => {
    const evil = inviteEmailHtml({ ...INPUT, inviterName: '"><img src=x onerror=y>' });
    expect(evil).not.toContain('<img src=x');
  });
});

describe('inviteEmailText', () => {
  it('provides a plain-text alternative with the same essentials', () => {
    const text = inviteEmailText(INPUT);
    expect(text).toContain('Priya Raman');
    expect(text).toContain('Acme Data');
    expect(text).toContain(INPUT.acceptUrl);
    expect(text).toContain('expires in 7 days');
    expect(text).not.toContain('<');
  });
});
