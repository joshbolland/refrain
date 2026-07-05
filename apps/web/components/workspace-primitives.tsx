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
        'inline-flex h-9 w-9 items-center justify-center rounded-xl border text-sm transition disabled:cursor-not-allowed disabled:opacity-50',
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
    <div className={cx('grid rounded-xl border border-divider bg-canvas p-1', className)}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={cx(
            'rounded-lg px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] transition',
            value === option.value ? 'bg-paper text-accentPressed shadow-soft' : 'text-muted hover:text-ink',
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
        'flex w-full items-start gap-3 rounded-2xl border px-3 py-3 text-left transition',
        active ? 'border-accent/50 bg-accentSoft' : 'border-transparent bg-transparent hover:border-divider hover:bg-paper',
      )}
    >
      {icon ? (
        <span
          className={cx(
            'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
            active ? 'bg-paper text-accentPressed' : 'bg-panel text-muted',
          )}
        >
          {icon}
        </span>
      ) : null}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-ink">{title}</span>
        {subtitle ? (
          <span className="mt-1 block max-h-10 overflow-hidden text-sm leading-5 text-muted/80 [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]">
            {subtitle}
          </span>
        ) : null}
      </span>
      {meta ? <span className="shrink-0 text-xs font-semibold text-muted/70">{meta}</span> : null}
    </button>
  );
}
