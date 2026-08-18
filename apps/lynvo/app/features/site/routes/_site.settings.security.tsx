import { ArrowLeft01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  redirect,
  useLoaderData,
  useNavigate,
  useOutletContext,
  type LoaderFunctionArgs,
} from "react-router"
import { Button } from "~/components/ui/button"
import { SecuritySettings } from "~/features/site/settings/security-settings"
import { getSettingsPath } from "~/features/site/settings/settings-route"
import type { SettingsOutletContext } from "./_site.settings"

export const loader = ({ params }: LoaderFunctionArgs) => {
  if (params.subview && params.subview !== "active-sessions") {
    throw redirect("/settings/security")
  }
  return { showActiveSessions: params.subview === "active-sessions" }
}

export default function SecuritySettingsRoute() {
  const { showActiveSessions } = useLoaderData<typeof loader>()
  const { user } = useOutletContext<SettingsOutletContext>()
  const navigate = useNavigate()
  return (
    <section className="flex flex-col">
      <header className="flex items-center gap-3 pb-4">
        {showActiveSessions && (
          <Button
            variant="ghost"
            size="icon"
            className="-ml-2 h-9 w-9"
            onClick={() =>
              navigate(getSettingsPath("security"), { replace: true })
            }
            aria-label="Back to Security and login"
          >
            <HugeiconsIcon icon={ArrowLeft01Icon} className="size-5" />
          </Button>
        )}
        <h1 className="text-2xl font-normal tracking-tight">
          {showActiveSessions ? "Active sessions" : "Security and login"}
        </h1>
      </header>
      <SecuritySettings
        user={user}
        showActiveSessions={showActiveSessions}
        onShowActiveSessionsChange={(show) =>
          navigate(
            getSettingsPath("security", show ? "active-sessions" : undefined),
            show ? undefined : { replace: true }
          )
        }
      />
    </section>
  )
}
