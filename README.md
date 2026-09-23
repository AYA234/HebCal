# HebCal

Shows the Hebrew date alongside the Gregorian date in the GNOME Shell top-bar
calendar. Not a separate app, panel, or indicator — the Hebrew date is added
as a second line under the existing "Today" date in the stock calendar
popover, styled to match. If you can tell it's not part of GNOME, that's a
bug.

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

Built and tested against **GNOME Shell 46**, the default shell on **Ubuntu
24.04 LTS**. No support is claimed for GNOME Shell 45, 47, or any other
Ubuntu release — this has not been built or tested against them.

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
