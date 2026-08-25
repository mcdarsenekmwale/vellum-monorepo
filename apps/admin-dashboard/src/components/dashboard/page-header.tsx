import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
}: {
  title: string;
  description?: ReactNode | string | null;
  actions?: ReactNode;
  eyebrow?: string;
}) {

  function renderDescription() {
    if (typeof description === 'string') {
      return (<p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">{description}</p>);
    }
    if (!description) {
      return null;
    }
    if (typeof description === 'object') {
      return description;
    }
    return <div className="mt-1.5 max-w-2xl text-sm text-muted-foreground">{description}</div>;
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 pb-6">
      <div className="min-w-0">
        {eyebrow && (
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            {eyebrow}
          </div>
        )}
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-[26px]">
          {title}
        </h1>
        {renderDescription()}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
