const WebSocket = require('/Users/jennifermaxwell/Desktop/Ciatta1/ciatta-project/ciatta-mobile-app/node_modules/ws');

const expr = process.argv[2] || '1+1';
const timeoutMs = Number(process.argv[3] || 8000);

async function main() {
  const pages = await fetch('http://127.0.0.1:8081/json').then((r) => r.json());
  const page = pages.find((p) => p.webSocketDebuggerUrl) || pages[0];
  if (!page?.webSocketDebuggerUrl) {
    throw new Error('No Metro inspector websocket');
  }
  const ws = new WebSocket(page.webSocketDebuggerUrl, {
    headers: {
      Origin: 'http://127.0.0.1:8081',
      Host: '127.0.0.1:8081',
    },
  });
  const result = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('CDP timeout')), timeoutMs);
    let id = 1;
    ws.on('open', () => {
      ws.send(JSON.stringify({ id: id++, method: 'Runtime.enable' }));
      ws.send(
        JSON.stringify({
          id: id++,
          method: 'Runtime.evaluate',
          params: { expression: expr, returnByValue: true, awaitPromise: true },
        })
      );
    });
    ws.on('message', (raw) => {
      const msg = JSON.parse(String(raw));
      if (msg.id === 2) {
        clearTimeout(timer);
        ws.close();
        resolve(msg);
      }
    });
    ws.on('error', reject);
  });
  console.log(JSON.stringify(result, null, 2));
}

main().catch((e) => {
  console.error(e.stack || e);
  process.exit(1);
});
