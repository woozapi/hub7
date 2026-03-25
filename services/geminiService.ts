import { GoogleGenAI, Modality, Type } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY || '';

export interface Lead {
  id: string;
  name: string;
  address: string;
  phone?: string;
  website?: string;
  rating?: number;
  reviewsCount?: number;
  category?: string;
  details?: string;
  email?: string;
  linkedin?: string;
  cnpj?: string;
  cnpjLocation?: string;
  isLocationMatch?: boolean;
  isAdvertising?: boolean;
  adsDetails?: string;
  source: 'google_maps' | 'google_search';
}

export const prospectLeadsFromMaps = async (query: string, location: string, customApiKey?: string): Promise<Lead[]> => {
  const finalApiKey = customApiKey || apiKey;
  const ai = new GoogleGenAI({ apiKey: finalApiKey });
  
  const prompt = `Encontre leads de negócios para "${query}" em "${location}". 
  Extraia o nome, endereço, telefone, website (se disponível), avaliação, quantidade de avaliações e categoria de cada local.
  Retorne os dados estritamente no formato de um array JSON, sem blocos de código markdown ou texto adicional.
  Exemplo: [{"name": "Empresa A", "address": "Rua X", "phone": "123", "website": "www.a.com", "rating": 4.5, "reviewsCount": 100, "category": "Academia"}]`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        tools: [{ googleMaps: {} }],
        // responseMimeType: "application/json" is NOT supported with googleMaps
      },
    });

    const text = response.text || '[]';
    // Clean up potential markdown blocks
    const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const leadsData = JSON.parse(jsonStr);
    
    return Array.isArray(leadsData) ? leadsData.map((l: any, index: number) => ({
      ...l,
      id: `maps-${index}-${Date.now()}`,
      source: 'google_maps'
    })) : [];
  } catch (error) {
    console.error("Error prospecting from Maps:", error);
    return [];
  }
};

export const enrichLeadWithSearch = async (lead: Lead, customApiKey?: string): Promise<Lead> => {
  const finalApiKey = customApiKey || apiKey;
  const ai = new GoogleGenAI({ apiKey: finalApiKey });
  
  const prompt = `Pesquise informações detalhadas sobre a empresa/profissional "${lead.name}" localizada em "${lead.address}".
  
  TAREFAS ESPECÍFICAS:
  1. Tente encontrar o CNPJ oficial da empresa.
  2. Verifique se a localização registrada no CNPJ (Cidade/Estado) coincide com o endereço fornecido: "${lead.address}".
  3. Encontre o LinkedIn da empresa, e-mail de contato e website oficial.
  4. Verifique se a empresa está anunciando no Google (pesquise no Google Ads Transparency Center ou por anúncios ativos).
  5. Resuma as descobertas no campo "details".
  
  Se os dados de localização do CNPJ baterem com o endereço fornecido, defina "isLocationMatch" como true.
  Se encontrar evidências de anúncios ativos no Google, defina "isAdvertising" como true.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            details: { type: Type.STRING, description: "Resumo das informações encontradas" },
            email: { type: Type.STRING },
            linkedin: { type: Type.STRING },
            website: { type: Type.STRING },
            cnpj: { type: Type.STRING, description: "Número do CNPJ encontrado" },
            cnpjLocation: { type: Type.STRING, description: "Localização (Cidade/Estado) registrada no CNPJ" },
            isLocationMatch: { type: Type.BOOLEAN, description: "Se a localização do CNPJ bate com o endereço do lead" },
            isAdvertising: { type: Type.BOOLEAN, description: "Se a empresa está anunciando no Google" },
            adsDetails: { type: Type.STRING, description: "Detalhes sobre os anúncios encontrados" },
          }
        }
      },
    });

    const enrichment = JSON.parse(response.text || '{}');
    return {
      ...lead,
      details: enrichment.details || lead.details,
      website: enrichment.website || lead.website,
      email: enrichment.email || lead.email,
      linkedin: enrichment.linkedin || lead.linkedin,
      cnpj: enrichment.cnpj || lead.cnpj,
      cnpjLocation: enrichment.cnpjLocation || lead.cnpjLocation,
      isLocationMatch: enrichment.isLocationMatch ?? lead.isLocationMatch,
      isAdvertising: enrichment.isAdvertising ?? lead.isAdvertising,
      adsDetails: enrichment.adsDetails || lead.adsDetails,
    };
  } catch (error) {
    console.error("Error enriching lead:", error);
    return lead;
  }
};
