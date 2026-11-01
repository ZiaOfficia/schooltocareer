/**
 * Hidden terminal input, shared by the scripts that ask an operator for a
 * password. Moved here from set-admin-password.ts so a second script did not
 * grow a second copy of the raw-mode handling.
 */
/**
 * Control codes as ESCAPES, never as literal characters.
 *
 * A literal ETX or DEL byte in a source file is invisible in review, survives
 * copy-paste badly, and is rendered as an empty string by some editors — which
 * silently collapses three distinct switch cases into one duplicate.
 */
const EOT = '\u0004'; // Ctrl-D
const ETX = '\u0003'; // Ctrl-C
const DEL = '\u007F'; // what most terminals send for Backspace

/**
 * Reads a line from the TTY without echoing it.
 *
 * `readline` has no hidden-input mode, so the terminal is switched to raw mode
 * and characters are consumed directly. A non-TTY stdin is REFUSED rather than
 * quietly falling back to a visible prompt: a piped password defeats the entire
 * point of this file.
 */
export function readSecret(prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!process.stdin.isTTY) {
      reject(
        new Error(
          'stdin is not a terminal. Run this interactively — piping a password ' +
            'puts it in shell history or a CI log, which is what this script exists to avoid.',
        ),
      );
      return;
    }

    process.stdout.write(prompt);
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');

    let value = '';

    const cleanup = (): void => {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdin.off('data', onData);
    };

    function onData(chunk: string): void {
      for (const char of chunk) {
        if (char === '\n' || char === '\r' || char === EOT) {
          cleanup();
          process.stdout.write('\n');
          resolve(value);
          return;
        }
        if (char === ETX) {
          cleanup();
          process.stdout.write('\n');
          reject(new Error('cancelled'));
          return;
        }
        if (char === DEL || char === '\b') {
          value = value.slice(0, -1);
          continue;
        }
        // Printable characters only. Arrow keys arrive as escape sequences;
        // embedding those would store something nobody could retype.
        if (char >= ' ') value += char;
      }
    }

    process.stdin.on('data', onData);
  });
}
