// Terminal output and questions. Without a terminal (CI, pipes) or with --yes, every question
// takes its default answer, so the installer never hangs waiting for input.

import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline/promises';

const HOME = os.homedir();

export const say = (message = '') => console.log(message);
export const pretty = p => (p === HOME || p.startsWith(HOME + path.sep) ? '~' + p.slice(HOME.length) : p);

export function createPrompter({ assumeYes }) {
  const interactive = Boolean(process.stdin.isTTY) && !assumeYes;
  let rl;
  const question = async text => {
    rl ??= readline.createInterface({ input: process.stdin, output: process.stdout });
    return (await rl.question(text)).trim();
  };

  return {
    interactive,

    // Yes/no question; returns the default when not interactive.
    async confirm(text, defaultYes = true) {
      if (!interactive) return defaultYes;
      const answer = (await question(`${text} ${defaultYes ? '[Y/n]' : '[y/N]'} `)).toLowerCase();
      return answer === '' ? defaultYes : answer.startsWith('y');
    },

    // Numbered choice; returns the value of the chosen option (the first option by default).
    async choose(text, options) {
      if (!interactive) return options[0].value;
      say(text);
      options.forEach((option, i) => say(`  ${i + 1}) ${option.label}${i === 0 ? ' (default)' : ''}`));
      for (;;) {
        const answer = await question('Choice [1]: ');
        if (answer === '') return options[0].value;
        const index = Number.parseInt(answer, 10) - 1;
        if (options[index]) return options[index].value;
        say(`Please type a number from 1 to ${options.length}.`);
      }
    },

    close() {
      rl?.close();
    },
  };
}
