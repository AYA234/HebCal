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
    const label = makeFakeLabel();
    let lastFormatted;
    const formatDate = date => {
        lastFormatted = date;
        return formatHebrewDate(date, 'en');
    };

    const handle = attach(target, box, label, formatDate);

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
    const label = makeFakeLabel();
    const handle = attach(target, box, label, date => formatHebrewDate(date, 'he'));

    target.setDate(new Date(2026, 8, 22));
    assertEqual(label.text, 'י״א בתשרי תשפ״ז', 'Hebrew-locale branch wired through the wrapper');

    handle.detach();
}

// (c) teardown restores the exact saved original and destroys the label.
{
    const target = makeFakeTarget();
    const box = makeFakeBox();
    const label = makeFakeLabel();
    const originalSetDate = target.setDate;

    const handle = attach(target, box, label, date => formatHebrewDate(date, 'en'));
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
    const originalSetDate = target.setDate;

    for (let cycle = 0; cycle < 2; cycle++) {
        const label = makeFakeLabel();
        const handle = attach(target, box, label, date => formatHebrewDate(date, 'en'));

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

// Criterion 3: quiet-return guard. No assertThrows here - if attach()
// threw, gjs would fail the run by itself, which is the failure we want;
// instead assert the state a guarded return leaves behind.
{
    const box = makeFakeBox();
    const label = makeFakeLabel();
    const handle = attach({}, box, label, date => formatHebrewDate(date, 'en'));
    assertEqual(handle, null, 'target missing setDate returns quietly, no throw');
    assertEqual(box.children.length, 0, 'nothing added to the box on a guarded return');
}

{
    const target = makeFakeTarget();
    const label = makeFakeLabel();
    const handle = attach(target, null, label, date => formatHebrewDate(date, 'en'));
    assertEqual(handle, null, 'target missing its box returns quietly, no throw');
}

{
    const target = makeFakeTarget();
    const label = makeFakeLabel();
    const handle = attach(target, {add_child() {}}, label, date => formatHebrewDate(date, 'en'));
    assertEqual(handle, null, 'a box missing remove_child returns quietly, no throw');
}

print(`todayButtonInjector.test.js: ${assertCount()} assertions passed`);
