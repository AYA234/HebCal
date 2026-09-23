// Module-scope imports (issue #11 criterion 5 - accounted for individually,
// not asserted as a group):
//
// 1. Extension (resource:///.../extensions/extension.js) - mandated. The
//    shell loads this class as the extension itself; if this import fails
//    there is no extension object for any guard to run inside.
// 2. St (gi://St) - a GI typelib, not a resource:/// shell-internal JS
//    path. It's generated from GNOME's own introspection data against the
//    installed platform libraries, and is the surface most GNOME Shell
//    extensions build their UI from - materially more stable across shell
//    versions than one internal JS module's export list, though still not
//    a guaranteed-stable extension API.
// 3. Main (resource:///org/gnome/shell/ui/main.js) - a GNOME-private shell
//    path we chose deliberately (plan §10 Q1): it's the only route to the
//    live Main.panel.statusArea.dateMenu._date instance (see §1). Kept,
//    not deferred - a dynamic import() would make enable() asynchronous
//    while GNOME calls it synchronously and does not await it, so a
//    disable() could run before the import resolves and the continuation
//    would then patch a shell the extension was told to let go of. Keeping
//    it static and accepting the version risk is the tested, correct
//    choice here; the real mitigation for that risk is #12's version
//    declaration, not anything this file can do.
//
// None of the three can be guarded from inside this module: they resolve
// before any of this file's own code runs, so no try/catch written here
// can cover them. That is a real gap, and it stays one - see the plan §3
// note on what this issue closes and what it doesn't.
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import St from 'gi://St';
import Main from 'resource:///org/gnome/shell/ui/main.js';

import {formatHebrewDate} from './lib/hebrewDate.js';
import {attach} from './lib/todayButtonInjector.js';

// The one place every unverified GNOME-private name lives (plan §1, §10
// Q1): TodayButton is module-local in js/ui/dateMenu.js and not exported,
// so the live instance is reached via Main.panel.statusArea.dateMenu._date
// instead. The style class comes from the existing _dateLabel rather than
// a hardcoded 'date-label' string, so reusing the class stays correct even
// if its name changes. dateLabel itself, not its resolved parent box, is
// handed to attach() - resolving the box (dateLabel.get_parent()) is a
// method call that can fail on a wrong-shaped object, and that risk now
// lives inside attach()'s own guard, where it's tested (issue #11).
// Everything here is a plain property read, which cannot throw.
function lookupTodayButtonTarget() {
    const target = Main.panel.statusArea.dateMenu?._date;
    if (!target)
        return null;

    const dateLabel = target._dateLabel;
    if (!dateLabel)
        return null;

    return {target, dateLabel, styleClass: dateLabel.style_class};
}

export default class HebCalExtension extends Extension {
    enable() {
        // Issue #11: the pre-existing guard only covered a missing name;
        // this covers the whole of enable()'s own work - a present but
        // wrong-shaped name, a constructor that rejects its arguments, an
        // Intl call that raises. Nothing here has run yet when any of
        // these can fail, so there's no state to unwind on this side;
        // attach() (lib/todayButtonInjector.js) unwinds its own side
        // effects if it fails partway through. A quiet return stays
        // quiet: no notification, no console.error, no log() - silence on
        // a broken surface is deliberate (plan §3), not less so because
        // the break is a TypeError instead of a null.
        try {
            const found = lookupTodayButtonTarget();
            if (!found)
                return;

            // A registered BCP-47 tag is required by formatHebrewDate's
            // contract; GLib.get_language_names()/$LANG hand back POSIX
            // forms that throw. resolvedOptions().locale is always a
            // registered tag and needs no gi import - proven end to end in
            // tests/hebrewDate.test.js rather than asserted here.
            const locale = Intl.DateTimeFormat().resolvedOptions().locale;
            const label = new St.Label({style_class: found.styleClass});

            this._handle = attach(found.target, found.dateLabel, label,
                date => formatHebrewDate(date, locale));
        } catch {
            this._handle = null;
        }
    }

    disable() {
        // detach() (lib/todayButtonInjector.js) restores the original
        // setDate unconditionally before attempting to free the label, so
        // it cannot throw and leave setDate unrestored - nothing further
        // to guard here.
        this._handle?.detach();
        this._handle = null;
    }
}
