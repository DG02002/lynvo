import { SignupForm } from "~/components/auth/SignupForm"
import { authCopy } from "~/features/auth/auth.copy"

export function meta() {
  return [
    { title: authCopy.signup.metaTitle },
    { name: "description", content: authCopy.signup.metaDescription },
  ]
}

export default function Signup() {
  return <SignupForm />
}
