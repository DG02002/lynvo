import * as React from "react"
import { useForm } from "@tanstack/react-form"
import { useQuery } from "convex/react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Add01Icon,
  ArrowDown01Icon,
  Delete02Icon,
  Edit02Icon,
  Link01Icon,
  LinkSquare02Icon,
} from "@hugeicons/core-free-icons"
import { api } from "../../../../convex/_generated/api"
import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import { Checkbox } from "~/components/ui/checkbox"
import { Alert, AlertDescription } from "~/components/ui/alert"
import { Field, FieldError, FieldGroup, FieldLabel } from "~/components/field"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
  DialogFooter,
} from "~/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "~/components/ui/alert-dialog"
import { ExternalWorkerTable } from "./external-worker-table"
import { PluginIcon } from "~/components/plugin-icon"
import type { OfficialPlugin } from "./plugin-settings-data"
import {
  SettingsPanel,
  SettingsList,
  SettingsRow,
  SectionHeading,
} from "./settings-layout"
import { usePluginSettingsActions } from "./use-plugin-settings-actions"
import {
  externalWorkerSchema,
  type ExternalWorkerFormValues,
} from "./plugin-settings-schemas"
import { OFFICIAL_EXTRACTOR_ID } from "~/lib/constants"

export interface PluginDomain {
  _id: string
  workerId: string
  pluginId: string
  domain: string
  hasCredential: boolean
}

export interface ExtractorWorker {
  _id: string
  baseUrl: string
  manifest: string
  enabled: boolean
  verificationStatus: string
}

const EMPTY_WORKERS: ExtractorWorker[] = []
const EMPTY_DOMAINS: PluginDomain[] = []

export function PluginsSettings({
  officialPlugins,
  requestOrigin,
}: {
  officialPlugins: OfficialPlugin[] | null
  requestOrigin: string
}) {
  const workers = useQuery(api.userWorkers.list, {}) ?? EMPTY_WORKERS
  const domains = (
    (useQuery(api.pluginDomains.list, {}) as PluginDomain[] | undefined) ??
    EMPTY_DOMAINS
  ).filter((domain) => domain.workerId === OFFICIAL_EXTRACTOR_ID)
  const [domainInputs, setDomainInputs] = React.useState<
    Record<string, string>
  >({})
  const [passwordInputs, setPasswordInputs] = React.useState<
    Record<string, string>
  >({})
  const [usernameInputs, setUsernameInputs] = React.useState<
    Record<string, string>
  >({})
  const [passwordProtectedInputs, setPasswordProtectedInputs] = React.useState<
    Record<string, boolean>
  >({})
  const [isAddWorkerOpen, setIsAddWorkerOpen] = React.useState(false)
  const [expandedPluginIds, setExpandedPluginIds] = React.useState(
    new Set<string>()
  )
  const automaticallyRefreshedWorkerIds = React.useRef(new Set<string>())

  const {
    addingDomainFor,
    domainErrors,
    handleAddDomain,
    handleDeleteDomain,
    handleSetDomainCredential,
    handleDeleteDomainCredential,
    handleAddWorker,
    handleDeleteWorker,
    handleRefreshWorker,
    handleToggleWorker,
  } = usePluginSettingsActions({
    domainInputs,
    setDomainInputs,
    passwordInputs,
    setPasswordInputs,
    usernameInputs,
    setUsernameInputs,
    setPasswordProtectedInputs,
  })

  React.useEffect(() => {
    for (const worker of workers) {
      if (automaticallyRefreshedWorkerIds.current.has(worker._id)) {
        continue
      }
      automaticallyRefreshedWorkerIds.current.add(worker._id)
      void handleRefreshWorker(worker._id, false)
    }
  }, [handleRefreshWorker, workers])

  const domainsByPlugin = React.useMemo(() => {
    return domains.reduce<Record<string, PluginDomain[]>>((acc, domain) => {
      const pluginDomains = acc[domain.pluginId] || []
      pluginDomains.push(domain)
      acc[domain.pluginId] = pluginDomains
      return acc
    }, {})
  }, [domains])

  const handleDomainInputChange = (pluginId: string, value: string) => {
    setDomainInputs((current) => ({ ...current, [pluginId]: value }))
  }

  const handlePasswordInputChange = (pluginId: string, value: string) => {
    setPasswordInputs((current) => ({ ...current, [pluginId]: value }))
  }

  const handleUsernameInputChange = (pluginId: string, value: string) => {
    setUsernameInputs((current) => ({ ...current, [pluginId]: value }))
  }

  const handlePasswordProtectedInputChange = (
    pluginId: string,
    value: boolean
  ) => {
    if (!value) {
      handleUsernameInputChange(pluginId, "")
      handlePasswordInputChange(pluginId, "")
    }
    setPasswordProtectedInputs((current) => ({
      ...current,
      [pluginId]: value,
    }))
  }

  return (
    <SettingsPanel className="gap-8">
      <div className="flex flex-col gap-3">
        <SectionHeading
          title="Official plugins"
          description="Plugins maintained by Lynvo for compatible third-party projects."
        />
        <SettingsList>
          {officialPlugins === null && (
            <SettingsRow>
              <p className="text-sm text-muted-foreground">
                Official extractor metadata is currently unavailable.
              </p>
            </SettingsRow>
          )}
          {(officialPlugins ?? []).map((plugin) => {
            const pluginDomains = domainsByPlugin[plugin.id] || []
            const isDomainsExpanded = expandedPluginIds.has(plugin.id)
            return (
              <div key={plugin.id} className="flex flex-col">
                <SettingsRow>
                  <div className="flex items-center gap-3">
                    <PluginIcon icon={plugin.icon} className="size-10" />
                    <div className="flex min-w-0 items-center gap-1.5">
                      <span className="text-sm font-normal text-foreground">
                        {plugin.name}
                      </span>
                      <a
                        href={plugin.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`View upstream project for ${plugin.name}`}
                        title="View upstream project"
                        className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
                      >
                        <HugeiconsIcon
                          icon={LinkSquare02Icon}
                          className="size-4"
                        />
                      </a>
                    </div>
                  </div>
                  {plugin.supportsDomains && (
                    <div className="flex shrink-0 items-center gap-1">
                      <AddPluginDomainDialog
                        plugin={plugin}
                        domain={domainInputs[plugin.id] || ""}
                        username={usernameInputs[plugin.id] || ""}
                        password={passwordInputs[plugin.id] || ""}
                        isPasswordProtected={Boolean(
                          passwordProtectedInputs[plugin.id]
                        )}
                        error={domainErrors[plugin.id]}
                        isAdding={addingDomainFor === plugin.id}
                        onDomainChange={(value) =>
                          handleDomainInputChange(plugin.id, value)
                        }
                        onUsernameChange={(value) =>
                          handleUsernameInputChange(plugin.id, value)
                        }
                        onPasswordChange={(value) =>
                          handlePasswordInputChange(plugin.id, value)
                        }
                        onPasswordProtectedChange={(value) =>
                          handlePasswordProtectedInputChange(plugin.id, value)
                        }
                        onSubmit={(event) => handleAddDomain(event, plugin.id)}
                        onAdded={() =>
                          setExpandedPluginIds((current) =>
                            new Set(current).add(plugin.id)
                          )
                        }
                      />
                      {pluginDomains.length > 0 && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-10"
                          aria-label={`${isDomainsExpanded ? "Hide" : "Show"} domains for ${plugin.name}`}
                          aria-expanded={isDomainsExpanded}
                          onClick={() =>
                            setExpandedPluginIds((current) => {
                              const next = new Set(current)
                              if (next.has(plugin.id)) {
                                next.delete(plugin.id)
                              } else {
                                next.add(plugin.id)
                              }
                              return next
                            })
                          }
                        >
                          <HugeiconsIcon
                            icon={ArrowDown01Icon}
                            className={`transition-transform duration-200 ${
                              isDomainsExpanded ? "rotate-180" : "rotate-0"
                            }`}
                          />
                        </Button>
                      )}
                    </div>
                  )}
                </SettingsRow>
                {plugin.supportsDomains && isDomainsExpanded && (
                  <PluginDomainList
                    plugin={plugin}
                    domains={pluginDomains}
                    onSaveCredential={handleSetDomainCredential}
                    onDeleteCredential={handleDeleteDomainCredential}
                    onDeleteDomain={handleDeleteDomain}
                  />
                )}
              </div>
            )
          })}
        </SettingsList>
      </div>

      <ExternalExtractorsSection
        workers={workers}
        requestOrigin={requestOrigin}
        isAddWorkerOpen={isAddWorkerOpen}
        onAddWorkerOpenChange={setIsAddWorkerOpen}
        onAddWorker={handleAddWorker}
        onDeleteWorker={handleDeleteWorker}
        onRefreshWorker={handleRefreshWorker}
        onToggleWorker={handleToggleWorker}
      />
    </SettingsPanel>
  )
}

interface AddPluginDomainDialogProps {
  plugin: OfficialPlugin
  domain: string
  username: string
  password: string
  isPasswordProtected: boolean
  error?: string
  isAdding: boolean
  onDomainChange: (value: string) => void
  onUsernameChange: (value: string) => void
  onPasswordChange: (value: string) => void
  onPasswordProtectedChange: (value: boolean) => void
  onSubmit: (event: React.FormEvent) => Promise<boolean>
  onAdded: () => void
}

const AddPluginDomainDialog = ({
  plugin,
  domain,
  username,
  password,
  isPasswordProtected,
  error,
  isAdding,
  onDomainChange,
  onUsernameChange,
  onPasswordChange,
  onPasswordProtectedChange,
  onSubmit,
  onAdded,
}: AddPluginDomainDialogProps) => {
  const [open, setOpen] = React.useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="icon-sm" />}>
        <HugeiconsIcon icon={Add01Icon} />
        <span className="sr-only">Add domain for {plugin.name}</span>
      </DialogTrigger>
      <DialogContent className="min-w-0 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-normal">
            Add domain for {plugin.name}
          </DialogTitle>
          <DialogDescription>{plugin.domainRequired}</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={async (event) => {
            const didAdd = await onSubmit(event)
            if (didAdd) {
              onAdded()
              setOpen(false)
            }
          }}
          className="flex min-w-0 flex-col gap-4"
        >
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor={`plugin-domain-${plugin.id}`}
              className="text-xs font-medium text-muted-foreground"
            >
              Domain
            </label>
            <Input
              id={`plugin-domain-${plugin.id}`}
              value={domain}
              onChange={(event) => onDomainChange(event.target.value)}
              placeholder="example.com"
              autoCapitalize="none"
              autoCorrect="off"
              required
            />
          </div>
          {plugin.credentialKind === "http-basic" && (
            <div className="flex flex-col gap-3">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={isPasswordProtected}
                  onCheckedChange={(checked) =>
                    onPasswordProtectedChange(checked === true)
                  }
                />
                This domain uses HTTP Basic Auth
              </label>
              {isPasswordProtected && (
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor={`plugin-username-${plugin.id}`}
                      className="text-xs font-medium text-muted-foreground"
                    >
                      Username
                    </label>
                    <Input
                      id={`plugin-username-${plugin.id}`}
                      value={username}
                      onChange={(event) => onUsernameChange(event.target.value)}
                      autoComplete="username"
                      required
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor={`plugin-password-${plugin.id}`}
                      className="text-xs font-medium text-muted-foreground"
                    >
                      Password
                    </label>
                    <Input
                      id={`plugin-password-${plugin.id}`}
                      type="password"
                      value={password}
                      onChange={(event) => onPasswordChange(event.target.value)}
                      autoComplete="new-password"
                      required
                    />
                  </div>
                </div>
              )}
            </div>
          )}
          {plugin.credentialKind === "domain-password" && (
            <div className="flex flex-col gap-3">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={isPasswordProtected}
                  onCheckedChange={(checked) =>
                    onPasswordProtectedChange(checked === true)
                  }
                />
                This domain requires a password
              </label>
              {isPasswordProtected && (
                <Input
                  type="password"
                  value={password}
                  onChange={(event) => onPasswordChange(event.target.value)}
                  placeholder="Domain password"
                  autoComplete="new-password"
                  required
                />
              )}
            </div>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={isAdding}>
              {isAdding ? "Adding…" : "Add domain"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

interface PluginDomainListProps {
  plugin: OfficialPlugin
  domains: PluginDomain[]
  onSaveCredential: (
    domainId: string,
    password: string,
    username?: string
  ) => Promise<boolean>
  onDeleteCredential: (domainId: string) => Promise<void>
  onDeleteDomain: (domainId: string) => Promise<void>
}

const PluginDomainList = ({
  plugin,
  domains,
  onSaveCredential,
  onDeleteCredential,
  onDeleteDomain,
}: PluginDomainListProps) => (
  <div className="ml-[3.25rem] divide-y border-t pr-1">
    {domains.length === 0 ? (
      <p className="py-4 text-sm text-muted-foreground" role="status">
        No domains configured yet.
      </p>
    ) : (
      <div className="min-w-0 divide-y">
        {domains.map((domain) => (
          <PluginCredentialEditor
            key={domain._id}
            domain={domain}
            credentialKind={plugin.credentialKind}
            onSave={onSaveCredential}
            onDeleteCredential={onDeleteCredential}
            onDeleteDomain={onDeleteDomain}
          />
        ))}
      </div>
    )}
  </div>
)

interface ExternalExtractorsSectionProps {
  workers: ExtractorWorker[]
  requestOrigin: string
  isAddWorkerOpen: boolean
  onAddWorkerOpenChange: (open: boolean) => void
  onAddWorker: (value: ExternalWorkerFormValues) => Promise<string | null>
  onDeleteWorker: (workerId: string) => Promise<void>
  onRefreshWorker: (workerId: string) => Promise<void>
  onToggleWorker: (workerId: string, enabled: boolean) => Promise<void>
}

export const ExternalExtractorsSection = ({
  workers,
  requestOrigin,
  isAddWorkerOpen,
  onAddWorkerOpenChange,
  onAddWorker,
  onDeleteWorker,
  onRefreshWorker,
  onToggleWorker,
}: ExternalExtractorsSectionProps) => {
  const [registrationError, setRegistrationError] = React.useState<
    string | null
  >(null)
  const form = useForm({
    defaultValues: {
      baseUrl: "",
      apiKey: "",
    },
    validators: {
      onSubmit: externalWorkerSchema,
    },
    onSubmit: async ({ value }) => {
      setRegistrationError(null)
      const error = await onAddWorker(value)
      if (error) {
        setRegistrationError(error)
        return
      }
      form.reset()
      onAddWorkerOpenChange(false)
    },
  })

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <SectionHeading
          title="External extractors"
          description="Extractors you add and manage independently from Lynvo."
        />
        <Dialog
          open={isAddWorkerOpen}
          onOpenChange={(open) => {
            setRegistrationError(null)
            onAddWorkerOpenChange(open)
          }}
        >
          <DialogTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                aria-label="Add external extractor"
              />
            }
          >
            <HugeiconsIcon icon={Add01Icon} />
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-normal">
                Add custom extractor worker
              </DialogTitle>
              <DialogDescription>
                Enter the base URL and API key for your custom worker.
              </DialogDescription>
            </DialogHeader>
            <form
              onSubmit={(event) => {
                event.preventDefault()
                void form.handleSubmit()
              }}
              className="mt-2 flex flex-col gap-4"
            >
              <FieldGroup className="gap-4">
                <form.Field name="baseUrl">
                  {(field) => {
                    const isInvalid =
                      field.state.meta.isTouched && !field.state.meta.isValid
                    return (
                      <Field data-invalid={isInvalid} className="gap-1.5">
                        <FieldLabel
                          htmlFor="external-worker-base-url"
                          className="text-xs font-medium text-muted-foreground"
                        >
                          Base URL
                        </FieldLabel>
                        <Input
                          id="external-worker-base-url"
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(event) => {
                            setRegistrationError(null)
                            field.handleChange(event.target.value)
                          }}
                          placeholder="https://worker.example.com"
                          className="h-10 rounded-xl px-3"
                          aria-invalid={isInvalid}
                        />
                        {isInvalid ? (
                          <FieldError errors={field.state.meta.errors} />
                        ) : null}
                      </Field>
                    )
                  }}
                </form.Field>
                <form.Field name="apiKey">
                  {(field) => {
                    const isInvalid =
                      field.state.meta.isTouched && !field.state.meta.isValid
                    return (
                      <Field data-invalid={isInvalid} className="gap-1.5">
                        <FieldLabel
                          htmlFor="external-worker-api-key"
                          className="text-xs font-medium text-muted-foreground"
                        >
                          API Key
                        </FieldLabel>
                        <Input
                          id="external-worker-api-key"
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(event) => {
                            setRegistrationError(null)
                            field.handleChange(event.target.value)
                          }}
                          placeholder="Your secret key"
                          type="password"
                          className="h-10 rounded-xl px-3"
                          aria-invalid={isInvalid}
                        />
                        {isInvalid ? (
                          <FieldError errors={field.state.meta.errors} />
                        ) : null}
                      </Field>
                    )
                  }}
                </form.Field>
              </FieldGroup>
              {registrationError ? (
                <Alert variant="destructive">
                  <AlertDescription>{registrationError}</AlertDescription>
                </Alert>
              ) : null}
              <DialogFooter className="mt-2">
                <form.Subscribe selector={(state) => state.isSubmitting}>
                  {(isSubmitting) => (
                    <Button type="submit" disabled={isSubmitting}>
                      {isSubmitting ? "Adding…" : "Add worker"}
                    </Button>
                  )}
                </form.Subscribe>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      {workers.length > 0 && (
        <ExternalWorkerTable
          workers={workers}
          requestOrigin={requestOrigin}
          onDeleteWorker={onDeleteWorker}
          onRefreshWorker={onRefreshWorker}
          onToggleWorker={onToggleWorker}
        />
      )}
    </div>
  )
}

interface PluginCredentialEditorProps {
  domain: PluginDomain
  credentialKind?: "domain-password" | "http-basic"
  onSave: (
    domainId: string,
    password: string,
    username?: string
  ) => Promise<boolean>
  onDeleteCredential: (domainId: string) => Promise<void>
  onDeleteDomain: (domainId: string) => Promise<void>
}

const PluginCredentialEditor = ({
  domain,
  credentialKind,
  onSave,
  onDeleteCredential,
  onDeleteDomain,
}: PluginCredentialEditorProps) => {
  const [isEditing, setIsEditing] = React.useState(false)
  const [username, setUsername] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [isSaving, setIsSaving] = React.useState(false)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setIsSaving(true)
    try {
      const didSave = await onSave(domain._id, password, username || undefined)
      if (didSave) {
        setPassword("")
        setUsername("")
        setIsEditing(false)
      }
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="flex min-w-0 flex-col py-3 first:pt-1 last:pb-1">
      <div className="flex min-h-12 min-w-0 items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <HugeiconsIcon
            icon={Link01Icon}
            className="size-5 shrink-0 text-muted-foreground"
          />
          <span className="min-w-0 truncate text-sm" title={domain.domain}>
            {domain.domain}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Dialog open={isEditing} onOpenChange={setIsEditing}>
            <DialogTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="hover:bg-transparent dark:hover:bg-transparent"
                  aria-label={`Edit credentials for ${domain.domain}`}
                />
              }
            >
              <HugeiconsIcon icon={Edit02Icon} />
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="font-normal">
                  Edit credentials
                </DialogTitle>
                <DialogDescription>
                  Update the credentials Lynvo uses for {domain.domain}.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                {credentialKind === "http-basic" && (
                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor={`credential-username-${domain._id}`}
                      className="text-xs font-medium text-muted-foreground"
                    >
                      Username
                    </label>
                    <Input
                      id={`credential-username-${domain._id}`}
                      autoComplete="username"
                      value={username}
                      onChange={(event) => setUsername(event.target.value)}
                      required
                      autoFocus
                    />
                  </div>
                )}
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor={`credential-${domain._id}`}
                    className="text-xs font-medium text-muted-foreground"
                  >
                    Password
                  </label>
                  <Input
                    id={`credential-${domain._id}`}
                    type="password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                    autoFocus={credentialKind === "domain-password"}
                  />
                </div>
                <DialogFooter>
                  {domain.hasCredential && (
                    <Button
                      type="button"
                      variant="ghost"
                      className="mr-auto"
                      onClick={async () => {
                        await onDeleteCredential(domain._id)
                        setIsEditing(false)
                      }}
                    >
                      Remove credentials
                    </Button>
                  )}
                  <Button type="submit" disabled={isSaving}>
                    {isSaving ? "Saving…" : "Save credentials"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
          <AlertDialog>
            <AlertDialogTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="hover:bg-transparent dark:hover:bg-transparent"
                  aria-label={`Remove ${domain.domain}`}
                />
              }
            >
              <HugeiconsIcon icon={Delete02Icon} />
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="font-normal">
                  Remove this domain?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {domain.domain} and its saved credentials will be removed from
                  this plugin.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  onClick={() => onDeleteDomain(domain._id)}
                >
                  Remove domain
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  )
}
