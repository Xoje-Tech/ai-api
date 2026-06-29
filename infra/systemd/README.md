# Systemd user timer: gh-token renewal

The installation token for the Gandalf-Xoje GitHub App has a 1h TTL
(see `~/.hermes/scripts/renew-gh-token.sh`). Without a recurring
runner, the token expires silently and breaks `git push`/`fetch` for
every repo in the org.

This timer runs `renew-gh-token.sh` every 50 minutes via a **systemd
user timer** — no sudo, runs even when no terminal is open.

## Install (idempotent)

```bash
bash install.sh
```

Then activate (one-time, manual):

```bash
systemctl --user enable --now gh-token-renew.timer
```

## Verify

```bash
systemctl --user list-timers gh-token-renew.timer
systemctl --user status gh-token-renew.service
```

## Logs

```bash
journalctl --user -u gh-token-renew.service -n 20
```

## Uninstall

```bash
systemctl --user disable --now gh-token-renew.timer
rm ~/.config/systemd/user/gh-token-renew.{service,timer}
systemctl --user daemon-reload
```

## Why a user timer and not cron

`cron.service` was inactive on this machine (no active timer in
`/etc/cron.d/` either). A systemd user timer is the modern equivalent,
requires no elevated privileges, and is portable across distros with
systemd (Arch/CachyOS included).
