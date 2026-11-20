/* eslint-disable @typescript-eslint/no-require-imports */
const { existsSync } = require('node:fs')
const { join } = require('node:path')

module.exports = function checkEnhanceWorker() {
  const exe = join(__dirname, '..', 'native', 'enhance-worker', 'dist', 'enhance-worker.exe')
  if (!existsSync(exe)) {
    throw new Error(
      `enhance-worker.exe is missing at ${exe}. ` +
        'Run "pnpm --filter @screentools/desktop build:enhance-worker" before packaging.',
    )
  }
}
