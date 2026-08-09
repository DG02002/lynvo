import { SignInForm } from "~/components/auth/SignInForm"
import { authCopy } from "~/features/auth/auth.copy"

export function meta() {
  return [
    { title: authCopy.signin.metaTitle },
    { name: "description", content: authCopy.signin.metaDescription },
  ]
}

export default function SignIn() {
  return <SignInForm />
}
