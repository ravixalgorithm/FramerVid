import http from 'http';

/** Minimal HTTP server so the worker can run as a Render *web* service on the free plan. */
export function startHealthServer(): void {
  const port = Number(process.env.PORT) || 10000;

  const server = http.createServer((req, res) => {
    if (req.url === '/health' || req.url === '/') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, service: 'framevid-worker' }));
      return;
    }
    res.writeHead(404);
    res.end();
  });

  server.listen(port, () => {
    console.log(`[Worker] Health server listening on port ${port}`);
  });
}
