export const USERNAME_MIN_LENGTH = 6
export const USERNAME_MAX_LENGTH = 30
export const PASSWORD_MIN_LENGTH = 11
export const PASSWORD_MAX_LENGTH = 128

const USERNAME_PATTERN = /^[a-z0-9_-]+$/

const RESERVED_USERNAMES = new Set([
  "account",
  "admin",
  "api",
  "auth",
  "login",
  "root",
  "save",
  "settings",
  "signup",
  "support",
  "system",
  "tv",
])

const WEAK_PASSWORD_PATTERNS = [
  "password",
  "password123",
  "password123!",
  "qwerty",
  "qwerty123",
  "abcdef",
  "123456",
  "123456789",
  "letmein",
  "welcome",
  "admin",
  "admin123",
  "lynvo",
]

export const normalizeUsername = (username: string) =>
  username.trim().toLowerCase()

export const validateUsername = (username: string): string | null => {
  const normalized = normalizeUsername(username)
  if (normalized.length < USERNAME_MIN_LENGTH) {
    return `Username must be at least ${USERNAME_MIN_LENGTH} characters.`
  }
  if (normalized.length > USERNAME_MAX_LENGTH) {
    return `Username must be at most ${USERNAME_MAX_LENGTH} characters.`
  }
  if (!USERNAME_PATTERN.test(normalized)) {
    return "Username can only use letters, numbers, underscore, and hyphen."
  }
  if (RESERVED_USERNAMES.has(normalized)) {
    return "This username is reserved."
  }
  return null
}

export const validatePassword = (
  password: string,
  username?: string
): string | null => {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    return `Password must be at most ${PASSWORD_MAX_LENGTH} characters.`
  }
  if (!/[A-Z]/.test(password)) {
    return "Password must include an uppercase letter."
  }
  if (!/[a-z]/.test(password)) {
    return "Password must include a lowercase letter."
  }
  const lower = password.toLowerCase()
  const normalizedUsername = username ? normalizeUsername(username) : ""
  if (normalizedUsername && lower.includes(normalizedUsername)) {
    return "Password cannot contain your username."
  }
  if (/(.)\1{5,}/.test(password)) {
    return "Password is too repetitive."
  }
  if (WEAK_PASSWORD_PATTERNS.includes(lower)) {
    return "Password is too common."
  }
  return null
}
