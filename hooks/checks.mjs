// What counts as a code change and as verification, shared by the done gate of every tool.

export const CODE_FILE = /\.(?:[cm]?[jt]sx?|vue|svelte|html|s?css|less|py|go|rs|java|kt|cs|php|rb|swift|sql)$/i;

// A check command at the start of one part of a shell command (so `git commit -m test` is not one).
const CHECK_COMMAND = new RegExp(
  '^(?:\\w+=\\S+\\s+)*(?:npx\\s+|bunx\\s+|pnpm\\s+(?:exec|dlx)\\s+|yarn\\s+dlx\\s+)?(?:' +
    [
      '(?:npm|pnpm|yarn|bun)\\s+(?:run\\s+)?(?:test|lint|build|typecheck|type-check|check|e2e|verify)\\b',
      '(?:tsc|vitest|jest|karma|eslint|playwright|cypress|pytest|mvn|gradle|\\.\\/gradlew)\\b',
      'make\\s+(?:test|check|lint|build)\\b',
      'ng\\s+(?:test|build|lint|e2e)\\b',
      'nx\\s+(?:test|build|lint|affected|run)\\b',
      'node\\s+--test\\b',
      'go\\s+(?:test|build|vet)\\b',
      'cargo\\s+(?:test|build|check|clippy)\\b',
      'dotnet\\s+(?:test|build)\\b',
    ].join('|') +
    ')',
);

export const isCheck = command => command.split(/&&|\|\||;|\|/).some(part => CHECK_COMMAND.test(part.trim()));

// Delegating to a reviewer or to QA counts as verification.
export const isVerifyingAgent = name => /(?:auditor|reviewer|qa-engineer|security|test)/.test(name ?? '');
