import type { User } from '@supabase/supabase-js';

const getMetaString = (meta: Record<string, unknown>, key: string): string | undefined => {
  const value = meta[key];
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const buildFullName = (meta: Record<string, unknown>): string | undefined => {
  const fullName = getMetaString(meta, 'full_name');
  if (fullName) {
    return fullName;
  }

  const firstName = getMetaString(meta, 'first_name');
  const lastName = getMetaString(meta, 'last_name');
  const parts = [firstName, lastName].filter(Boolean);
  if (parts.length === 0) {
    return undefined;
  }
  return parts.join(' ');
};

const emailUsername = (email: string | undefined): string | undefined => {
  if (!email) {
    return undefined;
  }
  const [local] = email.split('@');
  const trimmed = local?.trim();
  return trimmed ? trimmed : undefined;
};

const deriveInitials = (fullName: string | undefined, email: string | undefined): string => {
  if (fullName) {
    const nameParts = fullName
      .split(/\s+/)
      .map((part) => part.trim())
      .filter(Boolean);
    if (nameParts.length > 0) {
      const first = nameParts[0]?.[0] ?? '';
      const last = nameParts.length > 1 ? nameParts[nameParts.length - 1]?.[0] ?? '' : nameParts[0]?.[1] ?? '';
      const initials = `${first}${last}`.slice(0, 2);
      if (initials.trim()) {
        return initials.toUpperCase();
      }
    }
  }

  const username = emailUsername(email);
  const fallback = username ? username.slice(0, 2) : '??';
  return fallback.toUpperCase();
};

export const getUserProfile = (user: User | null) => {
  const meta = (user?.user_metadata ?? {}) as Record<string, unknown>;
  const email = typeof user?.email === 'string' ? user.email : undefined;
  const avatarUrl = getMetaString(meta, 'avatar_url') ?? getMetaString(meta, 'picture') ?? null;
  const fullName = buildFullName(meta);

  const displayName = fullName ?? email ?? 'Your profile';
  const initials = deriveInitials(fullName, email);

  return {
    displayName,
    email: email ?? 'Unknown email',
    avatarUrl,
    initials,
  };
};
