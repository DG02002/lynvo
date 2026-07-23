import { z } from "zod"
import {
  PASSWORD_MAX_LENGTH,
  USERNAME_MAX_LENGTH,
  validatePassword,
  validateUsername,
} from "./auth-policy"

const addFieldError = (
  context: z.RefinementCtx,
  path: string,
  message: string
) => {
  context.addIssue({
    code: "custom",
    path: [path],
    message,
  })
}

export const signInSchema = z.object({
  username: z
    .string()
    .trim()
    .min(1, "Username is required.")
    .max(USERNAME_MAX_LENGTH, "Invalid username or password."),
  password: z
    .string()
    .min(1, "Password is required.")
    .max(PASSWORD_MAX_LENGTH, "Invalid username or password."),
})

export const signUpSchema = z
  .object({
    username: z.string(),
    password: z.string(),
    confirmPassword: z.string(),
  })
  .superRefine((value, context) => {
    const usernameError = validateUsername(value.username)
    if (usernameError) {
      addFieldError(context, "username", usernameError)
    }

    const passwordError = validatePassword(value.password, value.username)
    if (passwordError) {
      addFieldError(context, "password", passwordError)
    }

    if (value.password !== value.confirmPassword) {
      addFieldError(context, "confirmPassword", "Passwords do not match.")
    }
  })

export const changePasswordSchema = z
  .object({
    oldPassword: z.string().min(1, "Old password is required."),
    newPassword: z.string(),
    confirmPassword: z.string(),
  })
  .superRefine((value, context) => {
    const passwordError = validatePassword(value.newPassword, "")
    if (passwordError) {
      addFieldError(context, "newPassword", passwordError)
    }

    if (value.newPassword !== value.confirmPassword) {
      addFieldError(context, "confirmPassword", "Passwords do not match.")
    }
  })
