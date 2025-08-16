#!/usr/bin/env node
// Simple local proxy to fetch GoatCounter JSON and add CORS headers.
// Usage: node tools/goat-proxy.js
// Then open: http://127.0.0.1:8787/proxy?url=<encoded-goat-url>

const express = require('express');
(async function(){
  const app = express();
  const PORT = process.env.PORT || 8787;

  // allow everything (local dev proxy)
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if(req.method === 'OPTIONS') return res.sendStatus(200);
    next();
  });

  app.get('/proxy', async (req, res) => {
    const url = req.query.url;
    if(!url) return res.status(400).send('missing url query param');
    try{
      // prefer global fetch (node 18+), otherwise fallback to node-fetch
      const fetchFn = globalThis.fetch || (await import('node-fetch')).default;
      const r = await fetchFn(url, { method: 'GET' });
      const body = await r.text();
      const contentType = r.headers.get('content-type') || 'application/json; charset=utf-8';
      res.setHeader('Content-Type', contentType);
      res.status(r.status).send(body);
    }catch(err){
      res.status(502).send(String(err));
    }
  });

  app.listen(PORT, () => console.log(`Goat proxy running: http://127.0.0.1:${PORT}/proxy?url=...`));
})();
