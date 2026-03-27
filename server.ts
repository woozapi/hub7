import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' }); // Load local env
dotenv.config(); // Fallback to standard .env

import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { supabaseAuth } from './src/services/supabaseServer';
import { waManager } from './src/services/whatsappManager';
import QRCode from 'qrcode';
import pino from 'pino';
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import rateLimit from 'express-rate-limit';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '*').split(',').map(o => o.trim());
const isProduction = process.env.NODE_ENV === 'production';

const corsOptions = {
  origin: isProduction ? ALLOWED_ORIGINS : true,
  methods: ["GET", "POST"],
  credentials: true
};

const requireAuth = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    res.status(401).json({ error: 'Missing authorization header' });
    return;
  }
  
  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error } = await supabaseAuth.auth.getUser(token);
  
  if (error || !user) {
    res.status(401).json({ error: 'Invalid token' });
    return;
  }
  
  (req as any).user = user;
  (req as any).token = token;
  next();
};

const getScopedClient = (token: string) => {
  return createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: `Bearer ${token}` } }
  });
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const logger = pino({ level: 'info' });
const PORT = 3000;

// No longer needed: local WhatsApp state handled by waManager

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Debug middleware for API routes
  app.use('/api', (req, res, next) => {
    logger.info(`[API Request] ${req.method} ${req.url}`);
    next();
  });

  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: isProduction ? 100 : 1000,
    message: { error: 'Too many requests, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
  });

  app.use('/api', apiLimiter);

  let io = new Server(httpServer, {
    cors: corsOptions,
    transports: ['polling', 'websocket'],
    allowEIO3: true,
    pingTimeout: 60000,
    pingInterval: 25000
  });

  waManager.setIo(io);

  io.on('connection', (socket) => {
    console.log('Client connected to WebSocket with ID:', socket.id);
    
    // Simple org joining for rooms based on user auth via client
    socket.on('join_org', (orgId) => {
      console.log(`[Socket] Client ${socket.id} joining room: org_${orgId}`);
      socket.join(`org_${orgId}`);
      
      waManager.getInstances().filter(i => i.organization_id === orgId).forEach((instance) => {
        socket.emit('instance.status.updated', { 
          instanceId: instance.id,
          status: instance.status,
          qr: instance.qrCode,
          me: instance.user
        });
      });
    });

    socket.on('disconnect', (reason) => {
      console.log('Client disconnected from WebSocket:', socket.id, 'Reason:', reason);
    });
  });

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      instances: waManager.getInstances().length
    });
  });

  // API Routes
  app.get('/api/whatsapp/instances', requireAuth, async (req, res) => {
    try {
      const orgId = req.query.orgId as string;
      if (!orgId) return res.status(400).json({ error: 'orgId is required' });

      const token = (req as any).token;
      // Fetch all from DB
      const scopedClient = getScopedClient(token);
      const { data: dbInstances, error: fetchErr } = await scopedClient
        .from('whatsapp_instances')
        .select('*')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false });

      if (fetchErr) {
        console.error('Fetch instances DB error:', fetchErr);
        throw fetchErr;
      }
      if (!dbInstances) return res.json([]);

      // Merge with runtime memory state
      const memoryInstances = waManager.getInstances();
      const merged = dbInstances.map(dbInst => {
        const memInst = memoryInstances.find(m => m.id === dbInst.id);
        return {
          id: dbInst.id,
          name: dbInst.name,
          organization_id: dbInst.organization_id,
          status: memInst ? memInst.status : dbInst.status,
          qrCode: memInst ? memInst.qrCode : null,
          user: memInst ? memInst.user : null,
          phone_number: dbInst.phone_number,
          profile_pushname: dbInst.profile_pushname,
          profile_pic_url: dbInst.profile_pic_url
        };
      });

      res.json(merged);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch instances' });
    }
  });

  app.get('/api/whatsapp/instances/:id/chats', requireAuth, async (req, res) => {
    try {
      const id = req.params.id as string;
      const token = (req as any).token;
      
      const scopedClient = getScopedClient(token);
      const { data, error } = await scopedClient
        .from('whatsapp_chats')
        .select(`
          id, jid, instance_id, organization_id, is_group, group_name, contact_id,
          chat_type, remote_phone, avatar_url,
          last_message_at, last_message, last_message_type, last_message_from_me,
          unread_count, created_at, updated_at,
          whatsapp_contacts ( id, clean_number, saved_name, pushname, profile_pic_url )
        `)
        .eq('instance_id', id)
        .order('last_message_at', { ascending: false });
        
      if (error) throw error;
      res.json(data || []);
    } catch (error) {
      console.error('Error fetching chats:', error);
      res.status(500).json({ error: 'Failed to fetch chats' });
    }
  });

  app.get('/api/whatsapp/chats/:chatId/messages', requireAuth, async (req, res) => {
    try {
      const chatId = req.params.chatId as string;
      const token = (req as any).token;
      
      const scopedClient = getScopedClient(token);
      const { data, error } = await scopedClient
        .from('whatsapp_messages')
        .select(`
          id, message_id, chat_id, from_me, message_type, content, caption,
          media_url, media_mime_type, file_name, file_size, storage_path, storage_bucket,
          duration_seconds, sender_phone, sender_name,
          participant_clean_number, participant_pushname,
          mentions_json, timestamp, created_at
        `)
        .eq('chat_id', chatId)
        .order('timestamp', { ascending: true });
        
      if (error) throw error;
      res.json(data || []);
    } catch (error) {
      console.error('Error fetching messages:', error);
      res.status(500).json({ error: 'Failed to fetch messages' });
    }
  });

  app.post('/api/whatsapp/instances', requireAuth, async (req, res) => {
    try {
      const { name, organization_id } = req.body;
      const token = (req as any).token;
      if (!name || !organization_id) return res.status(400).json({ error: 'Name and organization_id required' });

      // Create in Supabase DB with scoped client matching the user's RLS
      const scopedClient = getScopedClient(token);
      const { data: newInst, error } = await scopedClient
        .from('whatsapp_instances')
        .insert({ name, organization_id, status: 'CLOSED' })
        .select('*')
        .single();
        
      if (error || !newInst) {
        console.error('Insert instance error:', error);
        throw error;
      }

      // Start Baileys immediately
      waManager.startInstance(newInst.id, newInst.organization_id, newInst.name);
      
      res.json(newInst);
    } catch (error) {
      res.status(500).json({ error: 'Failed to create instance' });
    }
  });

  app.post('/api/whatsapp/instances/:id/start', requireAuth, async (req, res) => {
    const id = req.params.id as string;
    
    const { data: dbInst } = await supabaseAuth.from('whatsapp_instances').select('organization_id, name').eq('id', id).single();
    
    if (!dbInst) return res.status(404).json({ error: 'Instance not found in DB' });

    waManager.startInstance(id, dbInst.organization_id, dbInst.name);
    res.json({ success: true });
  });

  app.post('/api/whatsapp/instances/:id/send', requireAuth, async (req, res) => {
    try {
      const id = req.params.id as string;
      const { jid, content } = req.body;
      
      if (!jid || !content) {
        return res.status(400).json({ error: 'jid and content are required' });
      }

      await waManager.sendMessage(id, jid, content);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to send message' });
    }
  });

  app.post('/api/whatsapp/instances/:id/logout', requireAuth, async (req, res) => {
    try {
      const id = req.params.id as string;
      await waManager.logoutInstance(id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to logout' });
    }
  });

  app.delete('/api/whatsapp/instances/:id', requireAuth, async (req, res) => {
    try {
      const id = req.params.id as string;
      await waManager.deleteInstance(id);
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
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Auto-start instances on boot
  async function autoStartInstances() {
    try {
      console.log(`[AutoStart] Fetching instances from ${process.env.VITE_SUPABASE_URL}...`);
      const { data: dbInstances, error } = await supabaseAuth
        .from('whatsapp_instances')
        .select('*');
      
      if (error) {
        console.error('[AutoStart] Error fetching instances:', error);
        return;
      }

      if (!dbInstances || dbInstances.length === 0) {
        console.log('[AutoStart] No instances found to start.');
        return;
      }

      console.log(`[AutoStart] Found ${dbInstances.length} instances. Starting...`);
      for (const inst of dbInstances) {
        waManager.startInstance(inst.id, inst.organization_id, inst.name);
      }
    } catch (err) {
      console.error('[AutoStart] Critical error:', err);
    }
  }

  // Start with a small delay to ensure all services are ready
  setTimeout(autoStartInstances, 2000);

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
    // We don't start any instance automatically here, 
    // the frontend will trigger start for each registered instance
  });
}

startServer();
