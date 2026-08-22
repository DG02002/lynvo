import {
  SettingsPanel,
  SettingsList,
  SettingsRow,
  SettingsRowInfo,
} from "./settings-layout"

export interface AccountSettingsUser {
  readonly id: string
  readonly email: string
  readonly name?: string | null
}

export interface AccountSettingsProps {
  readonly user: AccountSettingsUser
}

export const AccountSettings = ({ user }: AccountSettingsProps) => (
  <SettingsPanel>
    <SettingsList>
      <SettingsRow>
        <SettingsRowInfo
          label="Name"
          description="Your name from your Google account."
        />
        <span className="text-sm font-normal text-muted-foreground text-right shrink-0">
          {user.name || "—"}
        </span>
      </SettingsRow>
      <SettingsRow>
        <SettingsRowInfo
          label="Email"
          description="The email address associated with your Google account."
        />
        <span className="text-sm font-normal text-muted-foreground text-right shrink-0">
          {user.email}
        </span>
      </SettingsRow>
    </SettingsList>
  </SettingsPanel>
)
