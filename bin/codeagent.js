#!/usr/bin/env node

// Thin launcher so `codeagent` works cross-platform.
// Loads TypeScript entrypoint via ts-node.

try {
  require('ts-node/register');
} catch (e) {
  // Fallback for environments where ts-node isn't resolvable from here.
  require('ts-node/register/transpile-only');
}

require('../src/index.ts');
