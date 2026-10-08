import assert from 'node:assert/strict';
import test from 'node:test';
import { checkCommand, checkToolCall, checkWrite } from '../../hooks/policy.mjs';

const decision = command => checkCommand(command).decision;

// Fake but well-formed credentials, assembled at runtime so this file holds no secret-shaped literal.
const FAKE = {
  github: 'ghp_' + 'a1B2c3D4e5'.repeat(4),
  aws: 'AKIA' + 'ABCDEFGHIJ234567',
  stripe: 'sk_live_' + 'x9Y8z7W6v5'.repeat(3),
  key: '-----BEGIN ' + 'RSA PRIVATE KEY-----',
  dbUrl: 'postgres://app:' + 'hunter2pass' + '@db.example.com:5432/app',
};

test('refuses destructive commands', () => {
  for (const command of [
    'rm -rf /',
    'rm -rf ~',
    'sudo rm -fr /*',
    'rm -r -f .',
    'cd build && rm -rf *',
    'rm --recursive $HOME',
    'git push --force origin main',
    'git push -f origin master',
    'psql -c "DROP DATABASE app"',
    'dd if=/dev/zero of=/dev/sda',
    'mkfs.ext4 /dev/sdb1',
  ]) {
    assert.equal(decision(command), 'deny', command);
  }
});

test('allows ordinary work, including safe deletions', () => {
  for (const command of [
    'rm -rf dist',
    'rm -rf node_modules/.cache',
    'rm file.txt',
    'npm test',
    'npm run build',
    'npx ng test --watch=false',
    'git status',
    'git diff --stat',
    'git push --force origin feature/login',
    'ls -la',
    'dd if=in.img of=/dev/null',
    'vercel logs my-app',
    'npm ci',
    'pip install -r requirements.txt',
  ]) {
    assert.equal(decision(command), command === 'git push --force origin feature/login' ? 'ask' : 'allow', command);
  }
});

test('asks before actions that leave the machine or are hard to undo', () => {
  for (const command of [
    'git commit -m "feat: login"',
    'git push origin main',
    'gh pr create --fill',
    'gh pr merge 12',
    'npm publish',
    'vercel --prod',
    'vercel deploy',
    'docker push app:latest',
    'npm install lodash',
    'pnpm add zod',
    'git reset --hard HEAD~1',
    'terraform apply',
    'npx prisma migrate deploy',
  ]) {
    assert.equal(decision(command), 'ask', command);
  }
});

test('refuses secrets in files, except in local secret files', () => {
  for (const secret of Object.values(FAKE)) {
    assert.equal(checkWrite('src/config.ts', `const value = "${secret}";`).decision, 'deny', secret);
  }
  assert.equal(checkWrite('.env', `GITHUB_TOKEN=${FAKE.github}`).decision, 'allow');
  assert.equal(checkWrite('apps/api/.env.local', `DATABASE_URL=${FAKE.dbUrl}`).decision, 'allow');
  assert.equal(checkWrite('.env.example', `GITHUB_TOKEN=${FAKE.github}`).decision, 'deny');
});

test('no false alarm on ordinary code and placeholders', () => {
  for (const text of [
    'const apiKey = process.env.STRIPE_SECRET_KEY;',
    'GITHUB_TOKEN=<your token here>',
    'DATABASE_URL=postgres://localhost:5432/app',
    'const token = "abc";',
    'export const sk = "sk_test_12345";',
  ]) {
    assert.equal(checkWrite('src/x.ts', text).decision, 'allow', text);
  }
});

test('refuses secrets passed on the command line', () => {
  assert.equal(decision(`curl -H "Authorization: Bearer ${FAKE.github}" https://api.github.com/user`), 'deny');
});

test('one decision for both tools', () => {
  assert.equal(checkToolCall('Bash', { command: 'rm -rf /' }).decision, 'deny');
  assert.equal(checkToolCall('bash', { command: 'git push' }).decision, 'ask');
  assert.equal(checkToolCall('Write', { file_path: 'a.ts', content: FAKE.aws }).decision, 'deny');
  assert.equal(checkToolCall('write_file', { file_path: 'a.ts', content: FAKE.aws }).decision, 'deny');
  assert.equal(checkToolCall('Edit', { file_path: 'a.ts', old_string: 'x', new_string: FAKE.key }).decision, 'deny');
  assert.equal(checkToolCall('MultiEdit', { file_path: 'a.ts', edits: [{ new_string: FAKE.stripe }] }).decision, 'deny');
  assert.equal(checkToolCall('Read', { file_path: '.env' }).decision, 'allow');
});
