import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import St from 'gi://St';
import Main from 'resource:///org/gnome/shell/ui/main.js';

import {formatHebrewDate} from './lib/hebrewDate.js';
import {attach} from './lib/todayButtonInjector.js';

// The one place every unverified GNOME-private name lives (plan §1, §10
// Q1): TodayButton is module-local in js/ui/dateMenu.js and not exported,
// so the live instance is reached via Main.panel.statusArea.dateMenu._date
// instead. The box and style class come from the existing _dateLabel
// rather than a guessed box property name or a hardcoded 'date-label'
// string, so reusing the class stays correct even if its name changes.
// If any of this turns out wrong on a real shell, this function is the
// only thing that needs fixing.
function lookupTodayButtonTarget() {
    const target = Main.panel.statusArea.dateMenu?._date;
    if (!target)
        return null;

    const dateLabel = target._dateLabel;
    if (!dateLabel)
        return null;

    const box = dateLabel.get_parent();
    if (!box)
        return null;

    return {target, box, styleClass: dateLabel.style_class};
}

export default class HebCalExtension extends Extension {
    enable() {
        const found = lookupTodayButtonTarget();
        if (!found)
            return;

        // A registered BCP-47 tag is required by formatHebrewDate's
        // contract; GLib.get_language_names()/$LANG hand back POSIX forms
        // that throw. resolvedOptions().locale is always a registered tag
        // and needs no gi import - proven end to end in
        // tests/hebrewDate.test.js rather than asserted here.
        const locale = Intl.DateTimeFormat().resolvedOptions().locale;
        const label = new St.Label({style_class: found.styleClass});

        this._handle = attach(found.target, found.box, label,
            date => formatHebrewDate(date, locale));
    }

    disable() {
        this._handle?.detach();
        this._handle = null;
    }
}
