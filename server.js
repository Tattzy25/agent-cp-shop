const express = require('express');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const SHOPIFY_MCP_URL = 'https://nba0ey-th.myshopify.com/api/mcp';

app.use(express.json());

const sessions = new Map();

app.get('/agent-profile.json', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'agent.json'));
});

app.post('/mcp', async (req, res) => {
  const body = req.body;
  const sessionId = req.headers['mcp-session-id'];

  if (!body || body.jsonrpc !== '2.0') {
    return res.status(400).json({
      jsonrpc: '2.0',
      id: body?.id ?? null,
      error: { code: -32600, message: 'Invalid Request' }
    });
  }

  if (body.method === 'initialize') {
    const sid = crypto.randomUUID();
    sessions.set(sid, { created: Date.now() });
    try {
      const upstream = await fetch(SHOPIFY_MCP_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await upstream.json();
      res.setHeader('mcp-session-id', sid);
      return res.json(data);
    } catch (err) {
      sessions.delete(sid);
      return res.json({
        jsonrpc: '2.0',
        id: body.id,
        error: { code: -32603, message: err.message }
      });
    }
  }

  if (!sessionId || !sessions.has(sessionId)) {
    return res.status(404).json({
      jsonrpc: '2.0',
      id: body?.id ?? null,
      error: { code: -32001, message: 'Session not found' }
    });
  }

  // Notifications (no id) — fire and forget, return 202
  if (body.id === undefined) {
    fetch(SHOPIFY_MCP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }).catch(() => {});
    return res.status(202).end();
  }

  try {
    const upstream = await fetch(SHOPIFY_MCP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await upstream.json();
    return res.json(data);
  } catch (err) {
    return res.json({
      jsonrpc: '2.0',
      id: body.id,
      error: { code: -32603, message: err.message }
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
