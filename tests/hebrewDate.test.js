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

print(`hebrewDate.test.js: ${Assert.assertCount()} assertions passed`);
