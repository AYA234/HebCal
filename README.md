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

Restart GNOME Shell (X11: <kbd>Alt</kbd>+<kbd>F2</kbd>, type `r`, Enter;
Wayland: log out and back in), then enable **HebCal** via the Extensions
app.

This install has not yet been exercised on a running GNOME Shell 46
session (see Support, above). If it fails to appear, the first place to
look is `lookupTodayButtonTarget()` in `extension.js` — it's where every
GNOME-private name this extension depends on is read, and where a mismatch
against your actual shell would surface first.

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
