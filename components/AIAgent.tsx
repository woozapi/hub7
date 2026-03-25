import React, { useState } from 'react';
import Card from './ui/Card';
import ToggleSwitch from './ui/ToggleSwitch';
import Button from './ui/Button';
import Input from './ui/Input';
import { Icons } from './icons';

type AIAgentTab = 'Configurações do Agente' | 'Follow-up' | 'Movimentação automática' | 'Gestão de Sessões' | 'Teste do Agente';

const AgentTestChat = () => (
    <Card className="flex-1 flex flex-col h-full">
        <div className="flex items-center space-x-3 mb-4">
            <div className="relative">
                <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
                    <Icons.AIAgent className="w-6 h-6 text-brand-green" />
                </div>
                <span className="absolute bottom-0 right-0 block h-3 w-3 rounded-full bg-green-500 ring-2 ring-brand-surface"></span>
            </div>
            <div>
                <h3 className="font-semibold text-brand-text-primary">Agente de IA</h3>
                <p className="text-sm text-green-500">Online</p>
            </div>
        </div>
        <div className="flex-1 flex items-center justify-center text-center bg-brand-bg rounded-md border border-brand-border">
            <div>
                <p className="text-brand-text-secondary">Nenhuma mensagem ainda.</p>
                <p className="text-sm text-brand-text-secondary">Comece a conversar com o agente!</p>
            </div>
        </div>
        <div className="mt-4 flex items-center bg-gray-100 rounded-full p-2">
            <input type="text" placeholder="Digite uma mensagem..." className="flex-1 bg-transparent px-3 text-brand-text-primary focus:outline-none" />
            <Icons.Paperclip className="w-5 h-5 text-brand-text-secondary cursor-pointer hover:text-brand-text-primary mx-2" />
            <Icons.Mic className="w-5 h-5 text-brand-text-secondary cursor-pointer hover:text-brand-text-primary" />
        </div>
    </Card>
);

const FollowUpSettings = () => (
    <div className="space-y-6">
        <Card>
            <h3 className="text-lg font-semibold text-brand-text-primary mb-2">Instruções para o prompt de Follow-up</h3>
            <p className="text-sm text-brand-text-secondary">Ex: Crie um follow-up amigável mas persistente, com foco em agendar uma reunião. Deve incluir perguntas sobre o interesse do cliente e oferecer um desconto especial no primeiro contato.</p>
            <div className="mt-4 p-4 bg-yellow-50 rounded-md border border-yellow-200">
                <p className="text-sm text-yellow-800"><span className="font-bold text-yellow-900">Importante:</span> Gerar um prompt de follow-up com IA consome <span className="font-bold">15 créditos</span> do seu Agente. Certifique-se de já ter configurado o restante do seu agente antes de gerar o prompt de follow-up.</p>
            </div>
            <div className="mt-4 text-right">
                <Button variant="primary">Gerar com IA</Button>
            </div>
        </Card>
        <Card>
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-brand-text-primary">Configurações de Follow-up</h3>
                <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium text-brand-text-primary">Ativado</span>
                    <ToggleSwitch initialChecked />
                </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="text-sm font-medium text-brand-text-secondary">Quantidade de follow-ups</label>
                    <Input type="number" defaultValue={2} className="mt-1" />
                </div>
                <div>
                    <label className="text-sm font-medium text-brand-text-secondary">Tempo entre Mensagens</label>
                    <select className="mt-1 bg-gray-50 border border-brand-border text-brand-text-primary text-sm rounded-md focus:ring-brand-yellow focus:border-brand-yellow block w-full p-2.5">
                        <option>1 hora</option>
                        <option>6 horas</option>
                        <option>12 horas</option>
                        <option>24 horas</option>
                    </select>
                </div>
            </div>
        </Card>
    </div>
);


const AIAgent: React.FC = () => {
    const [activeTab, setActiveTab] = useState<AIAgentTab>('Teste do Agente');
    const tabs: AIAgentTab[] = ['Configurações do Agente', 'Follow-up', 'Movimentação automática', 'Gestão de Sessões', 'Teste do Agente'];

    const renderContent = () => {
        switch (activeTab) {
            case 'Teste do Agente':
                return (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[calc(100vh-15rem)]">
                        <Card>
                            <h3 className="text-lg font-semibold text-brand-text-primary">Teste do Agente</h3>
                            <div className="mt-4 p-4 bg-gray-50 rounded-md space-y-2 text-sm text-brand-text-secondary border border-brand-border">
                                <p className="font-bold text-brand-text-primary">Instruções:</p>
                                <ul className="list-disc list-inside space-y-1">
                                    <li>Digite uma mensagem e pressione Enter ou clique no botão de enviar.</li>
                                    <li>Use o ícone de imagem para enviar uma imagem.</li>
                                    <li>Use o botão de microfone para gravar e enviar um áudio.</li>
                                    <li>Clique em "Resetar Conversa" para limpar o histórico.</li>
                                </ul>
                            </div>
                        </Card>
                        <AgentTestChat />
                    </div>
                );
            case 'Follow-up':
                return <FollowUpSettings />;
            default:
                return <Card><p className="text-center">{activeTab} content goes here.</p></Card>;
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                        <Icons.AIAgent className="w-6 h-6 text-brand-green" />
                    </div>
                    <h1 className="text-3xl font-bold text-brand-text-primary">Agente de IA</h1>
                </div>
                <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium text-brand-text-primary">Ativado</span>
                    <ToggleSwitch initialChecked />
                </div>
            </div>

            <div className="flex space-x-1 border-b border-brand-border">
                {tabs.map(tab => (
                    <button 
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`py-2 px-4 text-sm font-medium rounded-t-md ${
                            activeTab === tab 
                                ? 'bg-brand-surface border-brand-border border-b-0 -mb-px border-l border-r border-t text-brand-text-primary' 
                                : 'text-brand-text-secondary hover:bg-gray-100 hover:text-brand-text-primary'
                        }`}
                    >
                        {tab}
                    </button>
                ))}
            </div>

            <div className="mt-6">{renderContent()}</div>
        </div>
    );
};

export default AIAgent;