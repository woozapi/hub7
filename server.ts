import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'http';
import { Server } from 'socket.io';
import makeWASocket, { 
  useMultiFileAuthState, 
  DisconnectReason, 
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  ConnectionState
} from '@whiskeysockets/baileys';
import QRCode from 'qrcode';
import pino from 'pino';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const logger = pino({ level: 'info' });
const PORT = 3000;

// WhatsApp State
const instances = new Map<string, {
  sock: any;
  qrCode: string | null;
  status: 'connecting' | 'open' | 'close' | 'waiting';
  isStarting: boolean;
}>();

let io: Server;

async function startWhatsApp(instanceId: string) {
  const instance = instances.get(instanceId) || {
    sock: null,
    qrCode: null,
    status: 'waiting',
    isStarting: false
  };
  
  if (instance.isStarting) return;
  instance.isStarting = true;
  instances.set(instanceId, instance);
  
  try {
    const authFolder = `auth_info_baileys_${instanceId}`;
    const { state, saveCreds } = await useMultiFileAuthState(authFolder);
    const { version, isLatest } = await fetchLatestBaileysVersion();
    
    console.log(`[Instance ${instanceId}] using WA v${version.join('.')}, isLatest: ${isLatest}`);

    const sock = makeWASocket({
      version,
      logger,
      printQRInTerminal: false,
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, logger),
      },
      browser: ['FLUOW AI', 'Chrome', '1.0.0'],
      syncFullHistory: false,
      qrTimeout: 60000,
      connectTimeoutMs: 60000,
      defaultQueryTimeoutMs: 60000,
      keepAliveIntervalMs: 10000,
    });

    instance.sock = sock;

    sock.ev.on('connection.update', async (update: Partial<ConnectionState>) => {
      const { connection, lastDisconnect, qr } = update;
      
      if (qr) {
        instance.qrCode = await QRCode.toDataURL(qr);
        instance.status = 'waiting';
        io.emit('whatsapp:status', { instanceId, status: instance.status, qr: instance.qrCode });
      }

      if (connection === 'close') {
        const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
        const isLoggedOut = statusCode === DisconnectReason.loggedOut;
        const errorMessage = lastDisconnect?.error?.message || '';
        const isQRExpired = errorMessage.includes('QR refs attempts ended') || statusCode === 401;
        
        console.log(`[Instance ${instanceId}] connection closed due to `, lastDisconnect?.error, ', reconnecting ', !isLoggedOut || isQRExpired);
        
        instance.qrCode = null;
        instance.status = 'close';
        io.emit('whatsapp:status', { instanceId, status: instance.status, qr: null });
        
        if (!isLoggedOut || isQRExpired) {
          // Clean up listeners from old socket
          if (sock) {
            sock.ev.removeAllListeners('connection.update');
            sock.ev.removeAllListeners('creds.update');
            sock.ev.removeAllListeners('messages.upsert');
          }
          
          setTimeout(() => {
            console.log(`[Instance ${instanceId}] Attempting to reconnect WhatsApp...`);
            startWhatsApp(instanceId);
          }, 5000);
        }
      } else if (connection === 'open') {
        console.log(`[Instance ${instanceId}] opened connection`);
        instance.qrCode = null;
        instance.status = 'open';
        io.emit('whatsapp:status', { instanceId, status: instance.status, qr: null, me: sock?.user });
      }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async (m: any) => {
      console.log(`[Instance ${instanceId}] received messages`, JSON.stringify(m, undefined, 2));
      io.emit('whatsapp:message', { instanceId, message: m });
    });
  } catch (err) {
    console.error(`[Instance ${instanceId}] Error starting WhatsApp:`, err);
  } finally {
    instance.isStarting = false;
    instances.set(instanceId, instance);
  }
}

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
      credentials: true
    },
    transports: ['polling', 'websocket'],
    allowEIO3: true, // For compatibility
    pingTimeout: 60000,
    pingInterval: 25000
  });

  io.on('connection', (socket) => {
    console.log('Client connected to WebSocket with ID:', socket.id);
    // Send current status of all instances on connection
    instances.forEach((instance, instanceId) => {
      socket.emit('whatsapp:status', { 
        instanceId,
        status: instance.status,
        qr: instance.qrCode,
        me: instance.sock?.user
      });
    });

    socket.on('disconnect', (reason) => {
      console.log('Client disconnected from WebSocket:', socket.id, 'Reason:', reason);
    });
  });

  // API Routes
  app.get('/api/whatsapp/instances', (req, res) => {
    const data: any[] = [];
    instances.forEach((instance, instanceId) => {
      data.push({
        id: instanceId,
        status: instance.status,
        qr: instance.qrCode,
        me: instance.sock?.user
      });
    });
    res.json(data);
  });

  app.post('/api/whatsapp/instances/:id/start', async (req, res) => {
    const { id } = req.params;
    startWhatsApp(id);
    res.json({ success: true });
  });

  app.post('/api/whatsapp/instances/:id/logout', async (req, res) => {
    try {
      const { id } = req.params;
      const instance = instances.get(id);
      if (instance && instance.sock) {
        await instance.sock.logout();
        const authFolder = `auth_info_baileys_${id}`;
        if (fs.existsSync(authFolder)) {
          fs.rmSync(authFolder, { recursive: true, force: true });
        }
        instance.qrCode = null;
        instance.status = 'close';
        io.emit('whatsapp:status', { instanceId: id, status: instance.status, qr: null });
        setTimeout(() => startWhatsApp(id), 2000);
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to logout' });
    }
  });

  app.delete('/api/whatsapp/instances/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const instance = instances.get(id);
      if (instance && instance.sock) {
        instance.sock.ev.removeAllListeners('connection.update');
        instance.sock.ev.removeAllListeners('creds.update');
        instance.sock.ev.removeAllListeners('messages.upsert');
        instance.sock.end();
      }
      
      const authFolder = `auth_info_baileys_${id}`;
      if (fs.existsSync(authFolder)) {
        fs.rmSync(authFolder, { recursive: true, force: true });
      }
      
      instances.delete(id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete instance' });
    }
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
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
    // We don't start any instance automatically here, 
    // the frontend will trigger start for each registered instance
  });
}

startServer();
