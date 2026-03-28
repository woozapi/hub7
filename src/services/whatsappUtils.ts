// src/services/whatsappUtils.ts
export const cleanWhatsAppNumber = (jid: string): string => {
  if (!jid) return '';
  // JID usually comes as 5548988003260@s.whatsapp.net or 5548988003260:12@s.whatsapp.net
  return jid.split('@')[0].split(':')[0].replace(/\D/g, '');
};

export const extractJid = (jid: string): string => {
  if (!jid) return '';
  // removes devices ID :xx if present keeping the @s.whatsapp.net
  const parts = jid.split('@');
  if (parts.length !== 2) return jid;
  const number = parts[0].split(':')[0];
  return `${number}@${parts[1]}`;
};

export const isGroupStatus = (jid: string): boolean => {
  return jid?.includes('@g.us');
};

export const isLidJid = (jid: string): boolean => {
  return jid?.includes('@lid');
};

export const isNewsletterJid = (jid: string): boolean => {
  return jid?.includes('@newsletter');
};

// Returns true only for real phone-based JIDs (@s.whatsapp.net)
export const isRealChatJid = (jid: string): boolean => {
  return jid?.includes('@s.whatsapp.net') || jid?.includes('@g.us');
};

export const formatPhoneNumber = (number: string): string => {
  if (!number) return '';
  // Brazilian format: +55 48 98800-3260
  if (number.length === 13 && number.startsWith('55')) {
    return `+${number.slice(0,2)} ${number.slice(2,4)} ${number.slice(4,9)}-${number.slice(9)}`;
  }
  if (number.length >= 10) {
    return `+${number}`;
  }
  return number;
};

export const parseMessagePayload = (msg: any) => {
  let type = 'unknown';
  let content = '';
  let mediaUrl = null;
  let quotedMessageId = null;
  let mimetype = null;

  try {
    const message = msg.message;
    if (!message) return { type, content, mediaUrl, quotedMessageId, mimetype };

    if (message.conversation) {
      type = 'text';
      content = message.conversation;
    } else if (message.extendedTextMessage) {
      type = 'text';
      content = message.extendedTextMessage.text || '';
      quotedMessageId = message.extendedTextMessage.contextInfo?.stanzaId || null;
    } else if (message.imageMessage) {
      type = 'image';
      content = message.imageMessage.caption || '';
      mimetype = message.imageMessage.mimetype;
    } else if (message.videoMessage) {
      type = 'video';
      content = message.videoMessage.caption || '';
      mimetype = message.videoMessage.mimetype;
    } else if (message.audioMessage) {
      type = 'audio';
      mimetype = message.audioMessage.mimetype;
    } else if (message.documentMessage) {
      type = 'document';
      content = message.documentMessage.fileName || '';
      mimetype = message.documentMessage.mimetype;
    }
  } catch (error) {
    console.error('Error parsing message payload', error);
  }

  return { type, content, mediaUrl, quotedMessageId, mimetype };
};
