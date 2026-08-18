import { verifyPasswordSecret } from "./passwordCrypto"

export interface CredentialsAccount<UserId extends string = string> {
  readonly userId: UserId
  readonly secret?: string
  readonly passwordChangePendingAt?: number
}

export const verifyCredentialsAccount = async <UserId extends string>(
  account: CredentialsAccount<UserId> | undefined,
  password: string
) => {
  if (
    !account?.secret ||
    !(await verifyPasswordSecret(password, account.secret))
  ) {
    return { kind: "invalid-credentials" as const }
  }
  return { kind: "authenticated" as const, account }
}
