# Lynvo

The Lynvo website can be opened in any browser so you can sign in and manage
links. Link handoff is designed for Android phones, Android tablets, and
Android TV. Lynvo opens links in one of four Android players:

- Just (Video) Player
- VLC for Android
- MPV
- MX Player

Lynvo marks an item opened the first time you open it, but it does not store a
playback position or resume state. Lynvo does not play video; it opens a URL in
an external Android player. When you open the same link again, Lynvo sends the
same URL to the selected player. Just (Video) Player is recommended for links
whose servers support HTTP byte-range requests, which can enable seeking. It
can open other links too, but it cannot seek when the server does not support
HTTP byte-range requests. VLC for Android is recommended for those links and
may still allow seeking in some cases. The selected player may remember its
own playback position. MPV and MX Player are also available choices.

Lynvo is an early-stage open-source project. This repository contains the
Lynvo app and the packages that support it.

## Project information

- [Lynvo website](https://lynvo.dg02002.workers.dev).
- [Contributing guide](CONTRIBUTING.md) — set up and work on Lynvo.
- [Plugin Server documentation](apps/lynvo/app/features/site/docs/plugin-server/) — create a custom integration.
- [Project terminology](CONTEXT.md) — shared names and concepts used by the project.
- [Report an issue on GitHub](https://github.com/DG02002/lynvo/issues).
- [Contact Lynvo on Telegram](https://t.me/lynvo_support?direct).

## License

The Lynvo core project is licensed under the [GNU Affero General Public License
v3.0](LICENSE).

The [Plugin Server Protocol](packages/plugin-server-protocol/LICENSE) and
[`create-lynvo-plugin-server`](packages/create-lynvo-plugin-server/LICENSE)
packages are licensed separately under the MIT License. Each package includes
its own license file.

Copyright © 2026 Lynvo.
