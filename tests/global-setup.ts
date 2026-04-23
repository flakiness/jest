import fs from 'node:fs';

const ARTIFACTS_DIR = process.platform === 'darwin'
  ? '/private/tmp/flakiness-jest'
  : '/tmp/flakiness-jest';

export default function setup() {
  fs.rmSync(ARTIFACTS_DIR, { recursive: true, force: true });
}
