
import React, { useState } from 'react';
import { Truck, Lock, User, ArrowRight } from 'lucide-react';

interface LoginPageProps {
  onLogin: () => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (username === 'deny' && password === '@Cap150957') {
      onLogin();
    } else {
      setError('Credenciais inválidas. Tente novamente.');
    }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4 overflow-hidden">
      
      {/* BACKGROUND IMAGE LAYER */}
      <div className="absolute inset-0 z-0">
         {/* Imagem de Caminhão Tanque Branco de Alta Qualidade */}
         <img 
            src="https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?q=80&w=2070&auto=format&fit=crop" 
            alt="Fundo Risel - Caminhão Tanque" 
            className="w-full h-full object-cover"
         />
         {/* Dark Overlay com as cores da marca para garantir leitura */}
         <div className="absolute inset-0 bg-gradient-to-br from-[#022c22]/90 via-[#0f172a]/85 to-black/90 backdrop-blur-[1px]"></div>
      </div>

      <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-8 rounded-3xl shadow-2xl w-full max-w-md relative overflow-hidden animate-in fade-in zoom-in-95 duration-500 z-10">
        
        {/* Glow Effects */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-40 h-1 bg-gradient-to-r from-transparent via-risel-green to-transparent opacity-50"></div>
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-risel-green/10 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-risel-orange/10 rounded-full blur-3xl"></div>

        <div className="relative z-10 text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-risel-green/20 to-emerald-900/20 border border-risel-green/30 mb-4 shadow-[0_0_20px_rgba(0,214,100,0.2)]">
                <Truck size={32} className="text-risel-green" />
            </div>
            <h1 className="text-3xl font-black text-white tracking-tight mb-1">GF Risel</h1>
            <p className="text-slate-400 text-sm font-medium">Sistema de Gestão de Frotas</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4 relative z-10">
            <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Usuário</label>
                <div className="relative group">
                    <User size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-risel-green transition-colors"/>
                    <input 
                        type="text" 
                        value={username}
                        onChange={(e) => { setUsername(e.target.value); setError(''); }}
                        className="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl py-3 pl-10 pr-4 text-white placeholder-slate-600 outline-none focus:border-risel-green focus:ring-1 focus:ring-risel-green transition-all font-bold text-sm"
                        placeholder="Nome de usuário"
                    />
                </div>
            </div>

            <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Senha</label>
                <div className="relative group">
                    <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-risel-orange transition-colors"/>
                    <input 
                        type="password" 
                        value={password}
                        onChange={(e) => { setPassword(e.target.value); setError(''); }}
                        className="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl py-3 pl-10 pr-4 text-white placeholder-slate-600 outline-none focus:border-risel-orange focus:ring-1 focus:ring-risel-orange transition-all font-bold text-sm"
                        placeholder="••••••••"
                    />
                </div>
            </div>

            {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-xs font-bold text-center">
                    {error}
                </div>
            )}

            <button 
                type="submit" 
                className="w-full bg-gradient-to-r from-risel-green to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-black py-3.5 rounded-xl font-black uppercase tracking-wide shadow-lg hover:shadow-[0_0_20px_rgba(0,214,100,0.4)] transition-all active:scale-95 flex items-center justify-center gap-2 mt-4"
            >
                Entrar <ArrowRight size={18} />
            </button>
        </form>

        <p className="text-center text-slate-600 text-[10px] mt-8 font-medium">
            &copy; {new Date().getFullYear()} Risel Logística. Todos os direitos reservados.
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
