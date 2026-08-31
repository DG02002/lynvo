import { toast } from "~/components/ui/toast"

interface ToastNotificationInput {
  title: string
  description?: string
}

export const showSuccessToast = ({
  title,
  description,
}: ToastNotificationInput) => {
  return toast.add({ type: "success", title, description })
}

export const showErrorToast = ({
  title,
  description,
}: ToastNotificationInput) => {
  return toast.add({ type: "error", title, description, priority: "high" })
}

export const showWarningToast = ({
  title,
  description,
}: ToastNotificationInput) => {
  return toast.add({ type: "warning", title, description })
}

export const showInfoToast = ({
  title,
  description,
}: ToastNotificationInput) => {
  return toast.add({ type: "info", title, description })
}

export const showLinkCopiedToast = () => {
  return toast.add({ type: "success", title: "Link copied" })
}
