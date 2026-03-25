import React, { useState } from 'react';
import Card from './ui/Card';
import Button from './ui/Button';
import { Icons } from './icons';
import ToggleSwitch from './ui/ToggleSwitch';
import Modal from './ui/Modal';

// --- TYPES ---
enum StepType {
  Trigger = 'trigger',
  Action = 'action',
  Delay = 'delay',
}

interface WorkflowStep {
  id: number;
  type: StepType;
  name: string;
  details: string;
  icon: keyof typeof Icons;
  config?: {
    templateId?: string;
    // other config properties can be added here
  };
}

interface Workflow {
  id: string;
  name: string;
  status: 'active' | 'inactive';
  steps: WorkflowStep[];
}

interface EmailTemplate {
    id: string;
    name: string;
    subject: string;
    body: string;
}

// --- MOCK DATA & CONFIG ---
const availableActions: {
    triggers: WorkflowStep[];
    actions: WorkflowStep[];
    delays: WorkflowStep[];
} = {
    triggers: [
        { id: 1, type: StepType.Trigger, name: 'Novo Lead Criado', details: 'Inicia quando um novo lead é adicionado.', icon: 'Plus' },
        { id: 2, type: StepType.Trigger, name: 'Etapa do Funil Alterada', details: 'Inicia quando um lead muda de etapa.', icon: 'Workflow' },
    ],
    actions: [
        { id: 3, type: StepType.Action, name: 'Enviar Email', details: 'Envia um email para o lead.', icon: 'Mail' },
        { id: 4, type: StepType.Action, name: 'Criar Tarefa', details: 'Cria uma tarefa para um usuário.', icon: 'Flag' },
    ],
    delays: [
        { id: 5, type: StepType.Delay, name: 'Aguardar um período', details: 'Pausa o fluxo por um tempo.', icon: 'Clock' },
    ]
};

const mockEmailTemplates: EmailTemplate[] = [
    { id: 'tmpl_welcome', name: 'Boas-vindas Inicial', subject: 'Bem-vindo(a) à Lumen!', body: '<h3>Olá {{lead.name}}!</h3><p>Estamos muito felizes em ter você conosco. Nossa equipe entrará em contato em breve.</p>' },
    { id: 'tmpl_followup', name: 'Follow-up Pós-Proposta', subject: 'Alguma novidade sobre a proposta?', body: '<h3>Olá {{lead.name}},</h3><p>Gostaria de saber se você teve a chance de revisar a proposta que enviamos. Ficamos à disposição para qualquer dúvida!</p>' },
    { id: 'tmpl_promo', name: 'Oferta Especial', subject: 'Uma oferta especial para você!', body: '<h3>Aproveite, {{lead.name}}!</h3><p>Temos uma condição especial para você fechar negócio ainda esta semana. Não perca!</p>' },
];


const mockWorkflows: Workflow[] = [
  {
    id: 'wf1',
    name: 'Nutrição de Leads - Boas-vindas',
    status: 'active',
    steps: [
      { ...availableActions.triggers[0], details: 'Gatilho: Novo Lead no funil "Vendas"'},
      { ...availableActions.delays[0], id: 101, name: 'Aguardar 1 hora', details: 'Pausa de 60 minutos' },
      { ...availableActions.actions[0], id: 102, name: 'Enviar Email de Boas-vindas', details: 'Template: "Boas-vindas Inicial"', config: { templateId: 'tmpl_welcome'} },
    ],
  },
  {
    id: 'wf2',
    name: 'Follow-up - Proposta Enviada',
    status: 'inactive',
    steps: [
       { ...availableActions.triggers[1], details: 'Gatilho: Lead movido para "Proposta Enviada"'},
       { ...availableActions.delays[0], id: 201, name: 'Aguardar 2 dias', details: 'Pausa de 48 horas' },
       { ...availableActions.actions[1], id: 202, name: 'Criar Tarefa de Acompanhamento', details: 'Atribuído ao proprietário do lead' },
    ]
  }
];

const newWorkflowTemplate: Workflow = {
    id: `wf${Date.now()}`,
    name: 'Novo Fluxo de Automação',
    status: 'inactive',
    steps: [
        { id: Date.now(), type: StepType.Trigger, name: 'Configurar Gatilho', details: 'Clique para escolher como o fluxo deve começar.', icon: 'Plus', config: {} }
    ]
};

// --- HELPERS ---
const isStepConfigured = (step: WorkflowStep): boolean => {
  if (step.type === StepType.Trigger) {
    // A simple check: if the name is the default placeholder, it's not configured.
    return step.name !== 'Configurar Gatilho';
  }
  if (step.name === 'Enviar Email') {
    // Must have a template selected.
    return !!step.config?.templateId;
  }
  // All other steps are considered configured by default in this mock.
  return true;
};

const getStepDetails = (step: WorkflowStep): string => {
    if (step.name === 'Enviar Email' && step.config?.templateId) {
        const templateName = mockEmailTemplates.find(t => t.id === step.config.templateId)?.name;
        return templateName ? `Template: "${templateName}"` : step.details;
    }
    return step.details;
}

// --- SUB-COMPONENTS ---

const EmailPreviewModal: React.FC<{ template: EmailTemplate | undefined; onClose: () => void; }> = ({ template, onClose }) => {
    if (!template) return null;

    const mockLead = { name: 'João Silva', email: 'joao.silva@example.com' };

    const formattedBody = template.body
        .replace(/{{lead.name}}/g, mockLead.name)
        .replace(/{{lead.email}}/g, mockLead.email);

    const formattedSubject = template.subject
        .replace(/{{lead.name}}/g, mockLead.name);

    return (
        <Modal isOpen={true} onClose={onClose} title={`Pré-visualização: ${template.name}`}>
            <div className="space-y-4">
                <div>
                    <h3 className="text-sm font-medium text-brand-text-secondary">Assunto</h3>
                    <p className="mt-1 p-2 bg-gray-50 rounded-md text-brand-text-primary">{formattedSubject}</p>
                </div>
                <div>
                    <h3 className="text-sm font-medium text-brand-text-secondary">Conteúdo do Email</h3>
                    <div className="mt-1 border border-brand-border rounded-md p-4">
                        <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: formattedBody }} />
                    </div>
                </div>
            </div>
            <div className="mt-6 flex justify-end">
                <Button variant="secondary" onClick={onClose}>Fechar</Button>
            </div>
        </Modal>
    );
};

const ActionPanel: React.FC<{onSelect: (step: Omit<WorkflowStep, 'id'>) => void; onClose: () => void;}> = ({ onSelect, onClose }) => {
    return (
        <div className="absolute top-0 right-0 h-full w-96 bg-brand-surface border-l border-brand-border shadow-2xl p-6 flex flex-col z-20">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-semibold text-brand-text-primary">Adicionar Etapa</h3>
                <Button variant="ghost" className="!p-2" onClick={onClose}><Icons.X className="w-5 h-5" /></Button>
            </div>
            <div className="flex-1 overflow-y-auto -mr-6 pr-6 space-y-6">
                <div>
                    <h4 className="text-brand-yellow font-semibold mb-3 text-sm">GATILHOS</h4>
                    <div className="space-y-2">
                        {availableActions.triggers.map(s => (
                            <div key={s.id} onClick={() => onSelect(s)} className="p-3 bg-gray-50 rounded-md hover:bg-gray-100 cursor-pointer flex items-start space-x-3">
                                <Icons.Plus className="w-5 h-5 text-brand-text-secondary mt-1" />
                                <div>
                                    <p className="font-semibold text-brand-text-primary">{s.name}</p>
                                    <p className="text-xs text-brand-text-secondary">{s.details}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                <div>
                    <h4 className="text-brand-yellow font-semibold mb-3 text-sm">AÇÕES</h4>
                     <div className="space-y-2">
                        {availableActions.actions.map(s => (
                            <div key={s.id} onClick={() => onSelect(s)} className="p-3 bg-gray-50 rounded-md hover:bg-gray-100 cursor-pointer flex items-start space-x-3">
                                <Icons.FileCog className="w-5 h-5 text-brand-text-secondary mt-1" />
                                <div>
                                    <p className="font-semibold text-brand-text-primary">{s.name}</p>
                                    <p className="text-xs text-brand-text-secondary">{s.details}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                 <div>
                    <h4 className="text-brand-yellow font-semibold mb-3 text-sm">CONTROLE</h4>
                     <div className="space-y-2">
                        {availableActions.delays.map(s => (
                            <div key={s.id} onClick={() => onSelect(s)} className="p-3 bg-gray-50 rounded-md hover:bg-gray-100 cursor-pointer flex items-start space-x-3">
                                <Icons.Clock className="w-5 h-5 text-brand-text-secondary mt-1" />
                                <div>
                                    <p className="font-semibold text-brand-text-primary">{s.name}</p>
                                    <p className="text-xs text-brand-text-secondary">{s.details}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

const StepNode: React.FC<{ step: WorkflowStep; onEdit: (id: number) => void; isConfigured: boolean; }> = ({ step, onEdit, isConfigured }) => {
  const Icon = Icons[step.icon] || Icons.FileCog;
  const cardBorderColor = isConfigured ? 'border-brand-yellow' : 'border-red-500';
  const iconColor = isConfigured ? 'text-brand-yellow' : 'text-red-500';

  return (
    <div className="w-full max-w-md mx-auto">
        <Card className={`!p-4 border-l-4 ${cardBorderColor} hover:shadow-lg transition-shadow duration-300 group`}>
            <div className="flex items-center space-x-4">
                <div className="bg-gray-100 p-3 rounded-full">
                    <Icon className={`w-6 h-6 ${iconColor}`} />
                </div>
                <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-brand-text-primary truncate">{step.name}</h4>
                    <p className={`text-xs ${isConfigured ? 'text-brand-text-secondary' : 'text-red-600 font-medium'}`}>
                        {isConfigured ? getStepDetails(step) : 'Configuração necessária'}
                    </p>
                </div>
                {!isConfigured && <Icons.AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />}
                <Button variant="ghost" className="!p-2 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => onEdit(step.id)}>
                    <Icons.Settings2 className="w-5 h-5" />
                </Button>
            </div>
        </Card>
    </div>
  );
};


const AddStepButton: React.FC<{ onClick: () => void }> = ({ onClick }) => (
    <div className="relative h-16 flex items-center justify-center">
        <div className="absolute top-0 left-1/2 w-px h-full bg-brand-border"></div>
        <Button variant="secondary" className="rounded-full !p-2 z-10 border-4 border-brand-bg hover:border-brand-yellow" onClick={onClick}>
            <Icons.Plus className="w-5 h-5" />
        </Button>
    </div>
);

const WorkflowBuilder: React.FC<{ workflow: Workflow; onBack: () => void }> = ({ workflow: initialWorkflow, onBack }) => {
    const [workflow, setWorkflow] = useState<Workflow>(initialWorkflow);
    const [isActionPanelOpen, setActionPanelOpen] = useState(false);
    const [editingStepId, setEditingStepId] = useState<number | null>(null);
    const [isPreviewingTemplate, setPreviewingTemplate] = useState<EmailTemplate | null>(null);


    const handleAddStep = (stepTemplate: Omit<WorkflowStep, 'id'>) => {
        const newStep = { ...stepTemplate, id: Date.now(), config: {} };
        
        let updatedSteps = [...workflow.steps];
        // If the first step is the placeholder trigger, replace it.
        if (workflow.steps.length === 1 && workflow.steps[0].name === 'Configurar Gatilho') {
          updatedSteps = [newStep];
        } else {
          updatedSteps.push(newStep);
        }

        setWorkflow({ ...workflow, steps: updatedSteps });
        setActionPanelOpen(false);
    }
    
    const handleUpdateStepConfig = (stepId: number, newConfig: any) => {
        setWorkflow(prev => ({
            ...prev,
            steps: prev.steps.map(step => 
                step.id === stepId ? { ...step, config: { ...step.config, ...newConfig } } : step
            )
        }));
    };

    const isWorkflowValid = workflow.steps.every(isStepConfigured);
    const editingStep = workflow.steps.find(s => s.id === editingStepId);

    return (
        <div className="h-full flex flex-col relative overflow-hidden bg-brand-surface">
             <div className="p-6 border-b border-brand-border flex-shrink-0">
                <div className="flex justify-between items-center">
                    <div className="flex items-center space-x-3">
                        <Button variant="ghost" className="!p-2" onClick={onBack}>
                            <Icons.ArrowLeft className="w-5 h-5" />
                        </Button>
                        <input
                            value={workflow.name} 
                            onChange={(e) => setWorkflow({...workflow, name: e.target.value})}
                            className="text-2xl font-bold bg-transparent border-0 p-0 focus:ring-0 text-brand-text-primary"
                        />
                    </div>
                    <div className="flex items-center space-x-4">
                         <ToggleSwitch initialChecked={workflow.status === 'active'} onChange={(checked) => setWorkflow({...workflow, status: checked ? 'active' : 'inactive'})} />
                        <Button variant="secondary" onClick={onBack}>Cancelar</Button>
                        <div title={!isWorkflowValid ? "Complete a configuração de todas as etapas para salvar" : ""}>
                            <Button variant="primary" disabled={!isWorkflowValid}>Salvar Fluxo</Button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
                <div className="flex-1 overflow-y-auto p-8 lg:p-16 bg-brand-bg">
                    <div className="space-y-0">
                        {workflow.steps.map((step, index) => (
                           <React.Fragment key={step.id}>
                                {index > 0 && <AddStepButton onClick={() => setActionPanelOpen(true)} />}
                                <StepNode 
                                    step={step} 
                                    onEdit={setEditingStepId}
                                    isConfigured={isStepConfigured(step)}
                                />
                           </React.Fragment>
                        ))}
                         {workflow.steps.length > 0 && <AddStepButton onClick={() => setActionPanelOpen(true)} />}
                    </div>
                </div>

                {/* Configuration Panel */}
                {editingStep && (
                     <div className="w-96 bg-brand-surface border-l border-brand-border shadow-2xl p-6 flex flex-col z-10">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-semibold text-brand-text-primary">Configurar Etapa</h3>
                            <Button variant="ghost" className="!p-2" onClick={() => setEditingStepId(null)}><Icons.X className="w-5 h-5" /></Button>
                        </div>
                        <div className="flex-1 overflow-y-auto pr-2 -mr-6">
                            <h4 className="font-bold text-brand-text-primary mb-4">{editingStep.name}</h4>
                            
                            {editingStep.name === 'Enviar Email' && (
                                <div className="space-y-4">
                                    <div>
                                        <label htmlFor="email-template" className="block text-sm font-medium text-brand-text-secondary mb-1">
                                            Template de Email
                                        </label>
                                        <select
                                            id="email-template"
                                            className="bg-gray-50 border border-brand-border text-brand-text-primary text-sm rounded-md focus:ring-brand-yellow focus:border-brand-yellow block w-full p-2.5"
                                            value={editingStep.config?.templateId || ''}
                                            onChange={(e) => handleUpdateStepConfig(editingStep.id, { templateId: e.target.value })}
                                        >
                                            <option value="">Selecione um template</option>
                                            {mockEmailTemplates.map(template => (
                                                <option key={template.id} value={template.id}>{template.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    
                                    {editingStep.config?.templateId && (
                                        <Button 
                                            variant="secondary" 
                                            className="w-full"
                                            onClick={() => {
                                                const template = mockEmailTemplates.find(t => t.id === editingStep.config?.templateId);
                                                if (template) setPreviewingTemplate(template);
                                            }}
                                        >
                                            <Icons.Eye className="w-4 h-4 mr-2" />
                                            Pré-visualizar Email
                                        </Button>
                                    )}
                                </div>
                            )}
                            
                            {editingStep.type === StepType.Trigger && (
                                <p className="text-brand-text-secondary">Opções de configuração do gatilho em breve.</p>
                            )}
                            
                            {editingStep.type !== StepType.Trigger && editingStep.name !== 'Enviar Email' && (
                                <p className="text-brand-text-secondary">Mais opções de configuração em breve.</p>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {isActionPanelOpen && <ActionPanel onSelect={handleAddStep} onClose={() => setActionPanelOpen(false)} />}
            {isPreviewingTemplate && <EmailPreviewModal template={isPreviewingTemplate} onClose={() => setPreviewingTemplate(null)} />}
        </div>
    );
};

const WorkflowCard: React.FC<{workflow: Workflow, onSelect: () => void}> = ({ workflow, onSelect }) => (
    <Card className="flex flex-col justify-between hover:border-brand-yellow border-brand-border border transition-colors duration-300">
        <div>
            <div className="flex justify-between items-start">
                <h3 className="font-bold text-brand-text-primary text-lg mb-2">{workflow.name}</h3>
                <span className={`px-2 py-0.5 text-xs rounded-full ${workflow.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-brand-text-primary'}`}>
                    {workflow.status === 'active' ? 'Ativo' : 'Inativo'}
                </span>
            </div>
            <p className="text-sm text-brand-text-secondary mb-4">{workflow.steps.length} {workflow.steps.length === 1 ? 'etapa' : 'etapas'}</p>
            <div className="flex items-center space-x-2">
                {workflow.steps.slice(0, 5).map((step, index) => {
                    const Icon = Icons[step.icon] || Icons.FileCog;
                    return (
                    <React.Fragment key={step.id}>
                        <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center" title={step.name}>
                            <Icon className="w-4 h-4 text-brand-text-secondary" />
                        </div>
                        {index < workflow.steps.length - 1 && index < 4 && <div className="w-4 h-px bg-brand-border"></div>}
                    </React.Fragment>
                )})}
                 {workflow.steps.length > 5 && <span className="text-brand-text-secondary font-bold">...</span>}
            </div>
        </div>
        <div className="mt-6 flex justify-end space-x-2">
            <Button variant="ghost" className="!text-red-500 hover:!bg-red-500/10"><Icons.Trash2 className="w-4 h-4" /></Button>
            <Button variant="secondary" onClick={onSelect}>Editar Fluxo</Button>
        </div>
    </Card>
);

const SalesAutomationList: React.FC<{ onSelectWorkflow: (wf: Workflow) => void; }> = ({ onSelectWorkflow }) => {
    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-brand-text-primary">Automação</h1>
                 <Button variant="primary" onClick={() => onSelectWorkflow(newWorkflowTemplate)}>
                    <Icons.Plus className="w-4 h-4 mr-2" />
                    Criar Novo Fluxo
                </Button>
            </div>
            <p className="text-brand-text-secondary max-w-2xl">
                Crie fluxos de trabalho personalizáveis para nutrição de leads, lembretes de acompanhamento e gatilhos baseados em interações do cliente.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {mockWorkflows.map(wf => (
                    <WorkflowCard key={wf.id} workflow={wf} onSelect={() => onSelectWorkflow(wf)} />
                ))}
            </div>
        </div>
    );
};

// --- MAIN COMPONENT ---
const SalesAutomation: React.FC = () => {
    const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null);

    if (selectedWorkflow) {
        return <div className="h-[calc(100vh-4rem)] -m-4 sm:-m-6 lg:-m-8"><WorkflowBuilder workflow={selectedWorkflow} onBack={() => setSelectedWorkflow(null)} /></div>;
    }

    return <SalesAutomationList onSelectWorkflow={setSelectedWorkflow} />;
};

export default SalesAutomation;