// src/services/whatsappNormalizer.ts
// Centralized normalization layer for all WhatsApp data

import { supabaseAuth } from './supabaseServer';
import pino from 'pino';

const logger = pino({ level: 'info' });

const STORAGE_BUCKET = 'fluowai';

// =====================================================================
// PHONE NORMALIZATION — Always returns: 5548988003260
// =====================================================================

/**
 * Normalizes any phone input to the standard format: 5548988003260
 * No +, no spaces, no hyphens, no @, no JID suffix
 */
export const normalizePhone = (input: string): string => {
  if (!input) return '';
  // Strip everything after @ (JID suffix)
  const beforeAt = input.split('@')[0];
  // Strip device ID (:xx)
  const beforeColon = beforeAt.split(':')[0];
  // Remove all non-digit characters
  return beforeColon.replace(/\D/g, '');
};

/**
 * Checks if a JID is a real chat (phone or group), not @lid or @newsletter
 */
export const isRealChatJid = (jid: string): boolean => {
  if (!jid) return false;
  return jid.includes('@s.whatsapp.net') || jid.includes('@g.us');
};

/**
 * Checks if the JID is a group
 */
export const isGroupJid = (jid: string): boolean => {
  return jid?.includes('@g.us') || false;
};

/**
 * Extracts clean JID (removes device ID :xx)
 */
export const extractCleanJid = (jid: string): string => {
  if (!jid) return '';
  const parts = jid.split('@');
  if (parts.length !== 2) return jid;
  const number = parts[0].split(':')[0];
  return `${number}@${parts[1]}`;
};

// =====================================================================
// MESSAGE TYPE CLASSIFICATION
// =====================================================================

export type MessageType = 
  | 'text' | 'image' | 'video' | 'audio' | 'ptt' 
  | 'document' | 'pdf' | 'sticker' | 'location' 
  | 'contact' | 'reaction' | 'system' | 'unknown';

export interface ParsedMessage {
  type: MessageType;
  body: string;        // text content or empty
  caption: string;     // media caption
  mimetype: string;
  fileName: string;
  fileSize: number;
  durationSeconds: number;
  quotedMessageId: string | null;
  mentionedJids: string[];
}

/**
 * Baileys sometimes returns Long objects {low, high, unsigned} instead of numbers.
 * This helper converts any such value to a plain number.
 */
const toNumber = (val: any): number => {
  if (!val) return 0;
  if (typeof val === 'number') return val;
  if (typeof val === 'object' && 'low' in val) return val.low;
  if (typeof val === 'string') return parseInt(val, 10) || 0;
  return 0;
};

/**
 * Robust message classifier that extracts all metadata
 */
export const parseIncomingMessage = (msg: any): ParsedMessage => {
  const result: ParsedMessage = {
    type: 'unknown',
    body: '',
    caption: '',
    mimetype: '',
    fileName: '',
    fileSize: 0,
    durationSeconds: 0,
    quotedMessageId: null,
    mentionedJids: [],
  };

  try {
    const m = msg.message;
    if (!m) return result;

    // Text
    if (m.conversation) {
      result.type = 'text';
      result.body = m.conversation;
    } 
    else if (m.extendedTextMessage) {
      result.type = 'text';
      result.body = m.extendedTextMessage.text || '';
      result.quotedMessageId = m.extendedTextMessage.contextInfo?.stanzaId || null;
      result.mentionedJids = m.extendedTextMessage.contextInfo?.mentionedJid || [];
    }
    // Image
    else if (m.imageMessage) {
      result.type = 'image';
      result.caption = m.imageMessage.caption || '';
      result.mimetype = m.imageMessage.mimetype || 'image/jpeg';
      result.fileSize = toNumber(m.imageMessage.fileLength);
    }
    // Video
    else if (m.videoMessage) {
      result.type = 'video';
      result.caption = m.videoMessage.caption || '';
      result.mimetype = m.videoMessage.mimetype || 'video/mp4';
      result.fileSize = toNumber(m.videoMessage.fileLength);
      result.durationSeconds = toNumber(m.videoMessage.seconds);
    }
    // Audio (voice note = ptt, regular = audio)
    else if (m.audioMessage) {
      result.type = m.audioMessage.ptt ? 'ptt' : 'audio';
      result.mimetype = m.audioMessage.mimetype || 'audio/ogg';
      result.fileSize = toNumber(m.audioMessage.fileLength);
      result.durationSeconds = toNumber(m.audioMessage.seconds);
    }
    // Document
    else if (m.documentMessage) {
      const mime = m.documentMessage.mimetype || '';
      result.type = mime.includes('pdf') ? 'pdf' : 'document';
      result.fileName = m.documentMessage.fileName || '';
      result.caption = m.documentMessage.caption || '';
      result.mimetype = mime;
      result.fileSize = toNumber(m.documentMessage.fileLength);
    }
    // Sticker
    else if (m.stickerMessage) {
      result.type = 'sticker';
      result.mimetype = m.stickerMessage.mimetype || 'image/webp';
      result.fileSize = toNumber(m.stickerMessage.fileLength);
    }
    // Location
    else if (m.locationMessage) {
      result.type = 'location';
      const lat = m.locationMessage.degreesLatitude;
      const lng = m.locationMessage.degreesLongitude;
      result.body = `${lat},${lng}`;
      result.caption = m.locationMessage.name || m.locationMessage.address || '';
    }
    // Contact
    else if (m.contactMessage) {
      result.type = 'contact';
      result.body = m.contactMessage.displayName || '';
      result.caption = m.contactMessage.vcard || '';
    }
    // Reaction
    else if (m.reactionMessage) {
      result.type = 'reaction';
      result.body = m.reactionMessage.text || '';
    }

    // Extract mentions from contextInfo (any message type can have them)
    const contextInfo = m.extendedTextMessage?.contextInfo 
      || m.imageMessage?.contextInfo 
      || m.videoMessage?.contextInfo
      || m.documentMessage?.contextInfo;
    if (contextInfo?.mentionedJid?.length) {
      result.mentionedJids = contextInfo.mentionedJid;
    }
    if (contextInfo?.stanzaId && !result.quotedMessageId) {
      result.quotedMessageId = contextInfo.stanzaId;
    }

  } catch (error) {
    console.error('Error parsing message:', error);
  }

  return result;
};

// =====================================================================
// DISPLAY NAME RESOLUTION
// =====================================================================

/**
 * Resolve display name for a contact. Priority: saved_name > pushname > phone
 */
export const resolveDisplayName = (contact: { saved_name?: string; pushname?: string; clean_number?: string } | null, phone?: string): string => {
  if (contact?.saved_name) return contact.saved_name;
  if (contact?.pushname) return contact.pushname;
  if (contact?.clean_number) return contact.clean_number;
  if (phone) return phone;
  return '';
};

/**
 * Friendly preview text for media types in chat list
 */
export const getMediaPreviewText = (type: MessageType, body?: string): string => {
  switch (type) {
    case 'text': return body || '';
    case 'image': return '📷 Foto';
    case 'video': return '🎥 Vídeo';
    case 'audio': return '🎤 Áudio';
    case 'ptt': return '🎤 Áudio';
    case 'document': return '📎 Documento';
    case 'pdf': return '📄 PDF';
    case 'sticker': return '🏷️ Sticker';
    case 'location': return '📍 Localização';
    case 'contact': return '👤 Contato';
    case 'reaction': return body || '❤️';
    default: return body || '';
  }
};

// =====================================================================
// MENTIONS RESOLUTION
// =====================================================================

export interface ResolvedMention {
  phone: string;
  displayName: string;
}

/**
 * Resolve mentions from JIDs to display names
 */
export const resolveMentions = async (mentionedJids: string[], orgId: string): Promise<ResolvedMention[]> => {
  if (!mentionedJids.length) return [];

  const mentions: ResolvedMention[] = [];
  for (const jid of mentionedJids) {
    const phone = normalizePhone(jid);
    if (!phone) continue;

    let displayName = phone; // fallback
    try {
      const { data: contact } = await supabaseAuth.from('whatsapp_contacts')
        .select('saved_name, pushname')
        .eq('organization_id', orgId)
        .eq('clean_number', phone)
        .single();
      if (contact) {
        displayName = contact.saved_name || contact.pushname || phone;
      }
    } catch {
      // Use phone as fallback
    }

    mentions.push({ phone, displayName });
  }
  return mentions;
};

// =====================================================================
// STORAGE: Upload to bucket 'fluowai'
// =====================================================================

/**
 * Build a clean, organized storage path
 */
export const buildStoragePath = (
  instanceId: string,
  chatJid: string,
  messageId: string,
  type: MessageType,
  ext: string
): string => {
  const cleanJid = chatJid.split('@')[0];
  const folder = ['image'].includes(type) ? 'images'
    : ['video'].includes(type) ? 'videos'
    : ['audio', 'ptt'].includes(type) ? 'audios'
    : ['pdf', 'document'].includes(type) ? 'documents'
    : ['sticker'].includes(type) ? 'stickers'
    : 'other';
  return `instances/${instanceId}/chats/${cleanJid}/${folder}/${messageId}.${ext}`;
};

/**
 * Build avatar storage path
 */
export const buildAvatarPath = (instanceId: string, phone: string): string => {
  return `instances/${instanceId}/contacts/${phone}/avatar.jpg`;
};

/**
 * Build group cover storage path
 */
export const buildGroupCoverPath = (instanceId: string, groupJid: string): string => {
  const cleanJid = groupJid.split('@')[0];
  return `instances/${instanceId}/groups/${cleanJid}/cover.jpg`;
};

/**
 * Get file extension from mimetype
 */
export const getExtFromMime = (mimetype: string): string => {
  if (!mimetype) return 'bin';
  const map: Record<string, string> = {
    'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif',
    'video/mp4': 'mp4', 'video/3gpp': '3gp',
    'audio/ogg': 'ogg', 'audio/ogg; codecs=opus': 'ogg', 'audio/mpeg': 'mp3', 'audio/mp4': 'm4a',
    'application/pdf': 'pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  };
  // Try exact match first
  if (map[mimetype]) return map[mimetype];
  // Fallback: extract from mimetype
  const sub = mimetype.split('/')[1]?.split(';')[0];
  return sub || 'bin';
};

/**
 * Upload a buffer to the fluowai bucket on Supabase Storage
 * Returns the public URL or null on failure
 */
export const uploadToFluowai = async (
  storagePath: string,
  buffer: Buffer,
  mimeType: string
): Promise<string | null> => {
  try {
    const { data, error } = await supabaseAuth.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, buffer, {
        contentType: mimeType,
        upsert: true
      });

    if (error) {
      logger.error({ err: error, path: storagePath }, `Failed to upload to ${STORAGE_BUCKET}`);
      return null;
    }

    const { data: urlData } = supabaseAuth.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(data.path);

    return urlData.publicUrl;
  } catch (err) {
    logger.error({ err, path: storagePath }, `Exception uploading to ${STORAGE_BUCKET}`);
    return null;
  }
};

/**
 * Fetch and cache a profile picture to the fluowai bucket
 */
export const fetchAndCacheAvatar = async (
  sock: any,
  jid: string,
  storagePath: string
): Promise<string | null> => {
  try {
    const url = await sock.profilePictureUrl(jid, 'image');
    if (!url) return null;

    // Download the image
    const response = await fetch(url);
    if (!response.ok) return null;
    const buffer = Buffer.from(await response.arrayBuffer());

    // Upload to fluowai
    return await uploadToFluowai(storagePath, buffer, 'image/jpeg');
  } catch {
    // Profile picture not available is normal
    return null;
  }
};

export { STORAGE_BUCKET };
