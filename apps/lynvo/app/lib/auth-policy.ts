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

export const getUsernameValidationErrors = (username: string) => {
  const errors: string[] = []
  const normalized = normalizeUsername(username)
  if (normalized.length < USERNAME_MIN_LENGTH) {
    errors.push(`Username must be at least ${USERNAME_MIN_LENGTH} characters.`)
  } else if (normalized.length > USERNAME_MAX_LENGTH) {
    errors.push(`Username must be at most ${USERNAME_MAX_LENGTH} characters.`)
  } else if (!USERNAME_PATTERN.test(normalized)) {
    errors.push(
      "Username can only use letters, numbers, underscore, and hyphen."
    )
  } else if (RESERVED_USERNAMES.has(normalized)) {
    errors.push("This username is reserved.")
  }
  return errors
}

export const validateUsername = (username: string): string | null =>
  getUsernameValidationErrors(username)[0] ?? null

export const getPasswordValidationErrors = (
  password: string,
  username?: string
): string[] => {
  const errors: string[] = []
  if (password.length < PASSWORD_MIN_LENGTH) {
    errors.push(`Password must be at least ${PASSWORD_MIN_LENGTH} characters.`)
  } else if (password.length > PASSWORD_MAX_LENGTH) {
    errors.push(`Password must be at most ${PASSWORD_MAX_LENGTH} characters.`)
  }
  if (!/[A-Z]/.test(password)) {
    errors.push("Password must include an uppercase letter.")
  }
  if (!/[a-z]/.test(password)) {
    errors.push("Password must include a lowercase letter.")
  }
  const lower = password.toLowerCase()
  const normalizedUsername = username ? normalizeUsername(username) : ""
  if (normalizedUsername && lower.includes(normalizedUsername)) {
    errors.push("Password cannot contain your username.")
  }
  if (/(.)\1{5,}/.test(password)) {
    errors.push("Password is too repetitive.")
  }
  if (WEAK_PASSWORD_PATTERNS.includes(lower)) {
    errors.push("Password is too common.")
  }
  return errors
}

export const validatePassword = (
  password: string,
  username?: string
): string | null => getPasswordValidationErrors(password, username)[0] ?? null
