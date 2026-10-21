import {
  Add01Icon,
  Alert01Icon,
  ArrowDown01Icon,
  Delete02Icon,
  Edit02Icon,
  Link01Icon,
  PlugSocketIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useForm } from "@tanstack/react-form"
import * as React from "react"

import { ConfirmationAlertDialog } from "~/components/confirmation-alert-dialog"
import { Field, FieldError, FieldGroup, FieldLabel } from "~/components/field"
import { FormDialogContent } from "~/components/form-dialog-content"
import { FormDialogInput } from "~/components/form-dialog-input"
import { LynvoPluginServerAvatar, PluginIcon } from "~/components/plugin-icon"
import { Alert, AlertDescription } from "~/components/ui/alert"
import { Button } from "~/components/ui/button"
import { Checkbox } from "~/components/ui/checkbox"
import { Dialog, DialogTrigger } from "~/components/ui/dialog"

import { CustomPluginServerTable } from "./custom-plugin-server-table"
import { PluginInfoPopover } from "./plugin-info-popover"
import type { LynvoPlugin } from "./plugin-settings-data"
import type {
  CustomPluginServer,
  PluginDomain,
} from "./plugin-settings-interaction"
import {
  customPluginServerStandardSchema,
  type CustomPluginServerFormValues,
} from "./plugin-settings-schemas"
import {
  SettingsPanel,
  SettingsList,
  SettingsRow,
  SectionHeading,
} from "./settings-layout"
import { usePluginDomainSettings } from "./use-plugin-domain-settings"
import { usePluginServerSettings } from "./use-plugin-server-settings"

export type { PluginDomain } from "./plugin-settings-interaction"

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
  const [isLynvoPluginsExpanded, setIsLynvoPluginsExpanded] =
    React.useState(false)
  const {
    pluginServers,
    handleAddPluginServer,
    handleDeletePluginServer,
    handleRefreshPluginServer,
    handleTogglePluginServer,
    reloadPluginSettings,
  } = usePluginServerSettings()
  const {
    domains,
    handleDeleteDomain,
    handleSetDomainCredential,
    domainDrafts,
    domainOperations,
    updateDomainDraft,
    addDomain,
  } = usePluginDomainSettings({ reloadPluginSettings })

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
          title="Built-in Plugin Server usage"
          description="The built-in Plugin Server reports usage for Lynvo Plugins."
          size="base"
        />
        <SettingsList>
          <div className="flex flex-col">
            <SettingsRow className="gap-4">
              <div className="flex min-w-0 items-center gap-3">
                <LynvoPluginServerAvatar
                  name="Lynvo Plugin Server"
                  className="size-12"
                />
                <SectionHeading
                  title="Lynvo Plugins"
                  description="Provided by the Lynvo Plugin Server."
                  size="base"
                  descriptionSize="sm"
                />
              </div>
              {lynvoPlugins && lynvoPlugins.length > 0 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-10"
                  aria-label={`${isLynvoPluginsExpanded ? "Collapse" : "Expand"} Lynvo Plugins`}
                  aria-expanded={isLynvoPluginsExpanded}
                  aria-controls="lynvo-plugin-server-plugins"
                  onClick={() =>
                    setIsLynvoPluginsExpanded((current) => !current)
                  }
                >
                  <HugeiconsIcon
                    icon={ArrowDown01Icon}
                    className={`transition-transform duration-200 ${
                      isLynvoPluginsExpanded ? "rotate-180" : "rotate-0"
                    }`}
                  />
                </Button>
              )}
            </SettingsRow>
            {lynvoPlugins === null && (
              <div className="ms-15 border-t border-border">
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
              </div>
            )}
            {lynvoPlugins?.length === 0 && (
              <div className="ms-15 border-t border-border">
                <p className="py-4 text-sm text-muted-foreground" role="status">
                  No Lynvo Plugins are available.
                </p>
              </div>
            )}
            {lynvoPlugins &&
              lynvoPlugins.length > 0 &&
              isLynvoPluginsExpanded && (
                <div
                  id="lynvo-plugin-server-plugins"
                  className="ms-15 divide-y divide-border border-t border-border"
                >
                  {lynvoPlugins.map((plugin) => {
                    const pluginDomains = domainsByPlugin[plugin.id] || []
                    const isDomainsExpanded = expandedPluginIds.has(plugin.id)
                    const draft = domainDrafts[plugin.id] ?? EMPTY_DOMAIN_DRAFT
                    const operation = domainOperations[plugin.id]
                    return (
                      <div key={plugin.id} className="flex flex-col">
                        <SettingsRow className="gap-3">
                          <div className="flex min-w-0 items-center gap-3">
                            <PluginIcon
                              icon={plugin.icon}
                              className="size-10"
                            />
                            <div className="flex min-w-0 items-center gap-1.5">
                              <span className="text-sm font-normal text-foreground">
                                {plugin.name}
                              </span>
                              <PluginInfoPopover
                                pluginName={plugin.name}
                                description={plugin.description}
                                version={plugin.version}
                                usageMultiplier={plugin.usageMultiplier}
                                proxyCreditUsage={plugin.proxyCreditUsage}
                                projectUrl={plugin.sourceUrl}
                              />
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
                                  updateDomainDraft(plugin.id, {
                                    domain: value,
                                  })
                                }
                                onUsernameChange={(value) =>
                                  updateDomainDraft(plugin.id, {
                                    username: value,
                                  })
                                }
                                onPasswordChange={(value) =>
                                  updateDomainDraft(plugin.id, {
                                    password: value,
                                  })
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
                                      isDomainsExpanded
                                        ? "rotate-180"
                                        : "rotate-0"
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
                            onDeleteDomain={handleDeleteDomain}
                          />
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
          </div>
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
      <FormDialogContent
        title={`Add domain for ${plugin.name}`}
        description={plugin.domainRequired}
        media={<PluginIcon icon={plugin.icon} className="mx-auto size-16" />}
        onSubmit={async (event) => {
          const didAdd = await onSubmit(event)
          if (didAdd) {
            onAdded()
            setOpen(false)
          }
        }}
        submitLabel="Add domain"
        submitPending={isAdding}
        submitDisabled={isAdding}
        cancelDisabled={isAdding}
        onCancel={() => setOpen(false)}
      >
        <FieldGroup className="gap-4">
          <Field className="gap-1.5">
            <FormDialogInput
              id={`plugin-domain-${plugin.id}`}
              label="Domain"
              value={domain}
              onChange={(event) => onDomainChange(event.target.value)}
              autoCapitalize="none"
              autoCorrect="off"
              required
            />
          </Field>
          {plugin.credentialKind === "http-basic" && (
            <FieldGroup className="gap-4">
              <Field orientation="horizontal">
                <Checkbox
                  id={`plugin-http-basic-${plugin.id}`}
                  checked={isPasswordProtected}
                  onCheckedChange={(checked) =>
                    onPasswordProtectedChange(checked)
                  }
                />
                <FieldLabel htmlFor={`plugin-http-basic-${plugin.id}`}>
                  This domain uses HTTP Basic Auth
                </FieldLabel>
              </Field>
              {isPasswordProtected && (
                <FieldGroup className="gap-4">
                  <Field className="gap-1.5">
                    <FormDialogInput
                      id={`plugin-username-${plugin.id}`}
                      label="Username"
                      value={username}
                      onChange={(event) => onUsernameChange(event.target.value)}
                      autoComplete="username"
                      required
                    />
                  </Field>
                  <Field className="gap-1.5">
                    <FormDialogInput
                      id={`plugin-password-${plugin.id}`}
                      label="Password"
                      type="password"
                      value={password}
                      onChange={(event) => onPasswordChange(event.target.value)}
                      autoComplete="new-password"
                      required
                    />
                  </Field>
                </FieldGroup>
              )}
            </FieldGroup>
          )}
          {plugin.credentialKind === "domain-password" && (
            <FieldGroup className="gap-4">
              <Field orientation="horizontal">
                <Checkbox
                  id={`plugin-domain-password-${plugin.id}`}
                  checked={isPasswordProtected}
                  onCheckedChange={(checked) =>
                    onPasswordProtectedChange(checked)
                  }
                />
                <FieldLabel htmlFor={`plugin-domain-password-${plugin.id}`}>
                  This domain requires a password
                </FieldLabel>
              </Field>
              {isPasswordProtected && (
                <Field className="gap-1.5">
                  <FormDialogInput
                    id={`plugin-password-${plugin.id}`}
                    label="Password"
                    type="password"
                    value={password}
                    onChange={(event) => onPasswordChange(event.target.value)}
                    autoComplete="new-password"
                    required
                  />
                </Field>
              )}
            </FieldGroup>
          )}
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </FieldGroup>
      </FormDialogContent>
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
  onDeleteDomain: (domainId: string) => Promise<void>
}

const PluginDomainList = ({
  plugin,
  domains,
  onSaveCredential,
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
            key={domain.id}
            domain={domain}
            credentialKind={plugin.credentialKind}
            onSave={onSaveCredential}
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
      onSubmit: customPluginServerStandardSchema,
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
          size="base"
          descriptionSize="sm"
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
          <form.Subscribe selector={(state) => state.isSubmitting}>
            {(isSubmitting) => (
              <FormDialogContent
                title="Add Custom Plugin Server"
                description="Connect a server using its URL and API key."
                media={
                  <HugeiconsIcon
                    icon={PlugSocketIcon}
                    className="mx-auto size-16 text-foreground"
                  />
                }
                onSubmit={(event) => {
                  event.preventDefault()
                  void form.handleSubmit()
                }}
                submitLabel="Add Custom Plugin Server"
                submitPending={isSubmitting}
                submitDisabled={isSubmitting}
                cancelDisabled={isSubmitting}
                onCancel={() => onAddPluginServerOpenChange(false)}
                error={
                  registrationError ? (
                    <Alert variant="destructive">
                      <AlertDescription>{registrationError}</AlertDescription>
                    </Alert>
                  ) : null
                }
              >
                <FieldGroup className="gap-4">
                  <form.Field name="baseUrl">
                    {(field) => {
                      const isInvalid =
                        field.state.meta.isTouched && !field.state.meta.isValid
                      return (
                        <Field data-invalid={isInvalid} className="gap-1.5">
                          <FormDialogInput
                            id="custom-plugin-server-base-url"
                            label="Server URL"
                            value={field.state.value}
                            onBlur={field.handleBlur}
                            onChange={(event) => {
                              setRegistrationError(null)
                              field.handleChange(event.target.value)
                            }}
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
                          <FormDialogInput
                            id="custom-plugin-server-api-key"
                            label="API key"
                            value={field.state.value}
                            onBlur={field.handleBlur}
                            onChange={(event) => {
                              setRegistrationError(null)
                              field.handleChange(event.target.value)
                            }}
                            type="password"
                          />
                          {isInvalid ? (
                            <FieldError errors={field.state.meta.errors} />
                          ) : null}
                        </Field>
                      )
                    }}
                  </form.Field>
                </FieldGroup>
              </FormDialogContent>
            )}
          </form.Subscribe>
        </Dialog>
      </div>
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
  onDeleteDomain: (domainId: string) => Promise<void>
}

const PluginCredentialEditor = ({
  domain,
  credentialKind,
  onSave,
  onDeleteDomain,
}: PluginCredentialEditorProps) => {
  const [isEditing, setIsEditing] = React.useState(false)
  const [username, setUsername] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [isSaving, setIsSaving] = React.useState(false)
  const [isRemoveDomainDialogOpen, setIsRemoveDomainDialogOpen] =
    React.useState(false)
  const [isRemovingDomain, setIsRemovingDomain] = React.useState(false)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setIsSaving(true)
    try {
      const didSave = await onSave(domain.id, password, username || undefined)
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
                  variant="quiet"
                  size="icon-sm"
                  aria-label={`Edit credentials for ${domain.domain}`}
                />
              }
            >
              <HugeiconsIcon icon={Edit02Icon} />
            </DialogTrigger>
            <FormDialogContent
              title="Edit Plugin Credentials"
              description={`Update the credentials Lynvo uses to access ${domain.domain}.`}
              media={
                <HugeiconsIcon
                  icon={Link01Icon}
                  className="mx-auto size-16 text-foreground"
                />
              }
              onSubmit={handleSubmit}
              submitLabel="Save credentials"
              submitPending={isSaving}
              submitDisabled={isSaving}
              cancelDisabled={isSaving}
              onCancel={() => setIsEditing(false)}
            >
              <FieldGroup className="gap-4">
                {credentialKind === "http-basic" && (
                  <Field className="gap-1.5">
                    <FormDialogInput
                      id={`credential-username-${domain.id}`}
                      label="Username"
                      autoComplete="username"
                      value={username}
                      onChange={(event) => setUsername(event.target.value)}
                      required
                      autoFocus
                    />
                  </Field>
                )}
                <Field className="gap-1.5">
                  <FormDialogInput
                    id={`credential-${domain.id}`}
                    label="Password"
                    type="password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                    autoFocus={credentialKind === "domain-password"}
                  />
                </Field>
              </FieldGroup>
            </FormDialogContent>
          </Dialog>
          <Button
            variant="quiet"
            size="icon-sm"
            aria-label={`Remove ${domain.domain}`}
            onClick={() => setIsRemoveDomainDialogOpen(true)}
          >
            <HugeiconsIcon icon={Delete02Icon} />
          </Button>
        </div>
      </div>
      <ConfirmationAlertDialog
        open={isRemoveDomainDialogOpen}
        onOpenChange={setIsRemoveDomainDialogOpen}
        title="Remove this domain?"
        media={
          <HugeiconsIcon
            icon={Alert01Icon}
            className="mx-auto size-16 text-destructive"
          />
        }
        description={`${domain.domain} and its Plugin Credentials will be removed from this plugin.`}
        confirmLabel="Remove domain"
        confirmVariant="destructive"
        pending={isRemovingDomain}
        onConfirm={() => {
          setIsRemovingDomain(true)
          void onDeleteDomain(domain.id).finally(() => {
            setIsRemovingDomain(false)
            setIsRemoveDomainDialogOpen(false)
          })
        }}
      />
    </div>
  )
}
