// Adds a Hebrew-date label to a TodayButton-shaped target and wires it to
// the target's own setDate calls. Takes its target and date-label as
// arguments instead of reaching for Main.panel.statusArea.dateMenu._date
// itself, so it can be driven against a plain-JS fake with no GNOME
// dependency at all - see tests/todayButtonInjector.test.js. Every
// GNOME-private name this depends on (_date, _dateLabel, the
// day-label/date-label classes) stays in extension.js's lookup function;
// this module never sees them.
//
// Failure containment (issue #11): attach() is the extension's whole setup
// path, so every side effect it can perform - replacing setDate, adding
// the label to the box, the initial paint - is wrapped, and any failure
// anywhere in that path unwinds exactly what was done and returns null,
// the same quiet-return result a missing target/box already produced. The
// dateLabel.get_parent() call that used to happen unguarded in extension.js
// now happens here instead, inside that same guard, which is what makes it
// testable: a dateLabel stand-in with no get_parent, or one that throws, is
// just another fake driven through this one entry point.
//
// Once attached, the wrapper never lets a formatting failure escape into
// GNOME's own setDate caller (the original still runs first, unconditionally).
// If formatDate throws, this tick's label text is left as it was and the
// wrapper keeps trying on every subsequent setDate call - it does not detach
// itself, so a transient failure (or one later shell locale change) can
// recover without needing a fresh enable()/disable() cycle.

// target: an object with a setDate(date) method - the live TodayButton
//   instance, or a fake in tests.
// dateLabel: an object with get_parent() returning the BoxLayout the
//   existing day/date labels live in - the live _dateLabel actor, or a
//   fake in tests.
// label: the label actor to add; already built with whatever style class
//   the caller decided on. Only its `.text` property is written here.
// formatDate(date): pure function producing the label's text.
//
// Returns a handle with detach(), or null if target/dateLabel don't look
// usable, or anything in the setup path failed - the quiet-return guard
// extension.js's enable() relies on. Never throws.
export function attach(target, dateLabel, label, formatDate) {
    if (!target || typeof target.setDate !== 'function' ||
        !dateLabel || typeof dateLabel.get_parent !== 'function') {
        return null;
    }

    let box;
    try {
        box = dateLabel.get_parent();
    } catch {
        return null;
    }
    if (!box || typeof box.add_child !== 'function' ||
        typeof box.remove_child !== 'function') {
        return null;
    }

    const originalSetDate = target.setDate;

    try {
        target.setDate = function (date) {
            originalSetDate.call(this, date);
            try {
                label.text = formatDate(date);
            } catch {
                // Formatting failed this tick; the label keeps its previous
                // text and we try again on the next setDate call.
            }
        };

        box.add_child(label);
        label.text = formatDate(new Date());
    } catch {
        target.setDate = originalSetDate;
        try {
            box.remove_child(label);
        } catch {}
        try {
            label.destroy();
        } catch {}
        return null;
    }

    return {
        detach() {
            // Restoring the shell's own setDate is what matters; it happens
            // unconditionally and first, so it holds even if freeing our
            // own actor below fails.
            target.setDate = originalSetDate;
            try {
                box.remove_child(label);
            } catch {}
            try {
                label.destroy();
            } catch {}
        },
    };
}
