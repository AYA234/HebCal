// Adds a Hebrew-date label to a TodayButton-shaped target and wires it to
// the target's own setDate calls. Takes its target and box as arguments
// instead of reaching for Main.panel.statusArea.dateMenu._date itself, so
// it can be driven against a plain-JS fake with no GNOME dependency at
// all - see tests/todayButtonInjector.test.js. Every GNOME-private name
// this depends on (_date, _dateLabel, the day-label/date-label classes)
// stays in extension.js's lookup function; this module never sees them.

// target: an object with a setDate(date) method - the live TodayButton
//   instance, or a fake in tests.
// box: an object with add_child/remove_child - the BoxLayout the existing
//   day/date labels live in.
// label: the label actor to add; already built with whatever style class
//   the caller decided on. Only its `.text` property is written here.
// formatDate(date): pure function producing the label's text.
//
// Returns a handle with detach(), or null if target/box don't look usable
// - the quiet-return guard extension.js's enable() relies on.
export function attach(target, box, label, formatDate) {
    if (!target || typeof target.setDate !== 'function' ||
        !box || typeof box.add_child !== 'function' ||
        typeof box.remove_child !== 'function') {
        return null;
    }

    const originalSetDate = target.setDate;

    target.setDate = function (date) {
        originalSetDate.call(this, date);
        label.text = formatDate(date);
    };

    box.add_child(label);
    label.text = formatDate(new Date());

    return {
        detach() {
            target.setDate = originalSetDate;
            box.remove_child(label);
            label.destroy();
        },
    };
}
