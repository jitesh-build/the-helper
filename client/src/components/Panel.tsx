import type { ReactNode } from 'react';

interface PanelProps {
  title: string;
  right?: ReactNode;
  children: ReactNode;
}

export function Panel({ title, right, children }: PanelProps) {
  return (
    <section className="panel min-w-0">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="panel-title min-w-0 break-words">{title}</h2>
        {right}
      </div>
      {children}
    </section>
  );
}