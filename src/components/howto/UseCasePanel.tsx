import { StepCard } from './StepCard';
import type { UseCase } from './types';

// Sprint 5D — the body for one selected use case.
//
// Only the active panel is mounted (see UseCaseTabs), so there is no hidden
// DOM and no offscreen code blocks holding clipboard timers.

export function UseCasePanel({ useCase }: { useCase: UseCase }) {
  return (
    <div
      id={`howto-panel-${useCase.id}`}
      role="tabpanel"
      aria-labelledby={`howto-tab-${useCase.id}`}
      style={{
        background: '#18181b',
        border: '1px solid #27272a',
        borderRadius: 10,
        padding: '20px 22px',
      }}
    >
      <div style={{ fontSize: 12, color: '#7c3aed', fontWeight: 700, letterSpacing: 0.4 }}>
        {useCase.persona.toUpperCase()}
      </div>
      <p
        style={{
          fontSize: 16,
          color: '#e4e4e7',
          lineHeight: 1.55,
          margin: '8px 0 0',
          fontWeight: 500,
        }}
      >
        {useCase.problem}
      </p>

      <div style={{ marginTop: 6 }}>
        {useCase.steps.map((step, i) => (
          <StepCard key={step.title} step={step} index={i} />
        ))}
      </div>

      <div
        style={{
          borderLeft: '3px solid #22c55e',
          background: '#0f0f11',
          borderRadius: 6,
          padding: '12px 14px',
          marginTop: 18,
          fontSize: 13.5,
          color: '#d4d4d8',
          lineHeight: 1.6,
        }}
      >
        <strong style={{ color: '#e4e4e7' }}>Result: </strong>
        {useCase.outcome}
      </div>
    </div>
  );
}
