import React, { useState } from 'react';
import { supabase } from '../src/lib/supabase';
import { Icons } from './icons';

export const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSignUp, setIsSignUp] = useState(false);

  const [success, setSuccess] = useState<string | null>(null);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        setSuccess('Verifique seu e-mail para o link de confirmação!');
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-bg p-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow-xl border border-brand-border p-8">
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 bg-brand-yellow-dark rounded-lg flex items-center justify-center mb-4">
            <div className="w-6 h-6 bg-gray-800 rounded-sm transform rotate-45" />
          </div>
          <h1 className="text-2xl font-bold text-brand-text-primary">FLUOW AI</h1>
          <p className="text-brand-text-secondary text-sm mt-1">
            {isSignUp ? 'Crie sua conta agora' : 'Entre na sua conta'}
          </p>
        </div>

        <form onSubmit={handleAuth} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-brand-text-primary mb-1">E-mail</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-brand-border focus:ring-2 focus:ring-brand-yellow-dark outline-none transition-all"
              placeholder="seu@email.com"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-brand-text-primary mb-1">Senha</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-brand-border focus:ring-2 focus:ring-brand-yellow-dark outline-none transition-all"
              placeholder="••••••••"
              required
            />
          </div>

          {success && (
            <div className="p-3 bg-green-50 border border-green-100 rounded-lg text-green-600 text-sm flex items-center">
              <Icons.Success className="w-4 h-4 mr-2" />
              {success}
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-red-600 text-sm flex items-center">
              <Icons.AlertTriangle className="w-4 h-4 mr-2" />
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-yellow-dark text-gray-900 font-bold py-3 rounded-lg hover:bg-opacity-90 transition-all disabled:opacity-50"
          >
            {loading ? 'Processando...' : isSignUp ? 'Criar Conta' : 'Entrar'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-sm text-brand-yellow-dark hover:underline font-medium"
          >
            {isSignUp ? 'Já tem uma conta? Entre aqui' : 'Não tem uma conta? Cadastre-se'}
          </button>
        </div>
      </div>
    </div>
  );
};
