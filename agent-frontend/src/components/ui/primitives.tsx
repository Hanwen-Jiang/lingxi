export function PanelTitle({icon, title}: {icon: React.ReactNode; title: string}) {
  return (
    <div className="flex items-center gap-2 text-sm font-semibold">
      <span className="text-muted">{icon}</span>
      {title}
    </div>
  );
}

export function Field({children, label}: {children: React.ReactNode; label: string}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium text-muted">{label}</span>
      {children}
    </label>
  );
}

export function ReadOnlyField({label, value}: {label: string; value: number | string}) {
  return (
    <div className="space-y-1.5">
      <span className="text-xs font-medium text-muted">{label}</span>
      <div className="readonly-field" title={String(value)}>
        {value}
      </div>
    </div>
  );
}
