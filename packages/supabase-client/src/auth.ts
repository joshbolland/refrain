export const accountConflictMessage =
  'An account already exists for this email. Sign in using your existing method, then link Google from Profile > Settings.';

export const isAccountConflict = (message: string) => {
  const normalized = message.toLowerCase();
  return (
    normalized.includes('already registered') ||
    normalized.includes('already exists') ||
    normalized.includes('already a user with this email') ||
    normalized.includes('identity is already linked') ||
    normalized.includes('identity already exists') ||
    normalized.includes('linked to a different user') ||
    normalized.includes('users_email_key')
  );
};

export const formatAuthError = (message?: string | null) => {
  if (!message) {
    return 'Unable to complete the request. Please try again.';
  }
  if (isAccountConflict(message)) {
    return accountConflictMessage;
  }
  return message;
};
