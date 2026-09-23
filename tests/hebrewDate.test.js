import {hebrewDateParts, formatHebrewDate} from '../lib/hebrewDate.js';
import {assertEqual, assertThrows, assertCount} from './assert.js';

// Reference dates verified under gjs 1.80.2, including both Adars of a
// leap year.
const referenceDates = [
    [new Date(2026, 8, 22), {day: 11, month: 'Tishri', year: 5787}],
    [new Date(2024, 2, 15), {day: 5, month: 'Adar II', year: 5784}],
    [new Date(2024, 1, 15), {day: 6, month: 'Adar I', year: 5784}],
];

for (const [date, expected] of referenceDates) {
    const parts = hebrewDateParts(date);
    assertEqual(parts.day, expected.day, `${date.toDateString()} day`);
    assertEqual(parts.month, expected.month, `${date.toDateString()} month`);
    assertEqual(parts.year, expected.year, `${date.toDateString()} year`);
}

// Both output modes, end to end, for the same date.
const someDate = new Date(2026, 8, 22);
assertEqual(
    formatHebrewDate(someDate, 'he'), 'י״א בתשרי תשפ״ז',
    'Hebrew-locale mode');
assertEqual(
    formatHebrewDate(someDate, 'en'), '11 Tishri 5787',
    'non-Hebrew-locale mode stays in the interface language');

// Locale contract: BCP-47 only, enforced the same way in both branches.
// A valid non-Hebrew tag formats in that language...
assertEqual(
    formatHebrewDate(someDate, 'fr'), '11 tichri 5787 A. M.',
    'non-Hebrew-locale mode accepts any valid BCP-47 tag');

// ...and a POSIX-form tag throws regardless of which language it names -
// 'he_IL' is no longer special-cased, so a Hebrew POSIX tag fails exactly
// like a non-Hebrew one instead of silently working.
assertThrows(
    () => formatHebrewDate(someDate, 'fr_FR'),
    'POSIX-form locale is rejected on the non-Hebrew branch');
assertThrows(
    () => formatHebrewDate(someDate, 'he_IL'),
    'POSIX-form locale is rejected even when it names Hebrew');

// Criterion 13's locale source, proven end to end - not just "did not
// throw". extension.js hands formatHebrewDate this exact expression, and
// trap two of criterion 13 is a tag ICU silently resolves to something
// else: no throw, but -u-ca-hebrew is dropped and the label prints the
// Gregorian date. resolvedOptions().locale is always registered, so
// formatHebrewDate must accept it, and interpolating -u-ca-hebrew onto it
// must still resolve to the Hebrew calendar.
const systemLocale = Intl.DateTimeFormat().resolvedOptions().locale;
formatHebrewDate(someDate, systemLocale);
assertEqual(
    new Intl.DateTimeFormat(`${systemLocale}-u-ca-hebrew`).resolvedOptions().calendar,
    'hebrew',
    'the locale extension.js resolves still yields a Hebrew-calendar tag');

print(`hebrewDate.test.js: ${assertCount()} assertions passed`);
