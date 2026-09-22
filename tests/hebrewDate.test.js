imports.searchPath.unshift('lib', 'tests');
const HebrewDate = imports.hebrewDate;
const Assert = imports.assert;

// Reference dates verified under gjs 1.80.2, including both Adars of a
// leap year.
const referenceDates = [
    [new Date(2026, 8, 22), {day: 11, month: 'Tishri', year: 5787}],
    [new Date(2024, 2, 15), {day: 5, month: 'Adar II', year: 5784}],
    [new Date(2024, 1, 15), {day: 6, month: 'Adar I', year: 5784}],
];

for (const [date, expected] of referenceDates) {
    const parts = HebrewDate.hebrewDateParts(date);
    Assert.assertEqual(parts.day, expected.day, `${date.toDateString()} day`);
    Assert.assertEqual(parts.month, expected.month, `${date.toDateString()} month`);
    Assert.assertEqual(parts.year, expected.year, `${date.toDateString()} year`);
}

// Both output modes, end to end, for the same date.
const someDate = new Date(2026, 8, 22);
Assert.assertEqual(
    HebrewDate.formatHebrewDate(someDate, 'he'), 'י״א בתשרי תשפ״ז',
    'Hebrew-locale mode');
Assert.assertEqual(
    HebrewDate.formatHebrewDate(someDate, 'en'), '11 Tishri 5787',
    'non-Hebrew-locale mode stays in the interface language');

// Locale contract: BCP-47 only, enforced the same way in both branches.
// A valid non-Hebrew tag formats in that language...
Assert.assertEqual(
    HebrewDate.formatHebrewDate(someDate, 'fr'), '11 tichri 5787 A. M.',
    'non-Hebrew-locale mode accepts any valid BCP-47 tag');

// ...and a POSIX-form tag throws regardless of which language it names -
// 'he_IL' is no longer special-cased, so a Hebrew POSIX tag fails exactly
// like a non-Hebrew one instead of silently working.
Assert.assertThrows(
    () => HebrewDate.formatHebrewDate(someDate, 'fr_FR'),
    'POSIX-form locale is rejected on the non-Hebrew branch');
Assert.assertThrows(
    () => HebrewDate.formatHebrewDate(someDate, 'he_IL'),
    'POSIX-form locale is rejected even when it names Hebrew');

print(`hebrewDate.test.js: ${Assert.assertCount()} assertions passed`);
