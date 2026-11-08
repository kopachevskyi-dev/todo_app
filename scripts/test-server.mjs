import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createInterface } from 'node:readline';

/** Start the actual production entry point; every call owns its DB and OS port. */
export async function startTestServer({
  entry = 'dist/server.js',
  testClock = false,
} = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'todo-server-'));
  const databasePath = join(directory, 'todo.db');
  const child = spawn(process.execPath, [entry], {
    env: {
      ...process.env,
      PORT: '0',
      HOST: '127.0.0.1',
      DATABASE_PATH: databasePath,
      ENABLE_TEST_CLOCK: String(testClock),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const exited = once(child, 'exit');
  let output = '';
  child.stderr.on('data', (chunk) => {
    output += chunk.toString();
  });
  const lines = createInterface({ input: child.stdout });
  async function stop() {
    try {
      if (child.exitCode === null && child.signalCode === null) {
        child.kill('SIGTERM');
        const timeout = setTimeout(() => child.kill('SIGKILL'), 5000);
        try {
          await exited;
        } finally {
          clearTimeout(timeout);
        }
      }
    } finally {
      lines.close();
      await rm(directory, { recursive: true, force: true });
    }
  }
  try {
    const url = await new Promise((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error(`Server startup timed out. ${output}`)),
        15000,
      );
      const finish = (error, value) => {
        clearTimeout(timeout);
        if (error) reject(error);
        else resolve(value);
      };
      child.once('error', (error) => finish(error));
      child.once('exit', (code, signal) =>
        finish(
          new Error(
            `Server exited before readiness (${code ?? signal}). ${output}`,
          ),
        ),
      );
      lines.on('line', (line) => {
        output += `${line}\n`;
        try {
          const message = JSON.parse(line);
          if (message.event === 'listening')
            finish(null, `http://127.0.0.1:${message.port}`);
        } catch {
          /* Non-JSON logs are retained for startup diagnostics. */
        }
      });
    });
    return { url, stop, databasePath };
  } catch (error) {
    await stop();
    throw error;
  }
}
