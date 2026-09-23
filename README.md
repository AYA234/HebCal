# HebCal

Shows the Hebrew date alongside the Gregorian date in the GNOME Shell top-bar
calendar. Not a separate app, panel, or indicator — the Hebrew date is added
as a second line under the existing "Today" date in the stock calendar
popover, inheriting the existing date label's style class. If you can tell
it's not part of GNOME, that's a bug.

## What it shows, and when it changes

The Hebrew date is the direct calendrical conversion of today's **Gregorian**
date, and it changes exactly when the shell's own date changes: at civil
midnight. It does **not** follow the Jewish tradition of a sunset rollover.
Concretely: if you open the calendar at 21:00, you'll see the Hebrew date
that mathematically corresponds to today's Gregorian date, not the Hebrew
date that — by tradition — already began at sunset a few hours earlier. This
is a deliberate v1 decision, not an oversight; sunset-aware rollover would
need a location or timezone-sunset source this extension doesn't have.

The date is shown in Hebrew script with gematria numerals (e.g. `י״א בתשרי
תשפ״ז`) when the shell's locale is Hebrew, and as `11 Tishri 5787` in the
interface language otherwise.

## Support

Targets **GNOME Shell 50** (the `50.x` line). No support is claimed for
any other major version.

That declaration rests on one thing: the extension has been **loaded and
enabled on one machine running GNOME Shell 50.1** — "Ubuntu" per the
machine's owner, no release number confirmed, `metadata.json` hand-patched
locally to get there (that patch has never been in this repo). **Whether
the Hebrew date actually renders in the calendar popover has still not
been confirmed by eye on any shell.** `gnome-extensions info` reporting
`ENABLED` does not tell you that — see Install, below, for why.

This extension works by reaching into GNOME Shell's private internals
(`Main.panel.statusArea.dateMenu._date`, its `_dateLabel`, and the
`TodayButton` class in `js/ui/dateMenu.js`) — none of this is a stable,
public extension API. A GNOME point release can change or remove any of it
without notice, which would silently stop the Hebrew date from appearing.
This is a real, ongoing risk of running against private surface, not a
footnote.

## Out of scope

This is a v1. It does not include holidays, parasha, the Omer count,
candle-lighting or havdalah times, zmanim, sunset-aware rollover, Hebrew
dates in the calendar's day grid, a preferences UI, support for any calendar
system other than Hebrew, or notifications of any kind. None of it is
planned for a near-term follow-up; it's simply not part of what this
extension does.

## Install

```sh
git clone https://github.com/AYA234/HebCal.git \
  ~/.local/share/gnome-shell/extensions/hebcal@aya234.github.io
```

**Restart the shell before you enable the extension — not after.** GNOME
Shell scans the extensions directory only at startup; it does not notice
a directory that appeared while it was already running. Enabling first
fails immediately, whether from the Extensions app or the CLI:

```sh
$ gnome-extensions enable hebcal@aya234.github.io
Extension does not exist
```

That reads like a bad clone path or a typo'd UUID. It isn't — it means
the shell hasn't scanned the directory yet. The fix is a restart, not a
different path.

Restart, *then* enable:

- X11: <kbd>Alt</kbd>+<kbd>F2</kbd>, type `r`, Enter. This is X11-only.
- Wayland: there is no in-session restart. Log out and back in — a full
  one, not a lock/unlock.

Then enable, via the Extensions app or:

```sh
gnome-extensions enable hebcal@aya234.github.io
```

Check what happened with `gnome-extensions info hebcal@aya234.github.io`:

- **`OUT OF DATE`** — the running shell's version isn't covered by
  `metadata.json`'s `shell-version`. The extension is enabled but was
  never loaded; nothing renders and nothing else reports a problem.
- **`ERROR`** — the extension loaded and something threw. As the code
  currently stands, `enable()` is wholly guarded and returns quietly on
  any failure in its own work, and `disable()` restores the shell's own
  method before anything that could fail — so an exception out of our own
  enable/disable path is not a route to this state. What can still
  produce it is module evaluation: the `import` statements at the top of
  `extension.js` resolve before any of our code runs, and no guard inside
  the extension can cover that. This describes what the current code can
  and cannot produce, in the present tense — it is not an account of any
  particular `ERROR` seen on a real machine; no such cause has been
  established.
- **`ENABLED` with no error — this does not mean the Hebrew date is
  rendering.** A missing or wrong-shaped internal is designed to fail
  silently (see Support, above), so a working install and a silent no-op
  look identical from this command. The only way to tell them apart is
  opening the calendar and looking.

This install path has been exercised once: cloned and restarted on a
machine running GNOME Shell 50.1, with `metadata.json` hand-patched
locally to declare it, by one person. If nothing appears, the first place
to look is `lookupTodayButtonTarget()` in `extension.js` — it's where
every GNOME-private name this extension depends on is read, and where a
mismatch against your actual shell would surface first.

## Running the tests

The test suite runs under `gjs`, GNOME Shell's own JavaScript engine —
using it instead of Node keeps the tests on the same ICU/Intl behavior the
real shell has. `gjs` is **not preinstalled**; install it first:

```sh
apt-get update && apt-get install -y gjs
```

The test files are ES modules, so they must be run with `-m`:

```sh
gjs -m tests/gematria.test.js
gjs -m tests/hebrewDate.test.js
gjs -m tests/todayButtonInjector.test.js
```

Running bare `gjs tests/<name>.js` (without `-m`) fails with `SyntaxError:
import declarations may only appear at top level of a module` — the suite
requires the module flag.

Each file prints its assertion count and exits `0` on success. No display
and no running GNOME Shell session is required; the tests exercise the
Hebrew-date conversion, the gematria formatter, and the injection module
(against a plain-JS fake of `TodayButton`) as pure JavaScript.

CI pins `ubuntu-24.04` (not `ubuntu-latest`) to keep this exact gjs/ICU
pair — see `docs/plan.md` §8. That pin matches the gjs/ICU pair GNOME
Shell 46 ran; now that `metadata.json` declares GNOME Shell 50 (see
Support, above), CI's runtime and the only shell this project claims no
longer match. Not closed here — adding or switching CI's runner is a
separate decision.
