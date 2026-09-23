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

`TodayButton` is a module-local class in `js/ui/dateMenu.js`; under GNOME 45+ ES
modules an extension can only import what that module exports, and it does not export
`TodayButton` — only `DateMenuButton`. So we cannot reach the class or its prototype
from outside. We reach the one instance that exists instead: `enable()` reads
`Main.panel.statusArea.dateMenu._date`, which is the live `TodayButton` already
running in the shell, and patches **that instance's** `setDate`, not
`TodayButton.prototype.setDate`. We save the instance's own original method, replace
it with a wrapper that calls the original (so the Gregorian date keeps working
untouched) and then writes the Hebrew date into a label we add to the same box. There
is exactly one `TodayButton` in a running shell and the wrapper closes over exactly
one label, so an instance patch is both the only route available and the correct one
— a prototype patch, even if it were reachable, would have every future instance
sharing a wrapper built around a single label actor.

Two alternatives considered and rejected:

- **Subclassing or replacing `DateMenuButton` wholesale.** `DateMenuButton` *is*
  exported, so this is technically reachable, unlike a `TodayButton` subclass. But
  `Main.panel.statusArea.dateMenu` is set once at shell startup; replacing it means
  either monkey-patching the panel's `statusArea` entry (holding and restoring far
  more state — the whole button, its signal connections, its actor tree) or
  reimplementing everything `DateMenuButton` already does around the one line we
  need. It fails criterion 3 before it fails anything else: the teardown surface
  is the entire menu instead of one method reference and one label.
- **Injecting into the day-grid cells** (`Calendar._rebuildCalendar()` in
  `calendar.js`, which builds an `St.Button` per day with a `label` property). This
  would put a Hebrew day number in every one of the ~42 cells, every month
  navigation. It costs far more surface area to keep in sync and tear down, and
  variable-width Hebrew numerals risk uneven cell heights — the grid shifting is
  exactly what criterion 6 forbids. Left for a possible future issue, not v1.

`setDate(date)` already receives the date we need as an argument, so this seam also
avoids listening for our own clock/tick signal — we ride the update the shell already
performs. That said, how often the shell actually calls `setDate` (assumed: on
civil-midnight rollover, and whenever the calendar popup logic re-syncs) is not
something we've verified — see open question 1, which now also carries this
assumption.

## 2. Target version

Built and tested against **GNOME Shell 46**, the default shell on **Ubuntu 24.04
LTS**. We do not claim to support 45, 47, or any other Ubuntu release. These are
private internals (`_date`, `_dateLabel`, `TodayButton`, `_rebuildCalendar` are not
part of any stable extension API), so a point release changing them is a real risk,
not a footnote — see open question 2.

## 3. Clean teardown

What we hold: the original `setDate` function reference taken from the live
`Main.panel.statusArea.dateMenu._date` instance (not the prototype — see section 1),
and the `St.Label` actor we created and added to the box.

`enable()`:
1. Look up `Main.panel.statusArea.dateMenu._date`. If it, its `setDate`, or its
   internal box aren't there, **return quietly** — no exception, no half-applied
   state. This is private API on an unpinned point-release range; the single most
   visible way to break the "not part of GNOME" bar is an uncaught exception out of
   `enable()` producing the shell's own "extension error" notification. Silence on a
   missing surface is a deliberate choice, not an oversight.
2. Save the instance's current `setDate`, wrap it, assign the wrapper.
3. Create the label, add it to the box, and **paint it immediately** from today's
   date — not just from the next `setDate` call. Extensions are disabled and
   re-enabled on every screen lock by default, so the gap between `enable()` and the
   next shell-driven `setDate` call is not a rare window; it's what a user sees after
   every unlock if we leave it empty.

`disable()`:
1. Restore the instance's `setDate = original`.
2. Destroy the label actor (removes it from the `St.BoxLayout` and frees it).

Nothing else is held — no extra signal connections, no timers, no GSettings. The
failure we're avoiding: patching the instance twice across a disable/enable cycle
(leaving a wrapper-of-a-wrapper, or two Hebrew labels stacked in the box). Storing
the *original* function once, at `enable()` time, and always restoring exactly that
reference, keeps re-enable idempotent.

**Widened guard (issue #11).** The description above covers a *missing* surface —
`enable()` returning quietly when a name isn't there. A first field install (GNOME
Shell 50.1 against a `shell-version` of `["46"]`) showed that isn't the whole
failure surface: a name can be *present but the wrong shape*, and the code that
looks up the live `TodayButton` (`extension.js`'s `lookupTodayButtonTarget()`) was
calling a method on it (`dateLabel.get_parent()`) with no guard at all, outside
`enable()`'s reach if that call threw. The guard is now specified more broadly:

- `enable()` must not throw, full stop — not just on a missing name, on any
  failure anywhere in its own work (a wrong-shaped name, a constructor call, an
  `Intl` call). It stays a quiet return: no exception, no notification, no
  logging.
- Nothing in that work is allowed to leave half-applied state behind on a failure
  path — if `setDate` was already replaced or the label already added to the box
  when something failed, that gets undone before returning, not left for the next
  `enable()` to trip over.
- `disable()` must not throw either. Restoring `setDate` by identity happens
  unconditionally, before any attempt to free the label actor, so a failure
  freeing the actor can never leave the shell's own method un-restored.
- The wrapped `setDate` itself must not let a formatting failure escape into
  GNOME's own call site. The original always runs first, unconditionally; if our
  formatting throws, the Hebrew label is simply left with its previous text.
  Decided explicitly: the wrapper **keeps trying on every subsequent call** rather
  than detaching itself after one failure — no extra state to track, and it lets a
  transient failure (or a locale that later becomes valid) recover on its own
  without needing a fresh disable/enable cycle.
- Where possible, this containment lives in the already-testable injection module
  (`lib/todayButtonInjector.js`) rather than in `extension.js`, which cannot be
  imported by the `gjs` test suite at all (its module-scope imports resolve
  against `resource:///` shell paths that don't exist outside a running shell).
  Resolving the label's parent box (`dateLabel.get_parent()`) moved into
  `attach()` for exactly this reason — it's a method call that can fail on a
  wrong-shaped object, and inside `attach()` it's covered by a guard the test
  suite actually drives.

**What this does not close.** Module-scope `import` statements in `extension.js`
resolve before any code in that file runs, `enable()` included — no guard written
in this module can cover them. If a `resource:///` shell-internal path doesn't
exist on the running shell, that failure happens at import time, outside any
containment an extension can build for itself. The only real mitigation is the
`shell-version` declaration in `metadata.json` being accurate, which is a
separate concern (issue #12), not something this guard can substitute for.

## 4. Hebrew date computation

**Decided: the platform's own `Intl.DateTimeFormat` with the Hebrew calendar.**
Verified in this environment by installing `gjs 1.80.2` — the exact version Ubuntu
24.04 ships and GNOME Shell 46 runs on:

```
new Intl.DateTimeFormat('en-u-ca-hebrew').format(...)  →  correct Gregorian→Hebrew conversion
new Intl.DateTimeFormat('he-u-ca-hebrew').format(...)  →  Hebrew month names in Hebrew script (בְּ...אֱלוּל, confirmed by codepoint, not just terminal display)
15 Mar 2024 → "5 Adar II 5784"                          →  leap year and Adar I/II handled correctly
resolvedOptions().calendar === 'hebrew'
```

This needs no bundled dependency at all — GJS's SpiderMonkey runtime carries its own
ICU, so nothing ships beyond our own code. The prior revision's open question 1 —
whether GJS's ICU actually supports the Hebrew calendar — is closed: yes, it works,
on the exact runtime we target. There is no fallback algorithm in this plan —
`CLAUDE.md` rules out speculative options, and a rejected alternative kept "in case"
is exactly that.

**But the `hebr` numbering system is not supported**, verified three ways on the same
runtime:

```
'he-u-ca-hebrew-nu-hebr'                      → resolvedOptions().numberingSystem === 'latn'  (nu-hebr silently dropped)
{numberingSystem: 'hebr'} option              → resolvedOptions().numberingSystem === 'latn'
Intl.supportedValuesOf('numberingSystem')     → does not include 'hebr'
```

So `Intl` alone gives us `11 בתשרי 5787`, never `י״א בתשרי תשפ״ז`. This is not
independent of the rendering question the prior revision left open — it decides
whether the `Intl` path is sufficient on its own (it is, for the non-Hebrew case) or
whether we also need our own numeral formatting (we do, for the Hebrew case). The
product decision, which closes the prior revision's open questions 3 and 4:
**Hebrew script with gematria numerals when the shell locale is Hebrew; `11 Tishri
5787` in the interface language otherwise.**

That means two pieces of computation, both pure functions with no GNOME dependency:

- The Hebrew calendar date itself, via `Intl.DateTimeFormat(..., {day: 'numeric',
  month: 'long', year: 'numeric'}).formatToParts(date)` — read with the `en-u-ca-hebrew`
  locale to get plain numeric day/year and an English month name reliably, regardless
  of which numbering system was silently substituted.
- A small **gematria formatter** (number → Hebrew numeral string, e.g. `11` →
  `י״א`, `5787` → `תשפ״ז`, with the standard geresh/gershayim marks), used only for
  the Hebrew-locale case, together with a Hebrew month-name table for gematria mode
  (twelve entries plus Adar I/II, not derived from `Intl` since we need script output
  independent of its numbering-system gap). Small, pure, and unit-testable per
  section 8.

Either the plain `Intl` formatting or the `Intl` + gematria path is a pure function
of a Gregorian date in, a formatted string out — no GNOME dependency either way,
which is what makes criterion 8 possible.

## 5. Rollover

**V1 ignores sunset.** The Hebrew date shown is the direct calendrical conversion of
today's Gregorian date, refreshed exactly when the shell refreshes the Gregorian
date (civil midnight), not at sunset. In one sentence: if you open the calendar at
21:00, you'll see the Hebrew date that mathematically corresponds to today's
Gregorian date, not the Hebrew date that — by Jewish tradition — already began at
sunset a few hours earlier. Sunset-aware rollover is out of scope for v1 (see
section 7); it would need a location or timezone-sunset source we don't have yet.
The seam for it later: the conversion (section 4) takes the date to convert as its
only input, so sunset support means shifting that input by a day under some future
condition, not reworking the conversion or the injection.

## 6. Native by inheritance

The Hebrew date becomes a third `St.Label`, added as a child of the same
`St.BoxLayout` that already holds `_dayLabel` and `_dateLabel`, placed after
`_dateLabel`. We do not set an explicit `x_align`, matching how `_dateLabel` itself
is built, so it inherits the same alignment behavior rather than a hardcoded one.

**Visual weight, decided explicitly, not by convenience:** we checked first whether
GNOME Shell's own stylesheet has a ready-made "secondary line" rule we could inherit
the way GTK apps inherit `dim-label` — it does not. Reading the `gnome-46`
`gnome-shell-sass` source (`_calendar.scss`, `_common.scss`, `_misc.scss`,
`widgets.scss`'s full import list), the shell's St theme has no `.dim-label`
equivalent; the nearest precedent, `$insensitive_fg_color`, is a Sass build-time
variable baked into specific compiled classes (`.event-time`, `.events-title`), not
something our extension's own runtime stylesheet can reference without either
hardcoding the resolved color — which criterion 6 rules out — or relying on a named
theme-color alias we have not confirmed exists in the compiled CSS a live session
would show us.

Given that, **v1 keeps plain `date-label`, unchanged, at equal visual weight** to the
Gregorian line. This is the purest form of inheritance available: zero self-authored
CSS, and no guessing at a de-emphasis mechanism we can't verify without a running
shell. It is a decision, not the default we'd get by not thinking about it — and it
trades a design nicety (subordinate line) for staying strictly inside what's proven.
Revisiting a dimmer treatment, once a live session lets us confirm a real,
theme-native way to do it without hardcoding a color, is folded into open question 1
below rather than guessed at here.

RTL/LTR: the label's own text is Hebrew and Pango's bidi algorithm handles that
regardless of the shell's overall text direction. We do not hardcode direction or
alignment on the new label, so it follows the same rules the rest of the popup
already follows for this locale.

Non-Hebrew locale: resolved in section 4 — Hebrew script with gematria numerals when
the shell locale is Hebrew, `11 Tishri 5787` (interface language) otherwise.

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

**Runner:** `gjs`, matching the shell's own mozjs rather than Node's own ICU build.
It is **not preinstalled** in this environment or assumed present anywhere else —
installing it (`apt-get update && apt-get install -y gjs`, available in Ubuntu's
`noble/main`) is a prerequisite step, not a given. CI runs the suite on every push
and pull request via `.github/workflows/tests.yml`, on `ubuntu-24.04`.

Pure and testable here, run with `gjs -m tests/<name>.js` (GJS runs plain JS with no
`imports.gi` usage fine, no display required):

- **The Hebrew date conversion and gematria formatter** (section 4). Takes a
  Gregorian date, returns a formatted string. Touches nothing from
  `gi`/`St`/`Clutter`/`Main`. Asserted against known reference dates, including a
  leap year (Adar I/II) and both the Hebrew-script and interface-language output
  modes.
- **The injection module's disable/enable idempotence**, previously left entirely
  as "confirm by eye." The injection module takes its target as an argument instead
  of reaching for `Main.panel.statusArea.dateMenu._date` itself, so it can be driven
  against a plain-JS fake in place of a real `TodayButton`: an object with a
  `setDate` method, and a box stub exposing `add_child`/`remove_child`/`destroy`.
  Against that fake we assert:
  (a) the original `setDate` still runs and still receives its date argument,
  (b) exactly one label is added to the box,
  (c) after teardown, the target's `setDate` is `===` the saved original, and the
  label was destroyed,
  (d) enable → disable → enable, twice, leaves exactly one label and no
  wrapper-of-a-wrapper.
  This is the automated half of "no leftovers after disable/enable cycles," and it
  needs no display. It does not prove the fake matches the real `TodayButton`'s
  shape — that's what the manual pass below is for.

Not testable here, honestly: whether `Main.panel.statusArea.dateMenu._date` and its
internals actually match what the injection module expects in a real running shell,
whether the label renders where and how we expect, RTL layout in a Hebrew locale,
whether the grid genuinely doesn't shift. Those need a real GNOME Shell 46 session
and a documented manual pass:
1. Symlink the extension into `~/.local/share/gnome-shell/extensions/`.
2. Restart the shell (X11: Alt+F2, `r`; Wayland: log out and back in) and enable it
   via the Extensions app.
3. Open the calendar, confirm the Hebrew date appears under the Gregorian one,
   already filled in (not blank), with no visible font/color mismatch and no grid
   shift.
4. Disable, re-enable, repeat several times, including across a simulated screen
   lock; confirm no duplicate or leftover label.
5. Switch to a Hebrew locale and repeat step 3, confirming gematria numerals.

No implementation issue should claim more than this section promises.

## 9. Issue breakdown

1. **Scaffold** — `metadata.json`, `extension.js` with empty `enable()`/`disable()`.
   First, because nothing else is installable or reviewable without it.
2. **Hebrew date conversion module + gematria formatter**, with unit tests per
   section 8. No GNOME dependency, so it can be built and fully reviewed on its own
   — and everything after this needs a date to show.
3. **Inject the label into the live `TodayButton` instance, wired to the real
   conversion from the start**, with full teardown and the fake-target tests from
   section 8, plus the theming/RTL checks from section 6 folded into its acceptance
   criteria. One issue, not staged behind a fixed test value: a fixed value would
   ship something installable but showing a made-up date, which isn't
   "working" in the sense this plan is held to, and the conversion module already
   exists by the time this issue starts.
4. **Packaging** — README and the final manual-verification pass from section 8.
   No `extensions.gnome.org` submission: publishing to a public registry is an
   outward-facing release action on an account neither of us has, and out of scope
   for this issue breakdown.

Order follows dependency, not difficulty: each issue leaves the extension
installable and working, and nothing after issue 2 can be honestly tested without
issue 1, and nothing visual can be tried without issue 3's seam existing first.

## 10. Open questions

1. All internal names in this plan (`_date`, `_dateLabel`, `_dayLabel`,
   `TodayButton`, the `date-label`/`day-label` style classes, and the assumption
   that `setDate` is called on civil-midnight rollover) come from reading the
   `gnome-46` branch of `gnome-shell` source, not from introspecting a running
   session. They need confirming against the actual installed Ubuntu 24.04 shell
   before issue 3 starts. While there, also check whether the compiled theme
   exposes any named color we could use to dim the Hebrew line without hardcoding
   one (section 6) — worth a follow-up issue if it does, not required for v1.
2. Do we pin to exactly GNOME Shell 46.0, or accept the whole 46.x range Ubuntu
   24.04 has shipped as point updates? Depends on whether the private names in
   question 1 are stable across those points — unknown from here.
