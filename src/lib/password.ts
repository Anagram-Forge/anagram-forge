/** Rules for a new password. Login still accepts older shorter ones. */
export function passwordIssue(password: string): string | null {
  if (password.length > 128) return "Password is too long.";
  const pass = password.trim();
  if (pass.length < 10) return "Password needs 10 characters.";
  if (pass.length > 128) return "Password is too long.";
  if ([...pass].every((c) => c === pass[0])) return "Use more than one character.";
  return null;
}
