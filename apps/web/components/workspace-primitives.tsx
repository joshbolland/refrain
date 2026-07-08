'use client';

import type { ComponentType, ReactNode } from 'react';

import type { LucideProps } from 'lucide-react';

export const cx = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' ');

export function AppFrame({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cx('flex h-full min-h-0 flex-col overflow-hidden', className)}>{children}</section>;
}

export function HeaderBand({
  eyebrow,
  title,
  subtitle,
  meta,
  actions,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  meta?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="border-b border-divider bg-header px-5 py-4 md:px-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          {eyebrow ? (
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted/70">{eyebrow}</p>
          ) : null}
          <div className="mt-1 flex flex-wrap items-end gap-x-3 gap-y-1">
            <h1 className="text-[28px] font-semibold leading-tight text-headerTitle">{title}</h1>
            {meta}
          </div>
          {subtitle ? <p className="mt-1 max-w-2xl text-sm leading-6 text-headerSubtitle">{subtitle}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}

export function Pane({
  children,
  className,
  scroll = false,
}: {
  children: ReactNode;
  className?: string;
  scroll?: boolean;
}) {
  return (
    <div
      data-refrain-pane="true"
      className={cx(
        'h-full min-h-0 max-h-full border-divider bg-paper',
        scroll && 'overflow-y-auto',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function ToolbarIconButton({
  label,
  icon: Icon,
  onClick,
  disabled,
  variant = 'secondary',
  type = 'button',
}: {
  label: string;
  icon: ComponentType<LucideProps>;
  onClick?: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'danger';
  type?: 'button' | 'submit';
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={cx(
        'inline-flex size-9 items-center justify-center rounded-lg border text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-50',
        variant === 'primary' && 'border-accent bg-accent text-white hover:bg-accentPressed',
        variant === 'secondary' && 'border-divider bg-paper text-muted hover:border-accent hover:text-ink',
        variant === 'danger' && 'border-divider bg-paper text-muted hover:border-danger hover:text-danger',
      )}
    >
      <Icon size={17} />
    </button>
  );
}

export function TextActionButton({
  children,
  onClick,
  disabled,
  variant = 'secondary',
  type = 'button',
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'danger';
  type?: 'button' | 'submit';
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cx(
        'inline-flex min-h-9 items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] transition disabled:cursor-not-allowed disabled:opacity-50',
        variant === 'primary' && 'border-accent bg-accent text-white hover:bg-accentPressed',
        variant === 'secondary' && 'border-divider bg-paper text-muted hover:border-accent hover:text-ink',
        variant === 'danger' && 'border-divider bg-paper text-muted hover:border-danger hover:text-danger',
      )}
    >
      {children}
    </button>
  );
}

export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  className,
}: {
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div className={cx('grid overflow-hidden rounded-lg border border-divider bg-paper', className)}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={cx(
            'min-h-11 border-r border-divider px-3 py-2 text-sm font-medium transition last:border-r-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent md:min-h-9 md:text-xs',
            value === option.value ? 'bg-accentSoft text-accentPressed' : 'text-muted hover:bg-canvas hover:text-ink',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function NativeListRow({
  title,
  subtitle,
  meta,
  icon,
  active,
  onClick,
}: {
  title: string;
  subtitle?: string;
  meta?: ReactNode;
  icon?: ReactNode;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        'flex w-full items-center gap-3 border-b border-divider px-5 py-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent',
        active ? 'bg-accentSoft' : 'bg-transparent hover:bg-canvas',
      )}
    >
      {icon ? (
        <span
          className={cx(
            'flex size-11 shrink-0 items-center justify-center rounded-lg border md:size-9',
            active ? 'border-accent/30 bg-paper text-accentPressed' : 'border-divider bg-paper text-muted',
          )}
        >
          {icon}
        </span>
      ) : null}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-base font-medium text-ink md:text-sm">{title}</span>
        {subtitle ? (
          <span className="mt-1 block truncate text-[13px] leading-5 text-muted/70 md:text-xs">
            {subtitle}
          </span>
        ) : null}
      </span>
      {meta ? <span className="shrink-0 text-xs font-semibold text-muted/70">{meta}</span> : null}
    </button>
  );
}
