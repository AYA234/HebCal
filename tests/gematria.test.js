imports.searchPath.unshift('lib', 'tests');
const HebrewDate = imports.hebrewDate;
const Assert = imports.assert;

Assert.assertEqual(HebrewDate.gematria(11), 'י״א', 'gematria(11)');
Assert.assertEqual(HebrewDate.gematria(5787 % 1000), 'תשפ״ז', 'gematria(787)');
Assert.assertEqual(HebrewDate.gematria(5), 'ה׳', 'gematria(5), single letter takes geresh');

// Deliberately irregular: 15 and 16 are not the arithmetic 10+5 / 10+6.
Assert.assertEqual(HebrewDate.gematria(15), 'ט״ו', 'gematria(15) must not be י״ה');
Assert.assertEqual(HebrewDate.gematria(16), 'ט״ז', 'gematria(16) must not be י״ו');

print(`gematria.test.js: ${Assert.assertCount()} assertions passed`);
