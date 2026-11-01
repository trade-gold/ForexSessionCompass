export function describeAuthError(error: unknown): string {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error ?? "").toLowerCase();
  if (message.includes("already registered") || message.includes("user_already_exists")) {
    return "An account with this email already exists. Log in instead.";
  }
  if (message.includes("invalid login credentials") || message.includes("invalid_grant")) {
    return "Email or password is incorrect.";
  }
  if (message.includes("email not confirmed")) {
    return "Your email address hasn't been confirmed yet. Check your inbox for the confirmation link.";
  }
  if (message.includes("weak_password") || message.includes("password should be at least")) {
    return "Password is too weak. Use at least 8 characters.";
  }
  if (message.includes("rate limit") || message.includes("too many") || message.includes("over_email_send_rate_limit")) {
    return "Too many attempts. Wait a moment and try again.";
  }
  if (message.includes("not authorized") || message.includes("42501") || message.includes("permission denied")) {
    return "You are not authorized to perform this action.";
  }
  if (message.includes("failed to fetch") || message.includes("network")) {
    return "Network error. Check your connection and try again.";
  }
  return "Something went wrong. Please try again.";
}
