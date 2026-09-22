// What the two acceptance scripts share: the local stack's keys, a function
// server they start and stop themselves, one post to the intelligence
// function, and the small check helpers. Local only, like the seed.
import { spawn } from 'node:child_process';

export type Env = Record<string, string>;

// supabase status prints KEY=VALUE lines with -o env; only what is needed
// is kept, and nothing is echoed.
export async function localEnv(): Promise<Env> {
  return new Promise((resolve, reject) => {
    const child = spawn('supabase', ['status', '-o', 'env'], { stdio: ['ignore', 'pipe', 'ignore'] });
    let out = '';
    child.stdout.on('data', (d) => (out += d));
    child.on('error', reject);
    child.on('close', () => {
      const env: Env = {};
      for (const line of out.split('\n')) {
        const m = /^([A-Z_]+)="?([^"]*)"?$/.exec(line.trim());
        if (m) env[m[1]] = m[2];
      }
      resolve(env);
    });
  });
}

export function serveFunctions(): Promise<{ stop: () => void }> {
  return new Promise((resolve, reject) => {
    const child = spawn('supabase', ['functions', 'serve'], { stdio: ['ignore', 'pipe', 'pipe'] });
    let ready = false;
    const timer = setTimeout(() => {
      if (!ready) {
        child.kill();
        reject(new Error('supabase functions serve did not come up in 90s'));
      }
    }, 90000);
    const watch = (chunk: Buffer) => {
      if (!ready && /functions\/v1\/intelligence/.test(String(chunk))) {
        ready = true;
        clearTimeout(timer);
        // The runtime announces before it accepts; a moment more.
        setTimeout(() => resolve({ stop: () => child.kill() }), 1500);
      }
    };
    child.stdout.on('data', watch);
    child.stderr.on('data', watch);
    child.on('error', (e) => {
      clearTimeout(timer);
      reject(e);
    });
  });
}

export type RunResult = { processed: boolean; threads?: number; insights?: number; outcomes?: number; learning?: number; recommendations?: number; expired?: number };

export async function post(url: string, serviceKey: string): Promise<RunResult> {
  const res = await fetch(`${url}/functions/v1/intelligence`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
    body: '{}',
  });
  const body = (await res.json()) as RunResult & { error?: string };
  if (!res.ok) throw new Error(`intelligence answered ${res.status}: ${body.error ?? ''}`);
  return body;
}

export function check(condition: unknown, what: string): void {
  if (!condition) throw new Error(`FAIL: ${what}`);
  console.log(`ok: ${what}`);
}

export function must<D>(result: { data: D; error: { message: string } | null }, what: string): D {
  if (result.error) throw new Error(`${what}: ${result.error.message}`);
  return result.data;
}

// A list read that answered with nothing at all is a failure here, not an
// empty list: every read is of rows the run was expected to write.
export function rows<T>(result: { data: T[] | null; error: { message: string } | null }, what: string): T[] {
  const data = must(result, what);
  if (!data) throw new Error(`${what}: no rows`);
  return data;
}
