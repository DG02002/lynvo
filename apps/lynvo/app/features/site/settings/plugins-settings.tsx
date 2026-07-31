import * as React from "react"
import { useForm } from "@tanstack/react-form"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Add01Icon,
  ArrowDown01Icon,
  Delete02Icon,
  Edit02Icon,
  Link01Icon,
  LinkSquare02Icon,
} from "@hugeicons/core-free-icons"
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
import { CustomPluginServerTable } from "./custom-plugin-server-table"
import { PluginIcon } from "~/components/plugin-icon"
import type { LynvoPlugin } from "./plugin-settings-data"
import {
  SettingsPanel,
  SettingsList,
  SettingsRow,
  SectionHeading,
} from "./settings-layout"
import {
  usePluginSettingsInteraction,
  type CustomPluginServer,
  type PluginDomain,
} from "./plugin-settings-interaction"
import {
  customPluginServerSchema,
  type CustomPluginServerFormValues,
} from "./plugin-settings-schemas"

export type {
  CustomPluginServer,
  PluginDomain,
} from "./plugin-settings-interaction"

const EMPTY_DOMAIN_DRAFT = {
  domain: "",
  username: "",
  password: "",
  isCredentialEnabled: false,
}

export function PluginsSettings({
  lynvoPlugins,
  requestOrigin,
}: {
  lynvoPlugins: LynvoPlugin[] | null
  requestOrigin: string
}) {
  const [isAddPluginServerOpen, setIsAddPluginServerOpen] =
    React.useState(false)
  const [expandedPluginIds, setExpandedPluginIds] = React.useState(
    new Set<string>()
  )
  const {
    pluginServers,
    domains,
    handleDeleteDomain,
    handleSetDomainCredential,
    handleDeleteDomainCredential,
    handleAddPluginServer,
    handleDeletePluginServer,
    handleRefreshPluginServer,
    handleTogglePluginServer,
    domainDrafts,
    domainOperations,
    updateDomainDraft,
    addDomain,
  } = usePluginSettingsInteraction()

  const domainsByPlugin = React.useMemo(() => {
    return domains.reduce<Record<string, PluginDomain[]>>((acc, domain) => {
      const pluginDomains = acc[domain.pluginId] || []
      pluginDomains.push(domain)
      acc[domain.pluginId] = pluginDomains
      return acc
    }, {})
  }, [domains])

  return (
    <SettingsPanel className="gap-8">
      <div className="flex flex-col gap-3">
        <SectionHeading
          title="Lynvo plugins"
          description="Plugins maintained by Lynvo for supported Sources."
        />
        <SettingsList>
          {lynvoPlugins === null && (
            <SettingsRow>
              <div className="flex flex-col items-start gap-2">
                <p className="text-sm text-muted-foreground">
                  Lynvo Plugin Server details couldn’t be loaded.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.location.reload()}
                >
                  Reload settings
                </Button>
              </div>
            </SettingsRow>
          )}
          {(lynvoPlugins ?? []).map((plugin) => {
            const pluginDomains = domainsByPlugin[plugin.id] || []
            const isDomainsExpanded = expandedPluginIds.has(plugin.id)
            const draft = domainDrafts[plugin.id] ?? EMPTY_DOMAIN_DRAFT
            const operation = domainOperations[plugin.id]
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
                        domain={draft.domain}
                        username={draft.username}
                        password={draft.password}
                        isPasswordProtected={draft.isCredentialEnabled}
                        error={operation?.error}
                        isAdding={operation?.status === "pending"}
                        onDomainChange={(value) =>
                          updateDomainDraft(plugin.id, { domain: value })
                        }
                        onUsernameChange={(value) =>
                          updateDomainDraft(plugin.id, { username: value })
                        }
                        onPasswordChange={(value) =>
                          updateDomainDraft(plugin.id, { password: value })
                        }
                        onPasswordProtectedChange={(value) =>
                          updateDomainDraft(plugin.id, {
                            isCredentialEnabled: value,
                          })
                        }
                        onSubmit={async (event) => {
                          event.preventDefault()
                          return await addDomain(plugin.id)
                        }}
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

      <CustomPluginServersSection
        pluginServers={pluginServers}
        requestOrigin={requestOrigin}
        isAddPluginServerOpen={isAddPluginServerOpen}
        onAddPluginServerOpenChange={setIsAddPluginServerOpen}
        onAddPluginServer={handleAddPluginServer}
        onDeletePluginServer={handleDeletePluginServer}
        onRefreshPluginServer={handleRefreshPluginServer}
        onTogglePluginServer={handleTogglePluginServer}
      />
    </SettingsPanel>
  )
}

interface AddPluginDomainDialogProps {
  plugin: LynvoPlugin
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
  plugin: LynvoPlugin
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

interface CustomPluginServersSectionProps {
  pluginServers: readonly CustomPluginServer[]
  requestOrigin: string
  isAddPluginServerOpen: boolean
  onAddPluginServerOpenChange: (open: boolean) => void
  onAddPluginServer: (
    value: CustomPluginServerFormValues
  ) => Promise<string | null>
  onDeletePluginServer: (pluginServerId: string) => Promise<void>
  onRefreshPluginServer: (pluginServerId: string) => Promise<void>
  onTogglePluginServer: (
    pluginServerId: string,
    enabled: boolean
  ) => Promise<void>
}

export const CustomPluginServersSection = ({
  pluginServers,
  requestOrigin,
  isAddPluginServerOpen,
  onAddPluginServerOpenChange,
  onAddPluginServer,
  onDeletePluginServer,
  onRefreshPluginServer,
  onTogglePluginServer,
}: CustomPluginServersSectionProps) => {
  const [registrationError, setRegistrationError] = React.useState<
    string | null
  >(null)
  const form = useForm({
    defaultValues: {
      baseUrl: "",
      apiKey: "",
    },
    validators: {
      onSubmit: customPluginServerSchema,
    },
    onSubmit: async ({ value }) => {
      setRegistrationError(null)
      const error = await onAddPluginServer(value)
      if (error) {
        setRegistrationError(error)
        return
      }
      form.reset()
      onAddPluginServerOpenChange(false)
    },
  })

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <SectionHeading
          title="Custom Plugin Servers"
          description="Connect a Custom Plugin Server to open links from the Sources its Plugins support."
        />
        <Dialog
          open={isAddPluginServerOpen}
          onOpenChange={(open) => {
            setRegistrationError(null)
            onAddPluginServerOpenChange(open)
          }}
        >
          <DialogTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                aria-label="Add Custom Plugin Server"
              />
            }
          >
            <HugeiconsIcon icon={Add01Icon} />
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-normal">
                Add Custom Plugin Server
              </DialogTitle>
              <DialogDescription>
                Enter the URL and API key for the Custom Plugin Server.
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
                          htmlFor="custom-plugin-server-base-url"
                          className="text-xs font-medium text-muted-foreground"
                        >
                          Custom Plugin Server URL
                        </FieldLabel>
                        <Input
                          id="custom-plugin-server-base-url"
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(event) => {
                            setRegistrationError(null)
                            field.handleChange(event.target.value)
                          }}
                          placeholder="https://plugin-server.example.com"
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
                          htmlFor="custom-plugin-server-api-key"
                          className="text-xs font-medium text-muted-foreground"
                        >
                          Custom Plugin Server API key
                        </FieldLabel>
                        <Input
                          id="custom-plugin-server-api-key"
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(event) => {
                            setRegistrationError(null)
                            field.handleChange(event.target.value)
                          }}
                          placeholder="Example: sk_live_…"
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
                      {isSubmitting ? "Adding…" : "Add Custom Plugin Server"}
                    </Button>
                  )}
                </form.Subscribe>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      {pluginServers.length === 0 && (
        <div className="flex flex-col items-start gap-2 rounded-xl border p-4">
          <p className="text-sm text-muted-foreground">
            No Custom Plugin Servers are connected.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onAddPluginServerOpenChange(true)}
          >
            Add Custom Plugin Server
          </Button>
        </div>
      )}
      {pluginServers.length > 0 && (
        <CustomPluginServerTable
          pluginServers={pluginServers}
          requestOrigin={requestOrigin}
          onDeletePluginServer={onDeletePluginServer}
          onRefreshPluginServer={onRefreshPluginServer}
          onTogglePluginServer={onTogglePluginServer}
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
          <Dialog
            open={isEditing}
            onOpenChange={(open) => {
              setIsEditing(open)
              if (!open) {
                setUsername("")
                setPassword("")
              }
            }}
          >
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
