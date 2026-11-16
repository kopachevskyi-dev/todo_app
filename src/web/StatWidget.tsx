import { useId } from 'react';

export function StatWidget({
  title,
  badge,
  number,
  unit,
  fill,
  progress,
}: {
  title: string;
  badge: string;
  number: number;
  unit: string;
  fill: number;
  progress?: { label: string; value: number; max: number };
}) {
  const titleId = useId();
  return (
    <section className="stat-widget widget-card" aria-labelledby={titleId}>
      <div className="widget-heading">
        <h2 id={titleId}>{title}</h2>
        <span className="widget-badge">{badge}</span>
      </div>
      <div className="widget-number">
        <span>{number}</span>
        <span>{unit}</span>
      </div>
      <div
        className="progress-track"
        role="progressbar"
        aria-label={progress?.label ?? title}
        aria-valuemin={0}
        aria-valuemax={progress?.max ?? 100}
        aria-valuenow={progress?.value ?? fill}
      >
        <div className="progress-fill" style={{ width: `${fill}%` }} />
      </div>
    </section>
  );
}
