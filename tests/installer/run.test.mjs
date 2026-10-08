import assert from 'node:assert/strict';
import test from 'node:test';
import { windowsCommandLine } from '../../installer/run.mjs';

test('Windows command lines are quoted only where needed', () => {
  assert.equal(windowsCommandLine('claude', ['plugin', 'install', 'senior-ai@feres']), 'claude plugin install senior-ai@feres');
  assert.equal(
    windowsCommandLine('claude', ['mcp', 'add', '--scope', 'user', 'angular-cli', '--', 'npx', '-y', '@angular/cli', 'mcp']),
    'claude mcp add --scope user angular-cli -- npx -y @angular/cli mcp',
  );
  assert.equal(
    windowsCommandLine('claude', ['plugin', 'marketplace', 'add', 'C:\\Users\\Fares Hentati\\senior-ai']),
    'claude plugin marketplace add "C:\\Users\\Fares Hentati\\senior-ai"',
  );
  assert.equal(windowsCommandLine('claude', ['--header', 'Authorization: Bearer x']), 'claude --header "Authorization: Bearer x"');
  assert.equal(windowsCommandLine('tool', ['say "hi"']), 'tool "say \\"hi\\""');
});
