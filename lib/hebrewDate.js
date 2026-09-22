// Pure Gregorian -> Hebrew calendar date formatting. No shell dependency
// of any kind - nothing from the GNOME platform is imported or referenced
// here.
//
// Legacy GJS module: only top-level `function` declarations become part
// of this module's public surface, so those three are the API and
// everything else here stays private to the file.

const GEMATRIA_TENS_AND_HUNDREDS = [
    [400, 'ת'], [300, 'ש'], [200, 'ר'], [100, 'ק'],
    [90, 'צ'], [80, 'פ'], [70, 'ע'], [60, 'ס'], [50, 'נ'], [40, 'מ'], [30, 'ל'], [20, 'כ'],
];

// Index 0-19. 15 and 16 are hardcoded to their traditional irregular forms
// (טו, טז) instead of the arithmetic 10+5 / 10+6 (יה, יו), which spell a
// name of God and are avoided by convention - a fixed table gets this
// right by construction instead of by deriving and special-casing it.
const GEMATRIA_UNITS = [
    '', 'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט',
    'י', 'יא', 'יב', 'יג', 'יד', 'טו', 'טז', 'יז', 'יח', 'יט',
];

// Keyed by the canonical English month name en-u-ca-hebrew returns, since
// that read is stable across locales (see hebrewDateParts below). Values
// are the "in <month>" form (the ב prefix), not bare month names, because
// that's what formatHebrewDate's one call site (below) needs.
const HEBREW_MONTH_IN_FORMS = {
    'Tishri': 'בתשרי',
    'Heshvan': 'בחשוון',
    'Kislev': 'בכסלו',
    'Tevet': 'בטבת',
    'Shevat': 'בשבט',
    'Adar': 'באדר',
    'Adar I': 'באדר א׳',
    'Adar II': 'באדר ב׳',
    'Nisan': 'בניסן',
    'Iyar': 'באייר',
    'Sivan': 'בסיון',
    'Tamuz': 'בתמוז',
    'Av': 'באב',
    'Elul': 'באלול',
};

// Greedy from the largest value down; the 0-19 remainder comes from the
// fixed table above rather than being derived further.
const gematriaLetters = n => {
    let letters = '';
    let remaining = n;
    for (const [value, letter] of GEMATRIA_TENS_AND_HUNDREDS) {
        while (remaining >= value) {
            letters += letter;
            remaining -= value;
        }
    }
    return letters + GEMATRIA_UNITS[remaining];
};

// BCP-47 only: the sole contract for the locale argument, in both
// branches of formatHebrewDate below. A caller holding a POSIX tag
// (e.g. GLib.get_language_names()'s 'he_IL') must convert it first -
// this function does not guess at that shape.
const isHebrewLocale = locale =>
    locale === 'he' || locale.startsWith('he-');

// Formats a non-negative integer as a Hebrew numeral: a geresh (׳) after
// a single letter, gershayim (״) before the last letter of multiple.
function gematria(n) {
    const letters = gematriaLetters(n);
    return letters.length === 1
        ? `${letters}׳`
        : `${letters.slice(0, -1)}״${letters.slice(-1)}`;
}

// The internal, stable read: en-u-ca-hebrew always yields a plain numeric
// day/year and an English month name, regardless of which numbering
// system Intl silently substitutes underneath (this runtime does not
// support the 'hebr' numbering system). Never displayed directly.
function hebrewDateParts(date) {
    const parts = new Intl.DateTimeFormat('en-u-ca-hebrew', {
        day: 'numeric', month: 'long', year: 'numeric',
    }).formatToParts(date);

    const value = type => parts.find(part => part.type === type).value;

    return {
        day: Number(value('day')),
        month: value('month'),
        year: Number(value('year')),
    };
}

// Gregorian date and a locale tag in, formatted Hebrew calendar date
// string out - the date is the only calendrical input, so a future
// sunset-aware rollover hooks in by shifting it before calling here, not
// by reworking this function. Hebrew locales get Hebrew script with
// gematria numerals; anything else gets the date in that locale's own
// language, never forced to English.
function formatHebrewDate(date, locale) {
    if (isHebrewLocale(locale)) {
        const {day, month, year} = hebrewDateParts(date);
        // Thousands are dropped from the year by convention (5787 -> 787).
        return `${gematria(day)} ${HEBREW_MONTH_IN_FORMS[month]} ${gematria(year % 1000)}`;
    }

    return new Intl.DateTimeFormat(`${locale}-u-ca-hebrew`, {
        day: 'numeric', month: 'long', year: 'numeric',
    }).format(date);
}
