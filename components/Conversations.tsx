import React from 'react';
import { Icons } from './icons';
import Input from './ui/Input';
import Button from './ui/Button';

const ConversationItem = ({ name, time, message, active }: { name: string, time: string, message: string, active?: boolean }) => (
  <div className={`p-3 flex items-start space-x-3 rounded-lg cursor-pointer ${active ? 'bg-brand-green' : 'hover:bg-gray-100'}`}>
    <div className="w-10 h-10 bg-gray-200 rounded-full flex-shrink-0 flex items-center justify-center font-bold text-brand-text-primary">
        {name.substring(0, 1)}
    </div>
    <div className="flex-1 min-w-0">
      <div className="flex justify-between items-center">
        <p className={`text-sm font-semibold truncate ${active ? 'text-white' : 'text-brand-text-primary'}`}>{name}</p>
        <p className={`text-xs ${active ? 'text-gray-200' : 'text-brand-text-secondary'}`}>{time}</p>
      </div>
      <p className={`text-sm truncate ${active ? 'text-gray-200' : 'text-brand-text-secondary'}`}>{message}</p>
    </div>
  </div>
);

const ChatBubble = ({ text, time, sent }: { text: string, time: string, sent: boolean }) => (
    <div className={`flex ${sent ? 'justify-end' : 'justify-start'}`}>
        <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${sent ? 'bg-brand-green text-white rounded-br-none' : 'bg-gray-200 text-brand-text-primary rounded-bl-none'}`}>
            <p>{text}</p>
            <p className={`text-xs mt-1 ${sent ? 'text-gray-200' : 'text-brand-text-secondary'} text-right`}>{time}</p>
        </div>
    </div>
);


const Conversations: React.FC = () => {
  return (
    <div className="flex h-[calc(100vh-4rem)] bg-brand-surface rounded-lg overflow-hidden border border-brand-border">
      {/* Sidebar */}
      <div className="w-1/3 border-r border-brand-border flex flex-col">
        <div className="p-4 border-b border-brand-border">
          <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-brand-text-primary">Conversas</h2>
              <Icons.MoreVertical className="w-5 h-5 text-brand-text-secondary" />
          </div>
          <p className="text-sm text-brand-text-secondary">1 conversas ativas</p>
          <div className="mt-4">
            <Input type="text" placeholder="Buscar conversas..." className="w-full" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          <ConversationItem name="556282415478" time="00:39" message="Olá!" active />
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="w-2/3 flex flex-col">
        <div className="p-4 border-b border-brand-border flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center font-bold text-brand-text-primary">5</div>
            <div>
              <p className="font-semibold text-brand-text-primary">556282415478</p>
            </div>
          </div>
          <div className="flex items-center space-x-4 text-brand-text-secondary">
            <Icons.Phone className="w-5 h-5 cursor-pointer hover:text-brand-text-primary" />
            <Icons.Video className="w-5 h-5 cursor-pointer hover:text-brand-text-primary" />
          </div>
        </div>

        <div className="flex-1 p-6 overflow-y-auto space-y-4 bg-brand-bg">
            <ChatBubble text="Olá!" time="00:39" sent={true} />
            <ChatBubble text="Olá!" time="00:39" sent={false} />
        </div>

        <div className="p-4 bg-brand-surface border-t border-brand-border">
          <div className="flex items-center bg-gray-100 rounded-lg px-3 py-1">
            <Icons.Paperclip className="w-5 h-5 text-brand-text-secondary cursor-pointer hover:text-brand-text-primary" />
            <Icons.Mic className="w-5 h-5 text-brand-text-secondary cursor-pointer hover:text-brand-text-primary ml-3" />
            <input type="text" placeholder="Digite sua mensagem..." className="flex-1 bg-transparent border-none focus:ring-0 text-brand-text-primary placeholder:text-brand-text-secondary" />
            <Button variant="ghost" className="p-2">
              <Icons.Send className="w-5 h-5 text-brand-text-secondary" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Conversations;