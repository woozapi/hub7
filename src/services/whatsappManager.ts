// src/services/whatsappManager.ts
import makeWASocket, { 
  useMultiFileAuthState, 
  DisconnectReason, 
  fetchLatestBaileysVersion,
  ConnectionState,
  makeCacheableSignalKeyStore,
  WAMessage,
  downloadMediaMessage
} from '@whiskeysockets/baileys';
import QRCode from 'qrcode';
import pino from 'pino';
import fs from 'fs';
import path from 'path';
import { Server } from 'socket.io';
import { supabaseAuth } from './supabaseServer';
import {
  normalizePhone, isRealChatJid, isGroupJid, extractCleanJid,
  parseIncomingMessage, buildStoragePath, uploadToFluowai,
  getExtFromMime, fetchAndCacheAvatar, buildAvatarPath,
  buildGroupCoverPath, resolveMentions, getMediaPreviewText,
  STORAGE_BUCKET, MessageType
} from './whatsappNormalizer';

const logger = pino({ level: 'info' });

export type InstanceStatus = 'STARTING' | 'WAITING_QR' | 'CONNECTING' | 'OPEN' | 'CLOSED' | 'ERROR';

export interface WAInstance {
  id: string;
  organization_id: string;
  name: string;
  status: InstanceStatus;
  qrCode: string | null;
  sock: ReturnType<typeof makeWASocket> | null;
  isStarting: boolean;
  user?: any;
}

class WhatsAppManager {
  private instances = new Map<string, WAInstance>();
  private io: Server | null = null;
  
  setIo(io: Server) { this.io = io; }

  emitToOrg(orgId: string, event: string, data: any) {
    if (this.io) {
      console.log(`[Socket] Emitting ${event} to org_${orgId}`, data.messageId || data.instanceId || '');
      this.io.to(`org_${orgId}`).emit(event, data);
    }
  }

  getInstances() {
    return Array.from(this.instances.values()).map(inst => ({
      id: inst.id, organization_id: inst.organization_id, name: inst.name,
      status: inst.status, qrCode: inst.qrCode, user: inst.user
    }));
  }

  getInstance(id: string) { return this.instances.get(id); }

  async startInstance(id: string, organizationId: string, name: string) {
    let instance = this.instances.get(id);
    if (!instance) {
      instance = { id, organization_id: organizationId, name, status: 'STARTING', qrCode: null, sock: null, isStarting: false };
      this.instances.set(id, instance);
    }
    if (instance.isStarting) return;
    instance.isStarting = true;
    
    try {
      const authFolder = path.join(process.cwd(), `auth_info_baileys_${id}`);
      const { state, saveCreds } = await useMultiFileAuthState(authFolder);
      const { version } = await fetchLatestBaileysVersion();
      logger.info(`[Instance ${id}] Starting WA v${version.join('.')}`);

      const sock = makeWASocket({
        version, logger: pino({ level: 'silent' }) as any, printQRInTerminal: false,
        auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, logger as any) },
        browser: ['FLUOW AI SaaS', 'Chrome', '2.0.0'],
        syncFullHistory: false, qrTimeout: 60000, connectTimeoutMs: 60000, keepAliveIntervalMs: 10000,
      });
      instance.sock = sock;

      sock.ev.on('connection.update', (update) => {
        const { connection, qr } = update;
        if (qr) { instance.status = 'WAITING_QR'; this.handleConnectionUpdate(id, update); }
        else if (connection === 'open') { instance.status = 'OPEN'; this.handleConnectionUpdate(id, update); }
        else if (connection === 'close') { instance.status = 'CLOSED'; this.handleConnectionUpdate(id, update); }
      });
      sock.ev.on('creds.update', saveCreds);
      sock.ev.on('messages.upsert', (m) => {
        console.log(`[Instance ${id}] messages.upsert type=${m.type} count=${m.messages.length}`);
        this.handleMessagesUpsert(id, m);
      });
      sock.ev.on('contacts.upsert', (contacts) => this.handleContactsUpsert(id, contacts));

      instance.isStarting = false;
      this.emitToOrg(organizationId, 'instance.status.updated', { instanceId: id, status: instance.status, qr: instance.qrCode });
    } catch (error) {
      console.error(`[Instance ${id}] Critical Error:`, error);
      const inst = this.instances.get(id);
      if (inst) { inst.isStarting = false; inst.status = 'ERROR'; }
      this.emitToOrg(organizationId, 'instance.status.updated', { instanceId: id, status: 'ERROR', qr: null });
    }
  }

  private async handleConnectionUpdate(id: string, update: Partial<ConnectionState>) {
    const instance = this.instances.get(id);
    if (!instance) return;
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      instance.qrCode = await QRCode.toDataURL(qr);
      instance.status = 'WAITING_QR';
      this.updateDbStatus(id, 'WAITING_QR');
      this.emitToOrg(instance.organization_id, 'instance.status.updated', { instanceId: id, status: instance.status, qr: instance.qrCode });
    }
    if (connection === 'close') {
      const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
      const isLoggedOut = statusCode === DisconnectReason.loggedOut;
      const isQRExpired = statusCode === 401 || (lastDisconnect?.error?.message || '').includes('QR refs');
      logger.warn(`[Instance ${id}] Connection closed. Reason: ${statusCode}`);
      instance.qrCode = null; instance.status = 'CLOSED'; instance.user = null;
      this.updateDbStatus(id, 'CLOSED');
      this.emitToOrg(instance.organization_id, 'instance.status.updated', { instanceId: id, status: 'CLOSED', qr: null });
      if (isLoggedOut || isQRExpired) {
        const authFolder = path.join(process.cwd(), `auth_info_baileys_${id}`);
        if (fs.existsSync(authFolder)) fs.rmSync(authFolder, { recursive: true, force: true });
      } else {
        logger.info(`[Instance ${id}] Auto reconnecting in 5s...`);
        setTimeout(() => this.startInstance(instance.id, instance.organization_id, instance.name), 5000);
      }
    } else if (connection === 'open') {
      instance.qrCode = null; instance.status = 'OPEN'; instance.user = instance.sock?.user;
      this.updateDbStatus(id, 'OPEN', instance.sock?.user);
      this.emitToOrg(instance.organization_id, 'instance.status.updated', { instanceId: id, status: 'OPEN', qr: null, me: instance.user });
      logger.info(`[Instance ${id}] Connection OPEN.`);
    }
  }

  // =====================================================================
  // MESSAGE HANDLING — PERSIST FIRST, EMIT AFTER
  // =====================================================================

  private async handleMessagesUpsert(id: string, { messages, type }: { messages: WAMessage[], type: string }) {
    if (type !== 'notify' && type !== 'append') return;
    const instance = this.instances.get(id);
    if (!instance || !instance.sock) return;

    for (const msg of messages) {
      if (!msg.message) continue;

      const rawJid = msg.key.remoteJid || '';
      const jid = extractCleanJid(rawJid);

      // Skip non-phone JIDs (@lid, @newsletter)
      if (!isRealChatJid(jid)) {
        console.log(`[Instance ${id}] Skipping: ${jid}`);
        continue;
      }

      const isGroup = isGroupJid(jid);
      const fromMe = !!msg.key.fromMe;
      const chatType = isGroup ? 'group' : 'private';

      // Sender info
      const senderJid = isGroup ? extractCleanJid(msg.key.participant || '') : jid;
      const senderPhone = normalizePhone(senderJid);
      const senderName = msg.pushName || '';
      const remotePhone = isGroup ? '' : normalizePhone(jid);

      // Parse message with robust classifier
      const parsed = parseIncomingMessage(msg);
      const previewText = getMediaPreviewText(parsed.type, parsed.body || parsed.caption);

      console.log(`[Instance ${id}] ${fromMe ? 'SENT' : 'RECV'} [${parsed.type}] from ${senderPhone}: ${previewText.substring(0, 50)}`);

      // ========== MEDIA DOWNLOAD + UPLOAD TO FLUOWAI ==========
      let mediaUrl: string | null = null;
      let storagePath: string | null = null;
      const mediaTypes: MessageType[] = ['image', 'video', 'audio', 'ptt', 'document', 'pdf', 'sticker'];

      if (mediaTypes.includes(parsed.type)) {
        try {
          const buffer = await downloadMediaMessage(msg, 'buffer', {}, {
            logger: pino({ level: 'silent' }) as any,
            reuploadRequest: instance.sock.updateMediaMessage
          });

          if (buffer) {
            const ext = getExtFromMime(parsed.mimetype);
            storagePath = buildStoragePath(id, jid, msg.key.id!, parsed.type, ext);
            mediaUrl = await uploadToFluowai(storagePath, buffer as Buffer, parsed.mimetype);
            if (mediaUrl) {
              console.log(`[Instance ${id}] Media uploaded to fluowai: ${storagePath}`);
            }
          }
        } catch (mediaErr) {
          logger.error({ err: mediaErr }, 'Failed to download/upload media');
        }
      }

      // ========== RESOLVE MENTIONS ==========
      let mentionsJson: any[] | null = null;
      if (parsed.mentionedJids.length > 0) {
        try {
          mentionsJson = await resolveMentions(parsed.mentionedJids, instance.organization_id);
        } catch {
          mentionsJson = parsed.mentionedJids.map(j => ({ phone: normalizePhone(j), displayName: normalizePhone(j) }));
        }
      }

      // ========== PERSIST TO SUPABASE ==========
      let chatId: string | null = null;
      let groupName: string | null = null;
      let avatarUrl: string | null = null;

      try {
        // 1. Resolve contact (private chats only)
        let contactId: string | null = null;
        if (!isGroup && remotePhone) {
          const { data: existing } = await supabaseAuth.from('whatsapp_contacts')
            .select('id, pushname, profile_pic_url')
            .eq('organization_id', instance.organization_id)
            .eq('clean_number', remotePhone)
            .single();

          if (existing) {
            contactId = existing.id;
            // Update pushname if better
            if (senderName && !fromMe && !existing.pushname) {
              await supabaseAuth.from('whatsapp_contacts')
                .update({ pushname: senderName, updated_at: new Date().toISOString() })
                .eq('id', contactId);
            }
            // Fetch avatar if missing
            if (!existing.profile_pic_url && instance.sock) {
              const avatarPath = buildAvatarPath(id, remotePhone);
              const picUrl = await fetchAndCacheAvatar(instance.sock, rawJid, avatarPath);
              if (picUrl) {
                await supabaseAuth.from('whatsapp_contacts')
                  .update({ profile_pic_url: picUrl, updated_at: new Date().toISOString() })
                  .eq('id', contactId);
                avatarUrl = picUrl;
              }
            } else {
              avatarUrl = existing.profile_pic_url || null;
            }
          } else {
            // Create contact
            let picUrl: string | null = null;
            if (instance.sock) {
              const avatarPath = buildAvatarPath(id, remotePhone);
              picUrl = await fetchAndCacheAvatar(instance.sock, rawJid, avatarPath);
            }
            const { data: newContact } = await supabaseAuth.from('whatsapp_contacts')
              .insert({
                organization_id: instance.organization_id,
                clean_number: remotePhone,
                pushname: (!fromMe && senderName) ? senderName : null,
                profile_pic_url: picUrl
              })
              .select('id').single();
            if (newContact) contactId = newContact.id;
            avatarUrl = picUrl;
          }
        }

        // 2. Group metadata
        if (isGroup && instance.sock) {
          try {
            const meta = await instance.sock.groupMetadata(rawJid);
            groupName = meta?.subject || null;
          } catch { /* Group metadata unavailable */ }

          // Fetch group cover
          try {
            const coverPath = buildGroupCoverPath(id, jid);
            avatarUrl = await fetchAndCacheAvatar(instance.sock, rawJid, coverPath);
          } catch { /* Cover unavailable */ }
        }

        // 3. Upsert Chat
        const chatData: any = {
          organization_id: instance.organization_id,
          instance_id: id,
          jid,
          is_group: isGroup,
          chat_type: chatType,
          remote_phone: remotePhone || null,
          last_message: previewText,
          last_message_type: parsed.type,
          last_message_from_me: fromMe,
          last_message_at: new Date((msg.messageTimestamp as number) * 1000).toISOString(),
          updated_at: new Date().toISOString()
        };
        if (contactId) chatData.contact_id = contactId;
        if (groupName) chatData.group_name = groupName;
        if (avatarUrl) chatData.avatar_url = avatarUrl;

        const { data: upsertedChat, error: chatError } = await supabaseAuth.from('whatsapp_chats')
          .upsert(chatData, { onConflict: 'instance_id, jid' })
          .select('id, group_name, avatar_url')
          .single();

        if (chatError) {
          console.error(`[Instance ${id}] Chat upsert error:`, chatError);
          continue;
        }
        chatId = upsertedChat?.id || null;
        if (!groupName && upsertedChat?.group_name) groupName = upsertedChat.group_name;
        if (!avatarUrl && upsertedChat?.avatar_url) avatarUrl = upsertedChat.avatar_url;

        // 4. Insert Message
        if (chatId) {
          const { error: msgError } = await supabaseAuth.from('whatsapp_messages').upsert({
            organization_id: instance.organization_id,
            chat_id: chatId,
            message_id: msg.key.id!,
            from_me: fromMe,
            message_type: parsed.type,
            content: parsed.body || null,
            caption: parsed.caption || null,
            file_name: parsed.fileName || null,
            file_size: parsed.fileSize || null,
            media_url: mediaUrl,
            media_mime_type: parsed.mimetype || null,
            storage_path: storagePath,
            storage_bucket: mediaUrl ? STORAGE_BUCKET : null,
            duration_seconds: parsed.durationSeconds || null,
            sender_phone: senderPhone || null,
            sender_name: (!fromMe && senderName) ? senderName : (fromMe ? 'Você' : null),
            participant_clean_number: isGroup ? senderPhone : null,
            participant_pushname: isGroup ? senderName : null,
            mentions_json: mentionsJson ? JSON.stringify(mentionsJson) : null,
            timestamp: (msg.messageTimestamp as number)
          }, { onConflict: 'organization_id, message_id' });

          if (msgError) console.error(`[Instance ${id}] Message insert error:`, msgError);

          // 5. Create or update ticket (only for incoming messages from contacts)
          if (!fromMe && chatId && contactId) {
            try {
              const { data: existingTicket } = await supabaseAuth
                .from('tickets')
                .select('id, status')
                .eq('chat_id', chatId)
                .in('status', ['pending', 'open', 'waiting'])
                .single();

              if (!existingTicket) {
                const { data: newTicket } = await supabaseAuth
                  .from('tickets')
                  .insert({
                    organization_id: instance.organization_id,
                    chat_id: chatId,
                    contact_id: contactId,
                    instance_id: id,
                    status: 'pending',
                    source: 'whatsapp'
                  })
                  .select('id')
                  .single();

                if (newTicket) {
                  console.log(`[Instance ${id}] Created new ticket:`, newTicket.id);
                }
              } else {
                await supabaseAuth
                  .from('tickets')
                  .update({ 
                    unread_count: existingTicket.status === 'open' ? 1 : 0,
                    updated_at: new Date().toISOString() 
                  })
                  .eq('id', existingTicket.id);
              }
            } catch (ticketErr) {
              console.error(`[Instance ${id}] Ticket error:`, ticketErr);
            }
          }
        }

      } catch (err) {
        logger.error({ err }, 'Error persisting to Supabase');
        continue;
      }

      // ========== EMIT WEBSOCKET AFTER PERSIST ==========
      this.emitToOrg(instance.organization_id, 'chat.message.created', {
        instanceId: id,
        chatId,
        messageId: msg.key.id,
        chatJid: jid,
        chatType,
        isGroup,
        groupName,
        avatarUrl,
        senderPhone,
        senderName: (!fromMe && senderName) ? senderName : (fromMe ? 'Você' : ''),
        remotePhone,
        type: parsed.type,
        content: parsed.body,
        caption: parsed.caption,
        mediaUrl,
        fileName: parsed.fileName,
        fileSize: parsed.fileSize,
        durationSeconds: parsed.durationSeconds,
        mentionsJson,
        fromMe,
        timestamp: msg.messageTimestamp
      });
    }
  }

  private async handleContactsUpsert(id: string, contacts: any[]) {
    const instance = this.instances.get(id);
    if (!instance) return;

    for (const contact of contacts) {
      const jid = extractCleanJid(contact.id);
      if (isGroupJid(jid) || jid.includes('@lid') || jid.includes('@newsletter')) continue;
      const cleanNumber = normalizePhone(jid);
      if (!cleanNumber) continue;

      try {
        await supabaseAuth.from('whatsapp_contacts').upsert({
          organization_id: instance.organization_id,
          clean_number: cleanNumber,
          saved_name: contact.name || null,
          pushname: contact.notify || contact.verifiedName || null
        }, { onConflict: 'organization_id, clean_number' });
      } catch { /* Silent */ }
    }
  }

  private async updateDbStatus(id: string, status: string, user?: any) {
    try {
      const updateData: any = { status, updated_at: new Date().toISOString() };
      if (user) {
        updateData.phone_number = normalizePhone(user.id);
        updateData.profile_pushname = user.name || '';
      }
      await supabaseAuth.from('whatsapp_instances').update(updateData).eq('id', id);
    } catch (err) {
      logger.error({ err }, 'Error updating DB status');
    }
  }

  async logoutInstance(id: string) {
    const instance = this.instances.get(id);
    if (instance?.sock) await instance.sock.logout();
  }

  async deleteInstance(id: string) {
    const instance = this.instances.get(id);
    if (instance?.sock) {
      instance.sock.ev.removeAllListeners('connection.update');
      instance.sock.ev.removeAllListeners('messages.upsert');
      instance.sock.end(undefined);
    }
    const authFolder = path.join(process.cwd(), `auth_info_baileys_${id}`);
    if (fs.existsSync(authFolder)) fs.rmSync(authFolder, { recursive: true, force: true });
    this.instances.delete(id);
  }

  async sendMessage(id: string, jid: string, content: string) {
    const instance = this.instances.get(id);
    if (!instance?.sock) throw new Error('WhatsApp Instance not connected');
    const formattedJid = jid.includes('@') ? jid : `${jid}@s.whatsapp.net`;
    try {
      return await instance.sock.sendMessage(formattedJid, { text: content });
    } catch (err) {
      logger.error({ err }, 'Error sending message');
      throw err;
    }
  }
}

export const waManager = new WhatsAppManager();
