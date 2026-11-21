import Link from 'next/link';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'onBlue' | 'ghostOnBlue';

const VARIANT: Record<ButtonVariant, string> = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  ghost: 'btn-ghost',
  danger: 'btn-danger',
  onBlue: 'btn-on-blue',
  ghostOnBlue: 'btn-ghost-on-blue',
};

interface CommonProps {
  variant?: ButtonVariant;
  size?: 'sm' | 'md';
  /** Leading icon. */
  icon?: IconName;
  /** Square icon-only button — `aria-label` is then required. */
  iconOnly?: boolean;
  /** Trailing arrow that nudges on hover (the landing page's CTA affordance). */
  arrow?: boolean;
  /** Disables the button and swaps the label for `loadingLabel` (or keeps it). */
  loading?: boolean;
  loadingLabel?: ReactNode;
  className?: string;
  children?: ReactNode;
}

type AsButton = CommonProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'children'> & { href?: undefined };
type AsLink = CommonProps & {
  href: string;
  /** Opens in a new tab. */
  external?: boolean;
  title?: string;
  'aria-label'?: string;
  onClick?: () => void;
};

/**
 * The one button. Emits the `.btn-*` classes from globals.css, so legacy
 * `className="btn-primary"` markup and this component always look the same.
 * Pass `href` to render a link with button styling.
 */
export function Button(props: AsButton | AsLink) {
  const {
    variant = 'secondary',
    size = 'md',
    icon,
    iconOnly = false,
    arrow = false,
    loading = false,
    loadingLabel,
    className = '',
    children,
    ...rest
  } = props;
  const cls = [VARIANT[variant], size === 'sm' ? 'btn-sm' : '', iconOnly ? 'btn-icon' : '', className]
    .filter(Boolean)
    .join(' ');
  const content = (
    <>
      {icon && <Icon name={icon} size={size === 'sm' ? 14 : 16} />}
      {!iconOnly && (loading && loadingLabel ? loadingLabel : children)}
      {arrow && (
        <span aria-hidden className="link-arrow">
          →
        </span>
      )}
    </>
  );

  if ('href' in rest && rest.href !== undefined) {
    const { href, external, ...linkRest } = rest;
    return (
      <Link
        href={href}
        className={cls}
        {...(external ? { target: '_blank', rel: 'noopener' } : {})}
        {...linkRest}
      >
        {content}
      </Link>
    );
  }
  const { type = 'button', disabled, ...buttonRest } = rest as AsButton;
  return (
    <button
      type={type}
      className={cls}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...buttonRest}
    >
      {content}
    </button>
  );
}
