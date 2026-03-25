import { supabase } from '../src/lib/supabase';

export const usageService = {
  async getUsage(organizationId: string) {
    const month = new Date().toISOString().slice(0, 7); // YYYY-MM
    const { data, error } = await supabase
      .from('usage_tracking')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('month', month)
      .single();

    if (error && error.code === 'PGRST116') {
      // No usage record for this month yet, create one
      const { data: newUsage, error: createError } = await supabase
        .from('usage_tracking')
        .insert([{ organization_id: organizationId, month, leads_count: 0, scrapes_count: 0 }])
        .select()
        .single();
      
      if (createError) throw createError;
      return newUsage;
    }

    if (error) throw error;
    return data;
  },

  async incrementLeads(organizationId: string, count: number = 1) {
    const month = new Date().toISOString().slice(0, 7);
    const { error } = await supabase.rpc('increment_usage_leads', {
      org_id: organizationId,
      usage_month: month,
      inc_val: count
    });
    
    if (error) {
      // Fallback if RPC doesn't exist yet
      const usage = await this.getUsage(organizationId);
      await supabase
        .from('usage_tracking')
        .update({ leads_count: (usage.leads_count || 0) + count })
        .eq('id', usage.id);
    }
  },

  async incrementScrapes(organizationId: string, count: number = 1) {
    const month = new Date().toISOString().slice(0, 7);
    const { error } = await supabase.rpc('increment_usage_scrapes', {
      org_id: organizationId,
      usage_month: month,
      inc_val: count
    });

    if (error) {
      // Fallback if RPC doesn't exist yet
      const usage = await this.getUsage(organizationId);
      await supabase
        .from('usage_tracking')
        .update({ scrapes_count: (usage.scrapes_count || 0) + count })
        .eq('id', usage.id);
    }
  },

  async checkLimits(organizationId: string) {
    const usage = await this.getUsage(organizationId);
    
    // Get organization plan
    const { data: org } = await supabase
      .from('organizations')
      .select('plan_id, plans(*)')
      .eq('id', organizationId)
      .single();

    const plan = (org as any)?.plans;
    if (!plan) return { canLead: true, canScrape: true, usage, plan: null };

    return {
      canLead: usage.leads_count < plan.leads_limit,
      canScrape: usage.scrapes_count < plan.scrapes_limit,
      usage,
      plan
    };
  }
};
