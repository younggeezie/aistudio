import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import chokidar from 'chokidar';

const PORT = 3000;

async function startServer() {
  const app = express();
  const server = createServer(app);
  const wss = new WebSocketServer({ server });

  app.use(express.json());

  // API: List files in a directory
  app.get('/api/files', (req, res) => {
    const dirPath = (req.query.path as string) || './logs';
    const absolutePath = path.resolve(process.cwd(), dirPath);

    if (!fs.existsSync(absolutePath)) {
      return res.status(404).json({ error: 'Directory not found' });
    }

    try {
      const files = fs.readdirSync(absolutePath)
        .filter(f => !fs.statSync(path.join(absolutePath, f)).isDirectory())
        .map(f => ({
          name: f,
          path: path.join(dirPath, f),
          size: fs.statSync(path.join(absolutePath, f)).size,
          mtime: fs.statSync(path.join(absolutePath, f)).mtime
        }));
      res.json(files);
    } catch (err) {
      res.status(500).json({ error: 'Failed to read directory' });
    }
  });

  // API: Get file content
  app.get('/api/file-content', (req, res) => {
    const filePath = req.query.path as string;
    if (!filePath) return res.status(400).json({ error: 'Path required' });

    const absolutePath = path.resolve(process.cwd(), filePath);
    if (!fs.existsSync(absolutePath)) return res.status(404).json({ error: 'File not found' });

    try {
      const content = fs.readFileSync(absolutePath, 'utf-8');
      res.json({ content });
    } catch (err) {
      res.status(500).json({ error: 'Failed to read file' });
    }
  });

  // WebSocket: Handle real-time monitoring
  const watchers = new Map<string, any>();
  const clientSubscriptions = new Map<WebSocket, string>();

  wss.on('connection', (ws) => {
    console.log('Client connected');

    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString());
        
        if (data.type === 'subscribe') {
          const filePath = data.path;
          const absolutePath = path.resolve(process.cwd(), filePath);

          if (!fs.existsSync(absolutePath)) {
            ws.send(JSON.stringify({ type: 'error', message: 'File not found' }));
            return;
          }

          // Unsubscribe from previous
          const prevPath = clientSubscriptions.get(ws);
          if (prevPath) {
            // Check if anyone else is watching this path
            const stillNeeded = Array.from(clientSubscriptions.entries())
              .some(([client, path]) => client !== ws && path === prevPath);
            if (!stillNeeded) {
              watchers.get(prevPath)?.close();
              watchers.delete(prevPath);
            }
          }

          clientSubscriptions.set(ws, filePath);

          // Start watching if not already
          if (!watchers.has(filePath)) {
            const watcher = chokidar.watch(absolutePath, { persistent: true });
            watcher.on('change', () => {
              const content = fs.readFileSync(absolutePath, 'utf-8');
              // Broadcast to all subscribers of this file
              wss.clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN && clientSubscriptions.get(client) === filePath) {
                  client.send(JSON.stringify({ 
                    type: 'update', 
                    path: filePath, 
                    content 
                  }));
                }
              });
            });
            watchers.set(filePath, watcher);
          }

          ws.send(JSON.stringify({ type: 'subscribed', path: filePath }));
        }
      } catch (err) {
        console.error('WS Error:', err);
      }
    });

    ws.on('close', () => {
      const path = clientSubscriptions.get(ws);
      if (path) {
        clientSubscriptions.delete(ws);
        const stillNeeded = Array.from(clientSubscriptions.values()).includes(path);
        if (!stillNeeded) {
          watchers.get(path)?.close();
          watchers.delete(path);
        }
      }
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
