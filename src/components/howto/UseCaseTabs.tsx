import { useCallback, useEffect, useRef, useState } from 'react';
import { UseCasePanel } from './UseCasePanel';
import type { UseCase, UseCaseId } from './types';

// Sprint 5D — the tablist.
//
// Local state, no router, no library. The active tab is mirrored into the hash
// as `#/how-to?u=<id>` so a link can open straight onto one use case — that is
// the point for the distribution push (a dbt Slack post links to the dbt tab).
// The query sits AFTER the route segment, so App.tsx's `h.startsWith('/how-to')`
// resolution is unaffected.
//
// Below 640px the five tabs stack vertically (see .safesql-howto-tabs in
// src/index.css); above it they sit in one row.

// Exported for test: resolves which tab is active from a hash. With no ?u=,
// or an unknown id, it must fall back to `fallback` — the default tab — never
// to the first entry in the list.
export function resolveActiveTab(
  hash: string,
  valid: readonly UseCaseId[],
  fallback: UseCaseId,
): UseCaseId {
  const m = /[?&]u=([a-z-]+)/.exec(hash);
  const found = m?.[1] as UseCaseId | undefined;
  return found && valid.includes(found) ? found : fallback;
}

function readHash(valid: readonly UseCaseId[], fallback: UseCaseId): UseCaseId {
  if (typeof window === 'undefined') return fallback;
  return resolveActiveTab(window.location.hash, valid, fallback);
}


export function UseCaseTabs({
  useCases,
  defaultId,
}: {
  useCases: UseCase[];
  defaultId: UseCaseId;
}) {
  const ids = useCases.map((u) => u.id);
  const [active, setActive] = useState<UseCaseId>(() => readHash(ids, defaultId));
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  // Respond to back/forward and to links landing on this page with ?u=.
  useEffect(() => {
    const onHash = () => setActive(readHash(ids, defaultId));
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultId, ids.join(',')]);

  const select = useCallback((id: UseCaseId) => {
    setActive(id);
    try {
      // replaceState, not a hash assignment: switching tabs should not push a
      // history entry per click.
      window.history.replaceState(null, '', `#/how-to?u=${id}`);
    } catch {
      // history may be unavailable in embedded contexts; tab still switches
    }
  }, []);

  // Arrow-key navigation — the difference between a tablist and five buttons.
  const onKeyDown = (e: React.KeyboardEvent) => {
    const i = ids.indexOf(active);
    let next: number | null = null;
    if (e.key === 'ArrowRight') next = (i + 1) % ids.length;
    else if (e.key === 'ArrowLeft') next = (i - 1 + ids.length) % ids.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = ids.length - 1;
    if (next === null) return;
    e.preventDefault();
    const id = ids[next];
    select(id);
    tabRefs.current[id]?.focus();
  };

  const current = useCases.find((u) => u.id === active) ?? useCases[0];

  return (
    <div>
      <div
        role="tablist"
        aria-label="Choose your use case"
        onKeyDown={onKeyDown}
        // Layout lives in .safesql-howto-tabs (src/index.css) because the
        // <640px breakpoint — where the five tabs stack vertically — cannot be
        // expressed as an inline style.
        className="safesql-howto-tabs"
        style={{ marginBottom: 18 }}
      >
        {useCases.map((u) => {
          const on = u.id === active;
          return (
            <button
              key={u.id}
              ref={(el) => {
                tabRefs.current[u.id] = el;
              }}
              id={`howto-tab-${u.id}`}
              role="tab"
              type="button"
              aria-selected={on}
              aria-controls={`howto-panel-${u.id}`}
              tabIndex={on ? 0 : -1}
              onClick={() => select(u.id)}
              style={{
                background: 'transparent',
                border: 'none',
                borderBottom: on ? '2px solid #7c3aed' : '2px solid transparent',
                color: on ? '#e4e4e7' : '#a1a1aa',
                fontSize: 13.5,
                fontWeight: on ? 700 : 500,
                padding: '10px 14px',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                marginBottom: -1,
              }}
            >
              {u.label}
            </button>
          );
        })}
      </div>

      <UseCasePanel useCase={current} />
    </div>
  );
}
