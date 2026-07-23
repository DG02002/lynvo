import { z } from "zod"
import {
  getPasswordValidationErrors,
  getUsernameValidationErrors,
  PASSWORD_MAX_LENGTH,
  USERNAME_MAX_LENGTH,
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

const accountUsernameSchema = z.string().superRefine((username, context) => {
  for (const message of getUsernameValidationErrors(username)) {
    context.addIssue({ code: "custom", message })
  }
})

const accountPasswordSchema = z.string().superRefine((password, context) => {
  for (const message of getPasswordValidationErrors(password)) {
    context.addIssue({ code: "custom", message })
  }
})

export const signInSchema = z.strictObject({
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
  .strictObject({
    username: accountUsernameSchema,
    password: accountPasswordSchema,
    confirmPassword: z.string(),
  })
  .superRefine((value, context) => {
    const independentPasswordErrors = new Set(
      getPasswordValidationErrors(value.password)
    )
    for (const message of getPasswordValidationErrors(
      value.password,
      value.username
    )) {
      if (!independentPasswordErrors.has(message)) {
        addFieldError(context, "password", message)
      }
    }

    if (value.password !== value.confirmPassword) {
      addFieldError(context, "confirmPassword", "Passwords do not match.")
    }
  })

export const changePasswordSchema = z
  .strictObject({
    oldPassword: z.string().min(1, "Old password is required."),
    newPassword: accountPasswordSchema,
    confirmPassword: z.string(),
  })
  .superRefine((value, context) => {
    if (value.newPassword !== value.confirmPassword) {
      addFieldError(context, "confirmPassword", "Passwords do not match.")
    }
  })
