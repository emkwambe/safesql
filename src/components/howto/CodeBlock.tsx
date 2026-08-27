import { useCallback, useEffect, useRef, useState } from 'react';
import type { CodeSnippet } from './types';

// Sprint 5D — copy-pasteable code block.
//
// Deliberately no syntax highlighter: Prism/Shiki would add 40-100 KB to a page
// whose entire job is copy-paste, on a product that argues against dependencies
// you do not need.
//
// Code never wraps — a wrapped shell command is a broken shell command — so the
// <pre> scrolls horizontally at every viewport width. The page body itself never
// scrolls horizontally.

const LANG_LABEL: Record<string, string> = {
  bash: 'shell',
  yaml: 'yaml',
  sql: 'sql',
  json: 'json',
  text: '',
};

export function CodeBlock({ lang, caption, code, isOutput }: CodeSnippet) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear the pending reset if the block unmounts (tab switch) mid-timeout.
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      // Non-secure context (plain http, some embedded webviews) has no
      // clipboard API. Fall back rather than silently doing nothing.
      try {
        const ta = document.createElement('textarea');
        ta.value = code;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      } catch {
        return; // give up quietly; the code is still selectable by hand
      }
    }
    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 1500);
  }, [code]);

  const label = LANG_LABEL[lang] ?? lang;

  return (
    <figure style={{ margin: '12px 0 0' }}>
      {(caption || !isOutput) && (
        <figcaption
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            marginBottom: 6,
          }}
        >
          <span style={{ fontSize: 12, color: '#a1a1aa' }}>
            {caption ?? (isOutput ? 'Output' : '')}
            {label && (
              <span style={{ color: '#52525b', marginLeft: 8, fontSize: 11 }}>{label}</span>
            )}
          </span>
          {!isOutput && (
            <button
              type="button"
              onClick={() => void copy()}
              aria-label={copied ? 'Copied' : 'Copy to clipboard'}
              style={{
                background: 'transparent',
                border: '1px solid #27272a',
                color: copied ? '#22c55e' : '#a1a1aa',
                borderRadius: 5,
                padding: '3px 9px',
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {copied ? 'Copied ✓' : 'Copy'}
            </button>
          )}
        </figcaption>
      )}
      <pre
        style={{
          margin: 0,
          background: isOutput ? '#0c0c0e' : '#0f0f11',
          border: '1px solid #27272a',
          borderRadius: 8,
          padding: '12px 14px',
          overflowX: 'auto',
          fontSize: 12.5,
          lineHeight: 1.6,
          color: isOutput ? '#71717a' : '#d4d4d8',
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
        }}
      >
        <code>{code}</code>
      </pre>
    </figure>
  );
}
