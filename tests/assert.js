// Minimal assertion helper shared by the test scripts. Throwing on
// mismatch is what makes a failing assertion actually fail the process:
// gjs exits non-zero on an uncaught exception, 0 otherwise.

let count = 0;

function assertEqual(actual, expected, message) {
    count += 1;
    if (actual !== expected) {
        throw new Error(
            `${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    }
}

function assertCount() {
    return count;
}
