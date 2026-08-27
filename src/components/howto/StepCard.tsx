import { CodeBlock } from './CodeBlock';
import type { Step } from './types';

// Sprint 5D — one numbered step inside a use-case panel.
//
// Named StepCard like the local helper in Landing.tsx, but a different
// component in a different module: this one carries code snippets and a step
// number rail. The Landing one is a three-across marketing card.

export function StepCard({ step, index }: { step: Step; index: number }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '28px 1fr',
        gap: 14,
        padding: '18px 0',
        borderTop: index === 0 ? 'none' : '1px solid #1f1f23',
      }}
    >
      <div
        aria-hidden
        style={{
          width: 28,
          height: 28,
          borderRadius: 999,
          background: '#1e1b31',
          border: '1px solid #7c3aed',
          color: '#a78bfa',
          fontSize: 12.5,
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {index + 1}
      </div>

      <div style={{ minWidth: 0 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, color: '#e4e4e7', margin: '3px 0 6px' }}>
          {step.title}
        </h3>
        <p style={{ fontSize: 13.5, color: '#a1a1aa', lineHeight: 1.65, margin: 0 }}>{step.body}</p>
        {step.snippets?.map((s, i) => (
          <CodeBlock key={i} {...s} />
        ))}
      </div>
    </div>
  );
}
