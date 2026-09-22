# HebCal plan

Target: Ubuntu 24.04 LTS, GNOME Shell 46. Everything below is judged against one bar:
if the user can tell our code isn't part of GNOME, it's wrong.

## 1. Attachment point

We patch `TodayButton`, the widget in `js/ui/dateMenu.js` that shows the current
weekday and date above the calendar grid. `DateMenuButton._init()` builds it as
`this._date = new TodayButton(this._calendar)` and holds it at
`Main.panel.statusArea.dateMenu._date`. `TodayButton` is a small `St.Button` wrapping
a vertical `St.BoxLayout` with two labels: `this._dayLabel` (style class `day-label`)
and `this._dateLabel` (style class `date-label`), both filled by
`TodayButton.setDate(date)`.

We reach it by **function injection**: save `TodayButton.prototype.setDate`, replace
it with a wrapper that calls the original (so the Gregorian date keeps working
untouched) and then writes the Hebrew date into a label we add to the same box. We
never subclass or replace `DateMenuButton` or `TodayButton` themselves — we extend
the one already running in the shell.

Two alternatives considered and rejected:

- **A second top-bar indicator.** The obvious wrong answer, named only to be clear
  it's rejected — it fails the project's one hard rule outright.
- **Injecting into the day-grid cells** (`Calendar._rebuildCalendar()` in
  `calendar.js`, which builds an `St.Button` per day with a `label` property). This
  would put a Hebrew day number in every one of the ~42 cells, every month
  navigation. It costs far more surface area to keep in sync and tear down, and
  variable-width Hebrew numerals risk uneven cell heights — the grid shifting is
  exactly what criterion 6 forbids. Left for a possible future issue, not v1.

`setDate(date)` already receives the date we need as an argument, so this seam also
avoids listening for our own clock/tick signal — we ride the update the shell already
performs.

## 2. Target version

Built and tested against **GNOME Shell 46**, the default shell on **Ubuntu 24.04
LTS**. We do not claim to support 45, 47, or any other Ubuntu release. These are
private internals (`_date`, `_dateLabel`, `TodayButton`, `_rebuildCalendar` are not
part of any stable extension API), so a point release changing them is a real risk,
not a footnote — see open question 2.

## 3. Clean teardown

What we hold: the original `TodayButton.prototype.setDate` function reference, and
the `St.Label` actor we created and added to the box.

`disable()`:
1. Restore `TodayButton.prototype.setDate = original`.
2. Destroy the label actor (removes it from the `St.BoxLayout` and frees it).

Nothing else is held — no extra signal connections, no timers, no GSettings. The
failure we're avoiding: patching the prototype twice across a disable/enable cycle
(leaving a wrapper-of-a-wrapper, or two Hebrew labels stacked in the box). Storing
the *original* function once, at `enable()` time, and always restoring exactly that
reference, keeps re-enable idempotent.

## 4. Hebrew date computation

Primary plan: use the platform's own `Intl.DateTimeFormat` with the Hebrew calendar
(`new Intl.DateTimeFormat('en-u-ca-hebrew', {...}).format(date)`), which needs no
bundled dependency at all — GJS's SpiderMonkey runtime carries its own ICU. This is
the cleanest possible answer to "how does it ship inside a GJS extension with no
runtime package manager": nothing ships, it's already there.

This is unverified in this environment (no GJS to run it against) — see open
question 1. If GNOME Shell 46's mozjs build turns out to lack Hebrew calendar
support in `Intl`, the fallback is our own pure-JS arithmetic conversion
(Dershowitz & Reingold's algorithm, the same family used by the `hebcal` project
itself): compute the Hebrew year from the Gregorian year, apply the four
postponement rules (*dechiyot*) to fix Rosh Hashanah's weekday, derive year length
(deficient/regular/complete: 353–355 days, or 383–385 in a leap year), and use the
metonic 19-year cycle (leap in years 3, 6, 8, 11, 14, 17, 19 of the cycle) to decide
whether the year has one Adar or two. In a leap year, day-of-year arithmetic simply
treats Adar I and Adar II as two separate months in sequence; no special-casing
beyond that is needed once the year-length table is right.

Either path is a pure function of a Gregorian date in, a Hebrew date out — no GNOME
dependency either way, which is what makes criterion 8 possible.

## 5. Rollover

**V1 ignores sunset.** The Hebrew date shown is the direct calendrical conversion of
today's Gregorian date, refreshed exactly when the shell refreshes the Gregorian
date (civil midnight), not at sunset. In one sentence: if you open the calendar at
21:00, you'll see the Hebrew date that mathematically corresponds to today's
Gregorian date, not the Hebrew date that — by Jewish tradition — already began at
sunset a few hours earlier. Sunset-aware rollover is out of scope for v1 (see
section 7); it would need a location or timezone-sunset source we don't have yet.

## 6. Native by inheritance

The Hebrew date becomes a third `St.Label`, added as a child of the same
`St.BoxLayout` that already holds `_dayLabel` and `_dateLabel`, placed after
`_dateLabel`. We give it the existing `date-label` style class rather than inventing
one — it inherits that rule's font family, size, color and spacing straight from the
shell's own stylesheet, so it matches the Gregorian date line by construction, not
by copying values. We do not set an explicit `x_align`, matching how `_dateLabel`
itself is built, so it inherits the same alignment behavior rather than a hardcoded
one.

RTL/LTR: the label's own text is Hebrew and Pango's bidi algorithm handles that
regardless of the shell's overall text direction. We do not hardcode direction or
alignment on the new label, so it follows the same rules the rest of the popup
already follows for this locale.

Non-Hebrew locale: open question — whether the date renders in Hebrew script and
Hebrew numerals always, or transliterates into the interface language (e.g. "10
Tishrei 5787") when the system isn't Hebrew. See open question 3.

Grid layout: untouched. We never touch `Calendar` or `_rebuildCalendar()`; the day
grid and the events/clocks/weather sections below it are unaffected. Only
`TodayButton` itself grows by one line, which is where the feature is supposed to
show up.

## 7. Out of scope for v1

- Holidays, parasha, the Omer count, candle-lighting or havdalah times, zmanim.
- Sunset-aware day rollover (section 5).
- Hebrew dates in the day-grid cells (section 1).
- A preferences UI or any settings toggle.
- Any calendar system other than Hebrew.
- Notifications or reminders of any kind.

## 8. Provable without a live GNOME session

Pure and testable here: the Hebrew date conversion (section 4), whichever path it
ends up on. It takes a Gregorian date, returns a Hebrew date, and touches nothing
from `gi`/`St`/`Clutter`/`Main`. It gets its own module with no shell imports, run
and asserted against known reference dates with `gjs tests/<name>.js` (GJS runs
plain JS with no `imports.gi` usage fine, no display required). That command is what
CI and this environment can both actually run.

Not testable here, honestly: whether the injection finds the real `_date` /
`_dateLabel` / `TodayButton` in an actual running shell, whether the label renders
where and how we expect, RTL layout in a Hebrew locale, whether disable/enable
cycles leave anything behind, whether the grid genuinely doesn't shift. Those need a
real GNOME Shell 46 session and a documented manual pass:
1. Symlink the extension into `~/.local/share/gnome-shell/extensions/`.
2. Restart the shell (X11: Alt+F2, `r`; Wayland: log out and back in) and enable it
   via the Extensions app.
3. Open the calendar, confirm the Hebrew date appears under the Gregorian one with
   no visible font/color mismatch and no grid shift.
4. Disable, re-enable, repeat several times; confirm no duplicate or leftover label.
5. Switch to a Hebrew locale and repeat step 3.

No implementation issue should claim more than this section promises.

## 9. Issue breakdown

1. **Scaffold** — `metadata.json`, `extension.js` with empty `enable()`/`disable()`.
   First, because nothing else is installable or reviewable without it.
2. **Hebrew date conversion module**, with unit tests per section 8. No GNOME
   dependency, so it can be built and fully reviewed on its own — and everything
   after this needs a date to show.
3. **Inject the label into `TodayButton`**, wired to a fixed test value, with full
   teardown per section 3. Proves the seam and the disable/enable story before
   correctness of the date matters.
4. **Wire the real conversion into the label**, replacing the fixed test value.
   Small, isolated integration commit.
5. **Theming/RTL pass** — confirm style-class choice and locale behavior from
   section 6 against a real session; only needed if the manual pass in issue 3 or 4
   turns up a mismatch.
6. **Packaging** — README, `extensions.gnome.org` submission requirements, final
   manual-verification pass from section 8.

Order follows dependency, not difficulty: each issue leaves the extension
installable and working, and nothing after issue 2 can be honestly tested without
issue 1, and nothing visual can be tried without issue 3's seam existing first.

## 10. Open questions

1. Does GNOME Shell 46's bundled GJS/mozjs actually support the Hebrew calendar in
   `Intl.DateTimeFormat`? This decides which branch of section 4 we build. Needs a
   `gjs -c "print(new Intl.DateTimeFormat('en-u-ca-hebrew').format(new Date()))"`
   check in a real environment before issue 2 is written up.
2. All internal names in this plan (`_date`, `_dateLabel`, `_dayLabel`,
   `TodayButton`, the `date-label`/`day-label` style classes) come from reading the
   `gnome-46` branch of `gnome-shell` source, not from introspecting a running
   session. They need confirming against the actual installed Ubuntu 24.04 shell
   before issue 3 starts.
3. Hebrew script and numerals always, or transliterated into the interface language
   for non-Hebrew locales? This is a product call, not an engineering one.
4. Exact format string for the new line (e.g. "10 Tishrei 5787" vs Hebrew script) —
   depends on question 3, but needs one canonical answer before issue 4.
5. Do we pin to exactly GNOME Shell 46.0, or accept the whole 46.x range Ubuntu
   24.04 has shipped as point updates? Depends on whether the private names in
   question 2 are stable across those points — unknown from here.
