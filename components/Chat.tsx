import React, { useState, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { supabase } from '../src/lib/supabase';
import { useAuth } from '../src/lib/AuthContext';
import { Icons } from './icons';
import Input from './ui/Input';

// =====================================================================
// HELPERS — Phone always as raw digits: 5548988003260
// =====================================================================

const fetchWithAuth = async (url: string, options: RequestInit = {}) => {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return fetch(url, { ...options, headers: { ...options.headers, ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
};

/** Strip JID suffix, return raw digits: 5548988003260 */
const cleanPhone = (jid: string): string => {
  if (!jid) return '';
  return jid.split('@')[0].split(':')[0].replace(/\D/g, '');
};

/** Friendly preview for media types */
const mediaPreview = (type: string, body?: string): string => {
  switch (type) {
    case 'image': return '📷 Foto';
    case 'video': return '🎥 Vídeo';
    case 'audio': case 'ptt': return '🎤 Áudio';
    case 'document': return '📎 Documento';
    case 'pdf': return '📄 PDF';
    case 'sticker': return '🏷️ Sticker';
    case 'location': return '📍 Localização';
    case 'contact': return '👤 Contato';
    case 'reaction': return body || '❤️';
    default: return body || '';
  }
};

/** Format file size */
const formatSize = (bytes: number): string => {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
};

// =====================================================================
// INTERFACES
// =====================================================================

interface Message {
  id: string;
  message_id: string;
  content: string;
  caption?: string;
  from_me: boolean;
  message_type: string;
  media_url?: string;
  media_mime_type?: string;
  file_name?: string;
  file_size?: number;
  duration_seconds?: number;
  sender_phone?: string;
  sender_name?: string;
  participant_pushname?: string;
  participant_clean_number?: string;
  mentions_json?: string;
  created_at: string;
}

interface Chat {
  id: string;
  jid: string;
  instance_id: string;
  is_group: boolean;
  chat_type?: string;
  group_name?: string;
  remote_phone?: string;
  avatar_url?: string;
  contact_id?: string;
  last_message_at: string;
  last_message?: string;
  last_message_type?: string;
  last_message_from_me?: boolean;
  unread_count: number;
  contact?: {
    clean_number: string;
    saved_name?: string;
    pushname?: string;
    profile_pic_url?: string;
  };
}

// =====================================================================
// DISPLAY NAME — Priority: saved_name > pushname > raw phone digits
// =====================================================================

const getDisplayName = (chat: Chat): string => {
  if (chat.is_group) return chat.group_name || 'Grupo';
  if (chat.contact?.saved_name) return chat.contact.saved_name;
  if (chat.contact?.pushname) return chat.contact.pushname;
  if (chat.contact?.clean_number) return chat.contact.clean_number;
  if (chat.remote_phone) return chat.remote_phone;
  return cleanPhone(chat.jid);
};

const getAvatar = (chat: Chat): string | null => {
  return chat.avatar_url || chat.contact?.profile_pic_url || null;
};

const getSubtitle = (chat: Chat): string => {
  if (chat.is_group) return chat.group_name || '';
  return chat.remote_phone || chat.contact?.clean_number || cleanPhone(chat.jid);
};

// =====================================================================
// MEDIA COMPONENTS
// =====================================================================

const MessageImage: React.FC<{ url: string; caption?: string }> = ({ url, caption }) => (
  <div>
    <img src={url} alt="" className="rounded-lg max-h-72 object-cover cursor-pointer hover:opacity-90 transition-opacity" onClick={() => window.open(url, '_blank')} />
    {caption && <p className="text-sm mt-1 whitespace-pre-wrap">{caption}</p>}
  </div>
);

const MessageVideo: React.FC<{ url: string; caption?: string }> = ({ url, caption }) => (
  <div>
    <video controls src={url} className="rounded-lg max-h-72 max-w-full" />
    {caption && <p className="text-sm mt-1 whitespace-pre-wrap">{caption}</p>}
  </div>
);

const MessageAudio: React.FC<{ url: string; duration?: number }> = ({ url, duration }) => (
  <div className="flex items-center gap-3 min-w-[200px]">
    <audio controls src={url} className="flex-1 h-8" style={{ maxWidth: '100%' }} />
    {duration ? <span className="text-[10px] text-gray-500 flex-shrink-0">{Math.floor(duration / 60)}:{String(duration % 60).padStart(2, '0')}</span> : null}
  </div>
);

const MessageDocument: React.FC<{ url: string; fileName?: string; fileSize?: number; type: string }> = ({ url, fileName, fileSize, type }) => (
  <a href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-2 bg-white/50 rounded-lg border border-gray-200 hover:bg-white/80 transition-colors min-w-[200px]">
    <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center flex-shrink-0">
      <span className="text-lg">{type === 'pdf' ? '📄' : '📎'}</span>
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-sm font-medium truncate">{fileName || 'Documento'}</p>
      {fileSize ? <p className="text-[10px] text-gray-500">{formatSize(fileSize)}</p> : null}
    </div>
    <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
  </a>
);

const MessageSticker: React.FC<{ url: string }> = ({ url }) => (
  <img src={url} alt="sticker" className="w-32 h-32 object-contain" />
);

// =====================================================================
// CHAT BUBBLE — Routes to correct media component
// =====================================================================

const ChatBubble: React.FC<{ message: Message; isGroup: boolean }> = ({ message, isGroup }) => {
  const time = new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const senderLabel = isGroup && !message.from_me
    ? (message.sender_name || message.participant_pushname || message.sender_phone || message.participant_clean_number || '')
    : '';

  const renderContent = () => {
    const t = message.message_type || 'text';
    const url = message.media_url;

    if (url) {
      switch (t) {
        case 'image': return <MessageImage url={url} caption={message.caption || message.content} />;
        case 'video': return <MessageVideo url={url} caption={message.caption || message.content} />;
        case 'audio': case 'ptt': return <MessageAudio url={url} duration={message.duration_seconds} />;
        case 'pdf': case 'document': return <MessageDocument url={url} fileName={message.file_name} fileSize={message.file_size} type={t} />;
        case 'sticker': return <MessageSticker url={url} />;
        default: return <p className="text-sm whitespace-pre-wrap">{message.content || mediaPreview(t)}</p>;
      }
    }

    // Text-only or fallback
    if (message.content) return <p className="text-sm whitespace-pre-wrap">{message.content}</p>;
    return <p className="text-sm text-gray-400 italic">{mediaPreview(t)}</p>;
  };

  // Stickers have no bubble background
  if (message.message_type === 'sticker' && message.media_url) {
    return (
      <div className={`flex ${message.from_me ? 'justify-end' : 'justify-start'}`}>
        <div className="relative">
          {senderLabel && <p className="text-[10px] font-bold text-brand-yellow-dark mb-1">{senderLabel}</p>}
          <MessageSticker url={message.media_url} />
          <p className="text-[10px] text-gray-400 text-right mt-0.5">{time}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex ${message.from_me ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[75%] lg:max-w-md px-4 py-2 rounded-2xl shadow-sm relative ${message.from_me ? 'bg-brand-yellow text-brand-text-primary rounded-br-none' : 'bg-white border border-gray-100 text-brand-text-primary rounded-bl-none'}`}>
        {senderLabel && <p className="text-[10px] font-bold text-brand-yellow-dark mb-1">{senderLabel}</p>}
        {renderContent()}
        <p className={`text-[10px] mt-1 ${message.from_me ? 'text-gray-700' : 'text-brand-text-secondary'} text-right`}>{time}</p>
      </div>
    </div>
  );
};

// =====================================================================
// CONVERSATION ITEM (sidebar)
// =====================================================================

const ConversationItem: React.FC<{ chat: Chat; active?: boolean; onClick: () => void }> = ({ chat, active, onClick }) => {
  const displayName = getDisplayName(chat);
  const avatar = getAvatar(chat);
  const time = new Date(chat.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const lastMsg = chat.last_message
    ? (chat.last_message.length > 40 ? chat.last_message.substring(0, 40) + '...' : chat.last_message)
    : '';

  return (
    <div onClick={onClick} className={`p-3 flex items-start space-x-3 rounded-lg cursor-pointer transition-colors ${active ? 'bg-brand-yellow-dark text-brand-text-primary' : 'hover:bg-gray-100'}`}>
      <div className="w-10 h-10 bg-gray-200 rounded-full flex-shrink-0 flex items-center justify-center font-bold text-gray-700 overflow-hidden">
        {avatar ? (
          <img src={avatar} alt={displayName} className="w-full h-full object-cover" />
        ) : (
          <span className="text-sm">{displayName.substring(0, 2).toUpperCase()}</span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-center mb-1">
          <p className="text-sm font-semibold truncate text-brand-text-primary">{displayName}</p>
          <p className={`text-xs flex-shrink-0 ml-2 ${active ? 'text-gray-800' : 'text-brand-text-secondary'}`}>{time}</p>
        </div>
        <p className={`text-xs truncate ${active ? 'text-gray-800' : 'text-brand-text-secondary'}`}>
          {chat.last_message_from_me && <span>Você: </span>}
          {lastMsg || getSubtitle(chat)}
        </p>
      </div>
      {chat.unread_count > 0 && !active && (
        <div className="bg-brand-yellow text-brand-text-primary text-[10px] font-bold px-2 py-0.5 rounded-full self-center">
          {chat.unread_count}
        </div>
      )}
    </div>
  );
};

// =====================================================================
// MAIN CHAT COMPONENT
// =====================================================================

const Chat: React.FC = () => {
  const { organization } = useAuth();
  const [chats, setChats] = useState<Chat[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const selectedChatRef = useRef<Chat | null>(null);
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => { selectedChatRef.current = selectedChat; }, [selectedChat]);

  const hashInstanceId = window.location.hash.includes('?instance=')
    ? new URLSearchParams(window.location.hash.split('?')[1]).get('instance')
    : null;
  const [activeInstanceId, setActiveInstanceId] = useState<string | null>(hashInstanceId);
  const activeInstanceIdRef = useRef<string | null>(activeInstanceId);
  useEffect(() => { activeInstanceIdRef.current = activeInstanceId; }, [activeInstanceId]);

  const fetchChats = useCallback(async (instanceId: string) => {
    try {
      if (!instanceId || instanceId === 'undefined') return;
      const res = await fetchWithAuth(`/api/whatsapp/instances/${instanceId}/chats`);
      if (!res.ok) return;
      const data = await res.json();
      setChats(data.map((c: any) => ({ ...c, contact: c.whatsapp_contacts })));
    } catch (err) { console.error('Error fetching chats:', err); }
  }, []);

  const fetchMessages = useCallback(async (chatId: string) => {
    try {
      const res = await fetchWithAuth(`/api/whatsapp/chats/${chatId}/messages`);
      if (!res.ok) return;
      setMessages(await res.json());
    } catch (err) { console.error('Error fetching messages:', err); }
  }, []);

  useEffect(() => {
    const init = async () => {
      if (!organization?.id) return;
      try {
        const res = await fetchWithAuth(`/api/whatsapp/instances?orgId=${organization.id}`);
        if (res.ok) {
          const data = await res.json();
          const target = activeInstanceId || data.find((i: any) => i.status === 'OPEN')?.id || data[0]?.id;
          if (target && target !== 'undefined') {
            setActiveInstanceId(target);
            fetchChats(target);
          }
        }
      } catch (err) { console.error('[Chat] Init error:', err); }
    };
    init();

    const socket = io({ transports: ['polling', 'websocket'], reconnectionAttempts: 5 });
    socket.on('connect', () => {
      if (organization?.id) socket.emit('join_org', organization.id);
    });

    socket.on('chat.message.created', (payload: any) => {
      // Refetch chat list from Supabase (source of truth)
      const instId = activeInstanceIdRef.current;
      if (instId) fetchChats(instId);

      // Append to open chat in real-time
      const current = selectedChatRef.current;
      if (current && current.jid === payload.chatJid) {
        const newMsg: Message = {
          id: crypto.randomUUID(),
          message_id: payload.messageId,
          content: payload.content || '',
          caption: payload.caption || '',
          from_me: payload.fromMe ?? false,
          message_type: payload.type || 'text',
          media_url: payload.mediaUrl,
          file_name: payload.fileName,
          file_size: payload.fileSize,
          duration_seconds: payload.durationSeconds,
          sender_phone: payload.senderPhone,
          sender_name: payload.senderName,
          participant_pushname: payload.senderName,
          participant_clean_number: payload.senderPhone,
          mentions_json: payload.mentionsJson ? JSON.stringify(payload.mentionsJson) : undefined,
          created_at: new Date((payload.timestamp as number) * 1000).toISOString(),
        };
        setMessages(prev => prev.some(m => m.message_id === payload.messageId) ? prev : [...prev, newMsg]);
      }
    });

    return () => { socket.close(); };
  }, [organization?.id, fetchChats]);

  useEffect(() => {
    if (selectedChat) {
      fetchMessages(selectedChat.id);
      setChats(prev => prev.map(c => c.id === selectedChat.id ? { ...c, unread_count: 0 } : c));
    }
  }, [selectedChat, fetchMessages]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const handleSendMessage = async () => {
    if (!inputText.trim() || !selectedChat) return;
    const content = inputText;
    setMessages(prev => [...prev, {
      id: crypto.randomUUID(), message_id: `local-${Date.now()}`, content, from_me: true,
      message_type: 'text', created_at: new Date().toISOString()
    }]);
    setInputText('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      await fetch(`/api/whatsapp/instances/${selectedChat.instance_id}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
        body: JSON.stringify({ jid: selectedChat.jid, content })
      });
    } catch (err) { console.error('Send failed:', err); }
  };

  const filteredChats = searchTerm
    ? chats.filter(c => getDisplayName(c).toLowerCase().includes(searchTerm.toLowerCase()))
    : chats;

  const activeDisplayName = selectedChat ? getDisplayName(selectedChat) : '';
  const activeAvatar = selectedChat ? getAvatar(selectedChat) : null;
  const activeSubtitle = selectedChat ? getSubtitle(selectedChat) : '';

  return (
    <div className="flex h-[calc(100vh-6rem)] bg-white rounded-2xl shadow-sm border border-brand-border overflow-hidden">
      {/* Sidebar */}
      <div className="w-full md:w-1/3 border-r border-brand-border flex flex-col bg-gray-50/50">
        <div className="p-4 border-b border-brand-border bg-white">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-brand-text-primary">Conversas</h2>
            <Icons.MoreVertical className="w-5 h-5 text-brand-text-secondary cursor-pointer" />
          </div>
          <Input type="text" placeholder="Buscar conversas..." className="w-full bg-gray-50 text-sm"
            value={searchTerm} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)} />
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {filteredChats.length === 0 ? (
            <div className="p-8 text-center text-brand-text-secondary">
              <svg className="w-8 h-8 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
              <p className="text-sm">Nenhuma conversa encontrada</p>
            </div>
          ) : (
            filteredChats.map(chat => (
              <ConversationItem key={chat.id} chat={chat} active={selectedChat?.id === chat.id}
                onClick={() => setSelectedChat(chat)} />
            ))
          )}
        </div>
      </div>

      {/* Chat Area */}
      {selectedChat ? (
        <div className="hidden md:flex flex-col w-2/3 bg-[url('https://i.pinimg.com/736x/8c/98/99/8c98994518b575bfd8c949e91d20548b.jpg')] bg-opacity-50">
          {/* Header */}
          <div className="p-4 border-b border-brand-border flex justify-between items-center bg-white/95 backdrop-blur-sm z-10">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center font-bold text-gray-700 overflow-hidden">
                {activeAvatar ? (
                  <img src={activeAvatar} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-sm">{activeDisplayName?.substring(0, 2).toUpperCase()}</span>
                )}
              </div>
              <div>
                <p className="font-bold text-brand-text-primary">{activeDisplayName}</p>
                <p className="text-[10px] text-brand-text-secondary">{activeSubtitle}</p>
              </div>
            </div>
            <div className="flex items-center space-x-4 text-brand-text-secondary">
              <svg className="w-5 h-5 cursor-pointer hover:text-brand-text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              <Icons.Phone className="w-5 h-5 cursor-pointer hover:text-brand-text-primary" />
              <Icons.MoreVertical className="w-5 h-5 cursor-pointer hover:text-brand-text-primary" />
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 p-4 overflow-y-auto space-y-4 relative bg-gray-100/30">
            {messages.length === 0 ? (
              <div className="flex justify-center items-center h-full">
                <div className="bg-white/80 backdrop-blur px-4 py-2 rounded-lg shadow-sm text-sm text-brand-text-secondary">
                  Selecione uma conversa para ver as mensagens.
                </div>
              </div>
            ) : (
              messages.map(msg => <ChatBubble key={msg.id} message={msg} isGroup={selectedChat.is_group} />)
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-3 bg-white/95 backdrop-blur-sm border-t border-brand-border">
            <div className="flex items-center bg-gray-100 rounded-2xl px-4 py-2">
              <Icons.Paperclip className="w-5 h-5 text-gray-400 cursor-pointer hover:text-gray-600 transition-colors" />
              <svg className="w-5 h-5 text-gray-400 cursor-pointer hover:text-gray-600 ml-4 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <input type="text" value={inputText} onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()} placeholder="Digite uma mensagem"
                className="flex-1 bg-transparent border-none focus:ring-0 text-brand-text-primary placeholder:text-gray-400 mx-4" />
              {inputText.trim() ? (
                <button onClick={handleSendMessage} className="p-2 bg-brand-yellow-dark hover:bg-brand-yellow text-brand-text-primary rounded-full transition-transform hover:scale-105">
                  <Icons.Send className="w-4 h-4" />
                </button>
              ) : (
                <button className="p-2 text-gray-400 hover:text-gray-600 transition-colors">
                  <Icons.Mic className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="hidden md:flex flex-col w-2/3 bg-gray-50 items-center justify-center p-12 text-center">
          <div className="w-32 h-32 bg-white rounded-full flex items-center justify-center shadow-sm mb-6">
            <svg className="w-16 h-16 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
          </div>
          <h3 className="text-2xl font-bold text-brand-text-primary mb-2">FLUOW AI Web</h3>
          <p className="text-brand-text-secondary max-w-sm">Selecione uma conversa para iniciar o atendimento.</p>
        </div>
      )}
    </div>
  );
};

export default Chat;