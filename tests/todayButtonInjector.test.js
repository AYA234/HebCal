import {attach} from '../lib/todayButtonInjector.js';
import {formatHebrewDate} from '../lib/hebrewDate.js';
import {assertEqual, assertCount} from './assert.js';

// Plain-JS fakes standing in for the real TodayButton instance and its
// St.BoxLayout - see docs/plan.md section 8. Deliberately strict: the box
// stub only appends/removes real entries and the target records every
// setDate call, so a wrapper-of-a-wrapper or a label added twice fails
// loudly instead of slipping past a permissive stub.

function makeFakeTarget() {
    return {
        received: [],
        setDate(date) {
            this.received.push(date);
        },
    };
}

function makeFakeBox() {
    return {
        children: [],
        add_child(child) {
            this.children.push(child);
        },
        remove_child(child) {
            const index = this.children.indexOf(child);
            if (index !== -1)
                this.children.splice(index, 1);
        },
    };
}

// attach() takes the dateLabel stand-in, not the box directly (issue #11):
// resolving the box is a get_parent() call that can fail on a wrong-shaped
// object, and that risk lives inside attach()'s own guard.
function makeFakeDateLabel(box) {
    return {style_class: 'date-label', get_parent: () => box};
}

function makeFakeLabel() {
    return {
        text: '',
        destroyed: false,
        destroy() {
            this.destroyed = true;
        },
    };
}

// (a) original setDate still runs and receives its date argument.
// (b) exactly one label added, with its real formatted text.
// Criterion 4: enable paints immediately from today, not a fixed value.
{
    const target = makeFakeTarget();
    const box = makeFakeBox();
    const dateLabel = makeFakeDateLabel(box);
    const label = makeFakeLabel();
    let lastFormatted;
    const formatDate = date => {
        lastFormatted = date;
        return formatHebrewDate(date, 'en');
    };

    const handle = attach(target, dateLabel, label, formatDate);

    assertEqual(box.children.length, 1, 'exactly one label added to box');
    assertEqual(box.children[0], label, 'the label added is the one passed in');
    assertEqual(lastFormatted.toDateString(), new Date().toDateString(),
        'enable paints immediately from today, not on the next setDate call');
    assertEqual(label.text, formatHebrewDate(lastFormatted, 'en'),
        'immediate paint is wired to the real conversion');

    const testDate = new Date(2026, 8, 22);
    target.setDate(testDate);

    assertEqual(target.received.length, 1, 'original setDate still runs');
    assertEqual(target.received[0], testDate, 'original setDate receives the same date argument');
    assertEqual(label.text, '11 Tishri 5787',
        'wrapper repaints the label from the real Hebrew conversion, non-Hebrew branch');

    handle.detach();
}

// Same wiring, Hebrew-locale branch - proves both branches of criterion 13
// actually reach the label text, not just the pure conversion function.
{
    const target = makeFakeTarget();
    const box = makeFakeBox();
    const dateLabel = makeFakeDateLabel(box);
    const label = makeFakeLabel();
    const handle = attach(target, dateLabel, label, date => formatHebrewDate(date, 'he'));

    target.setDate(new Date(2026, 8, 22));
    assertEqual(label.text, 'י״א בתשרי תשפ״ז', 'Hebrew-locale branch wired through the wrapper');

    handle.detach();
}

// (c) teardown restores the exact saved original and destroys the label.
{
    const target = makeFakeTarget();
    const box = makeFakeBox();
    const dateLabel = makeFakeDateLabel(box);
    const label = makeFakeLabel();
    const originalSetDate = target.setDate;

    const handle = attach(target, dateLabel, label, date => formatHebrewDate(date, 'en'));
    handle.detach();

    assertEqual(target.setDate, originalSetDate, 'setDate restored by identity, not a re-wrap');
    assertEqual(box.children.length, 0, 'label removed from the box');
    assertEqual(label.destroyed, true, 'label actor destroyed');
}

// (d) enable -> disable -> enable, twice: exactly one label each time, and
// the original still runs exactly once per setDate call - no
// wrapper-of-a-wrapper accumulating across cycles.
{
    const target = makeFakeTarget();
    const box = makeFakeBox();
    const dateLabel = makeFakeDateLabel(box);
    const originalSetDate = target.setDate;

    for (let cycle = 0; cycle < 2; cycle++) {
        const label = makeFakeLabel();
        const handle = attach(target, dateLabel, label, date => formatHebrewDate(date, 'en'));

        assertEqual(box.children.length, 1, `cycle ${cycle}: exactly one label after enable`);

        target.received.length = 0;
        target.setDate(new Date(2026, 8, 22));
        assertEqual(target.received.length, 1,
            `cycle ${cycle}: original setDate runs exactly once, no wrapper-of-a-wrapper`);

        handle.detach();
        assertEqual(target.setDate, originalSetDate,
            `cycle ${cycle}: setDate restored to the true original`);
        assertEqual(box.children.length, 0, `cycle ${cycle}: label removed after disable`);
    }
}

// Criterion 3 (pre-#11): quiet-return guard on a missing target/box. No
// assertThrows here - if attach() threw, gjs would fail the run by itself,
// which is the failure we want; instead assert the state a guarded return
// leaves behind.
{
    const box = makeFakeBox();
    const dateLabel = makeFakeDateLabel(box);
    const label = makeFakeLabel();
    const handle = attach({}, dateLabel, label, date => formatHebrewDate(date, 'en'));
    assertEqual(handle, null, 'target missing setDate returns quietly, no throw');
    assertEqual(box.children.length, 0, 'nothing added to the box on a guarded return');
}

{
    const target = makeFakeTarget();
    const label = makeFakeLabel();
    const handle = attach(target, null, label, date => formatHebrewDate(date, 'en'));
    assertEqual(handle, null, 'target missing its date-label returns quietly, no throw');
}

{
    const target = makeFakeTarget();
    const label = makeFakeLabel();
    const handle = attach(target, {add_child() {}}, label, date => formatHebrewDate(date, 'en'));
    assertEqual(handle, null, 'a date-label missing get_parent returns quietly, no throw');
}

// --- Issue #11: failure containment beyond a missing name ---------------

// A dateLabel present but wrong-shaped: get_parent() itself throws (the
// exact TypeError shape #11 identified as unguarded on main). Quiet
// return, nothing added.
{
    const target = makeFakeTarget();
    const label = makeFakeLabel();
    const dateLabel = {
        get_parent() {
            throw new TypeError('not actually an actor');
        },
    };
    const handle = attach(target, dateLabel, label, date => formatHebrewDate(date, 'en'));
    assertEqual(handle, null, 'get_parent() throwing returns quietly, no throw');
}

// A box missing add_child/remove_child: quiet return, nothing added.
{
    const target = makeFakeTarget();
    const label = makeFakeLabel();
    const dateLabel = makeFakeDateLabel({});
    const handle = attach(target, dateLabel, label, date => formatHebrewDate(date, 'en'));
    assertEqual(handle, null, 'a resolved box with no add_child/remove_child returns quietly, no throw');
}

// A box whose add_child throws: nothing is left added, setDate is restored
// by identity, and the extension's own disable() (this._handle?.detach())
// is a no-op since attach() returned null - nothing further to unwind.
{
    const target = makeFakeTarget();
    const originalSetDate = target.setDate;
    const label = makeFakeLabel();
    const box = {
        children: [],
        add_child() {
            throw new Error('add_child boom');
        },
        remove_child(child) {
            const index = this.children.indexOf(child);
            if (index !== -1)
                this.children.splice(index, 1);
        },
    };
    const dateLabel = makeFakeDateLabel(box);

    const handle = attach(target, dateLabel, label, date => formatHebrewDate(date, 'en'));

    assertEqual(handle, null, 'add_child throwing during setup returns quietly, no throw');
    assertEqual(target.setDate, originalSetDate, 'setDate is restored by identity after a failed add_child');
    assertEqual(box.children.length, 0, 'nothing is left added after a failed add_child');
}

// formatDate throwing during the *initial* paint: same rollback as a
// failing add_child - setDate restored, label not left in the box.
{
    const target = makeFakeTarget();
    const originalSetDate = target.setDate;
    const box = makeFakeBox();
    const dateLabel = makeFakeDateLabel(box);
    const label = makeFakeLabel();

    const handle = attach(target, dateLabel, label, () => {
        throw new RangeError('bad locale tag');
    });

    assertEqual(handle, null, 'formatDate throwing on the initial paint returns quietly, no throw');
    assertEqual(target.setDate, originalSetDate, 'setDate is restored by identity after a failed initial paint');
    assertEqual(box.children.length, 0, 'label is not left in the box after a failed initial paint');
}

// formatDate throwing on a *later* setDate call (criterion 7 and 4): the
// original setDate still ran and received its argument, the call into the
// wrapper returned normally (no throw reaches gjs), and - because the
// wrapper keeps trying rather than detaching itself - a subsequent call
// where formatDate succeeds again updates the label as normal.
{
    const target = makeFakeTarget();
    const box = makeFakeBox();
    const dateLabel = makeFakeDateLabel(box);
    const label = makeFakeLabel();

    let call = 0;
    const formatDate = date => {
        call += 1;
        // Call 1 is the initial paint inside attach() - must succeed so
        // attach() itself doesn't roll back. Call 2 (the first setDate
        // this test drives) fails; call 3 succeeds again.
        if (call === 2)
            throw new Error('formatting boom');
        return formatHebrewDate(date, 'en');
    };

    const handle = attach(target, dateLabel, label, formatDate);
    const textAfterInitialPaint = label.text;

    const failingDate = new Date(2026, 8, 22);
    target.setDate(failingDate);

    assertEqual(target.received.length, 1, 'original setDate still ran when formatDate threw');
    assertEqual(target.received[0], failingDate, 'original setDate received the same date argument');
    assertEqual(label.text, textAfterInitialPaint,
        'label keeps its previous text when formatDate throws, rather than going blank');

    const recoveredDate = new Date(2026, 8, 23);
    target.setDate(recoveredDate);

    assertEqual(target.received.length, 2, 'original setDate keeps running on later calls');
    assertEqual(label.text, formatHebrewDate(recoveredDate, 'en'),
        'wrapper keeps trying on later calls rather than detaching itself after one failure');

    handle.detach();
}

// detach() where remove_child throws: setDate is still restored by
// identity, and detach() itself does not throw.
{
    const target = makeFakeTarget();
    const originalSetDate = target.setDate;
    const label = makeFakeLabel();
    const box = {
        children: [],
        add_child(child) {
            this.children.push(child);
        },
        remove_child() {
            throw new Error('remove_child boom');
        },
    };
    const dateLabel = makeFakeDateLabel(box);

    const handle = attach(target, dateLabel, label, date => formatHebrewDate(date, 'en'));
    handle.detach();

    assertEqual(target.setDate, originalSetDate,
        'setDate is restored by identity even when remove_child throws');
}

// detach() where destroy() throws: setDate is still restored by identity,
// and detach() itself does not throw.
{
    const target = makeFakeTarget();
    const originalSetDate = target.setDate;
    const box = makeFakeBox();
    const dateLabel = makeFakeDateLabel(box);
    const label = {
        text: '',
        destroy() {
            throw new Error('destroy boom');
        },
    };

    const handle = attach(target, dateLabel, label, date => formatHebrewDate(date, 'en'));
    handle.detach();

    assertEqual(target.setDate, originalSetDate,
        'setDate is restored by identity even when destroy() throws');
    assertEqual(box.children.length, 0, 'label removal still happens when destroy() throws');
}

print(`todayButtonInjector.test.js: ${assertCount()} assertions passed`);
