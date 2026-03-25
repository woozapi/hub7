import React, { useState } from 'react';
import Card from './ui/Card';
import Button from './ui/Button';
import Input from './ui/Input';
import { Icons } from './icons';
import { Lead, prospectLeadsFromMaps, enrichLeadWithSearch } from '../services/geminiService';
import { usageService } from '../services/usageService';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../src/lib/AuthContext';

const Prospecting: React.FC = () => {
  const { organization } = useAuth();
  const [query, setQuery] = useState('');
  const [location, setLocation] = useState('');
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(false);
  const [enrichingId, setEnrichingId] = useState<string | null>(null);
  const [limitError, setLimitError] = useState<string | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query || !location || !organization) return;

    setLoading(true);
    setLimitError(null);
    try {
      const { canScrape, plan, usage } = await usageService.checkLimits(organization.id);
      
      if (!canScrape) {
        setLimitError(`Limite de buscas atingido (${usage.scrapes_count}/${plan.scrapes_limit}). Faça upgrade do seu plano.`);
        setLoading(false);
        return;
      }

      const results = await prospectLeadsFromMaps(query, location, organization.google_api_key);
      setLeads(results);
      
      // Increment usage
      await usageService.incrementScrapes(organization.id);
    } catch (error) {
      console.error("Search failed:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleEnrich = async (lead: Lead) => {
    setEnrichingId(lead.id);
    try {
      const enrichedLead = await enrichLeadWithSearch(lead, organization?.google_api_key);
      setLeads(prev => prev.map(l => l.id === lead.id ? enrichedLead : l));
    } catch (error) {
      console.error("Enrichment failed:", error);
    } finally {
      setEnrichingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-3">
        <div className="w-10 h-10 rounded-full bg-brand-yellow/20 flex items-center justify-center">
          <Icons.Prospecting className="w-6 h-6 text-brand-yellow-dark" />
        </div>
        <h1 className="text-3xl font-bold text-brand-text-primary">Prospectar Leads</h1>
      </div>

      <Card className="p-6">
        <form onSubmit={handleSearch} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div className="space-y-2">
            <label className="text-sm font-medium text-brand-text-secondary">O que você procura?</label>
            <Input 
              placeholder="Ex: Academias, Restaurantes, Clínicas..." 
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-brand-text-secondary">Onde?</label>
            <Input 
              placeholder="Ex: São Paulo, SP" 
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={loading} className="h-[42px]">
            {loading ? (
              <Icons.Refresh className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Icons.Prospecting className="w-4 h-4 mr-2" />
            )}
            {loading ? 'Buscando...' : 'Buscar Leads'}
          </Button>
        </form>
        {limitError && (
          <div className="mt-4 p-3 bg-red-50 border border-red-100 rounded-lg text-red-600 text-sm flex items-center">
            <Icons.AlertTriangle className="w-4 h-4 mr-2" />
            {limitError}
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-4">
        <AnimatePresence mode="popLayout">
          {leads.length > 0 ? (
            leads.map((lead) => (
              <motion.div
                key={lead.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                layout
              >
                <Card className="p-4 hover:shadow-md transition-shadow border-l-4 border-brand-yellow">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center space-x-2">
                        <h3 className="font-bold text-lg text-brand-text-primary">{lead.name}</h3>
                        <span className="px-2 py-0.5 bg-brand-yellow/10 text-brand-yellow-dark text-[10px] font-bold rounded-full uppercase tracking-wider">
                          {lead.category || 'Negócio'}
                        </span>
                      </div>
                      <p className="text-sm text-brand-text-secondary flex items-center">
                        <Icons.Info className="w-3 h-3 mr-1" /> {lead.address}
                      </p>
                      <div className="flex flex-wrap items-center gap-4 text-xs text-brand-text-secondary mt-2">
                        {lead.phone && (
                          <span className="flex items-center">
                            <Icons.Phone className="w-3 h-3 mr-1" /> {lead.phone}
                          </span>
                        )}
                        {lead.email && (
                          <span className="flex items-center text-blue-600">
                            <Icons.Info className="w-3 h-3 mr-1" /> {lead.email}
                          </span>
                        )}
                        {lead.rating && (
                          <span className="flex items-center text-brand-yellow-dark font-medium">
                            ★ {lead.rating} ({lead.reviewsCount || 0})
                          </span>
                        )}
                        {lead.website && (
                          <a 
                            href={lead.website.startsWith('http') ? lead.website : `https://${lead.website}`} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex items-center text-blue-500 hover:underline"
                          >
                            <Icons.Plug className="w-3 h-3 mr-1" /> Website
                          </a>
                        )}
                        {lead.linkedin && (
                          <a 
                            href={lead.linkedin.startsWith('http') ? lead.linkedin : `https://${lead.linkedin}`} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex items-center text-blue-700 hover:underline"
                          >
                            <Icons.AIAgent className="w-3 h-3 mr-1" /> LinkedIn
                          </a>
                        )}
                      </div>
                      
                      {lead.cnpj && (
                        <div className="mt-2 flex items-center space-x-3">
                          <div className="px-2 py-1 bg-gray-100 rounded text-[11px] font-mono text-gray-700 border border-gray-200">
                            <span className="font-bold mr-1">CNPJ:</span> {lead.cnpj}
                          </div>
                          {lead.isLocationMatch !== undefined && (
                            <div className={`flex items-center text-[11px] font-medium ${lead.isLocationMatch ? 'text-green-600' : 'text-red-500'}`}>
                              {lead.isLocationMatch ? (
                                <><Icons.Success className="w-3 h-3 mr-1" /> Localização Confirmada</>
                              ) : (
                                <><Icons.Info className="w-3 h-3 mr-1" /> Divergência de Localização ({lead.cnpjLocation})</>
                              )}
                            </div>
                          )}
                          {lead.isAdvertising && (
                            <div className="flex items-center text-[11px] font-medium text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-100">
                              <Icons.AIAgent className="w-3 h-3 mr-1" /> Anunciando no Google
                            </div>
                          )}
                        </div>
                      )}

                      {lead.details && (
                        <div className="mt-3 p-3 bg-gray-50 rounded border border-brand-border text-sm italic text-brand-text-secondary">
                          {lead.details}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button 
                        variant="secondary" 
                        size="sm" 
                        onClick={() => handleEnrich(lead)}
                        disabled={enrichingId === lead.id}
                      >
                        {enrichingId === lead.id ? (
                          <Icons.Refresh className="w-4 h-4 animate-spin mr-2" />
                        ) : (
                          <Icons.AIAgent className="w-4 h-4 mr-2" />
                        )}
                        {enrichingId === lead.id ? 'Enriquecendo...' : 'Enriquecer com IA'}
                      </Button>
                      <Button variant="success" size="sm">
                        <Icons.Plus className="w-4 h-4 mr-2" />
                        Salvar no CRM
                      </Button>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))
          ) : !loading && (
            <div className="text-center py-12 bg-white rounded-xl border border-dashed border-brand-border">
              <Icons.Prospecting className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-brand-text-secondary">Nenhum lead encontrado ainda.</p>
              <p className="text-sm text-gray-400">Use a busca acima para encontrar potenciais clientes no Google Maps.</p>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default Prospecting;
