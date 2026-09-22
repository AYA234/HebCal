import {gematria} from '../lib/hebrewDate.js';
import {assertEqual, assertCount} from './assert.js';

assertEqual(gematria(11), 'י״א', 'gematria(11)');
assertEqual(gematria(5787 % 1000), 'תשפ״ז', 'gematria(787)');
assertEqual(gematria(5), 'ה׳', 'gematria(5), single letter takes geresh');

// Deliberately irregular: 15 and 16 are not the arithmetic 10+5 / 10+6.
assertEqual(gematria(15), 'ט״ו', 'gematria(15) must not be י״ה');
assertEqual(gematria(16), 'ט״ז', 'gematria(16) must not be י״ו');

print(`gematria.test.js: ${assertCount()} assertions passed`);
