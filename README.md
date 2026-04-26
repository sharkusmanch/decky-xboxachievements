# Xbox Achievements (Decky Loader)

Decky Loader plugin that displays Xbox-style achievement popups on Steam Deck and plays separate sound effects for normal and rare unlocks.

## Features

- Xbox-inspired popup animation and styling
- Separate `unlock.wav` and `rare.wav` playback
- Conservative local achievement detection (Steam logs + library cache watcher)
- Manual test buttons for normal and rare popups

## Project Structure

```text
assets/        # audio + visual assets used by the popup
dist/          # frontend build output loaded by Decky
src/           # Decky frontend source
main.py        # Decky backend (watchers + event + audio playback)
plugin.json    # Decky manifest
```

## Development

```bash
pnpm install
pnpm build
python3 -m py_compile main.py
```

## Deploying to a Steam Deck

Build and deploy with [go-task](https://taskfile.dev). File transfer uses
[rclone](https://rclone.org); restart/logs/status use SSH.

Prerequisites:

- An rclone remote (default name `legion`) configured for the Deck filesystem,
  e.g. via `rclone config` with the `sftp` backend. Override the remote name
  with `RCLONE_REMOTE=<name>` or the SSH host with `DECK_HOST=deck@<ip>`.
- SSH key auth to the Deck (`ssh-copy-id deck@<ip>`) for `restart`/`logs`/`status`.
- A previous Decky plugin install so `/home/deck/homebrew/plugins/` exists and
  is owned by `deck` (no sudo needed for the file sync).

```bash
task setup      # one-time: create plugin dir on Deck and chown to deck (sudo prompt)
task deploy     # build, sync to the Deck, and restart plugin_loader (sudo prompt)
task restart    # restart plugin_loader only
task logs       # tail plugin_loader logs
task status     # show plugin_loader status
task clean      # remove local dist/ and node_modules/
```

To skip the sudo prompt on every `task deploy`, add a sudoers entry on the Deck:

```bash
echo 'deck ALL=(root) NOPASSWD: /usr/bin/systemctl restart plugin_loader' | \
  sudo tee /etc/sudoers.d/decky-restart
```

Run `task setup` once per Deck (it sudo-creates `/home/deck/homebrew/plugins/XboxAchievements`
and chowns it to `deck` so subsequent `task deploy` runs need no elevation).

## Notes

- The plugin emits frontend event `xboxachievements_show`.
- Backend methods include `test_popup_main`, `test_popup_rare`, and `get_status`.
- The current implementation is intentionally API-free (local detection only).
- Audio files shipped in this repository are original plugin sounds generated for this project.

## AI Disclosure

Parts of this plugin were developed with AI-assisted coding support.
All generated code and content were manually reviewed, edited, and tested before publication.
