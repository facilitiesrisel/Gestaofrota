import React, { useState } from 'react';
import { useAuth } from '../../context/ReservationAuthContext';
import * as firebaseApi from '../../services/firebaseService';
import { firebaseConfig } from '../../firebaseConfig';
import { EyeIcon, EyeSlashIcon } from './icons';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { signIn } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [isResetView, setIsResetView] = useState(false);
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');

  const clearMessages = () => {
    setError(null);
    setMessage(null);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();
    setIsLoading(true);
    try {
      await signIn(email, password);
    } catch (err: any) {
      if (err.code === 'auth/operation-not-allowed') {
        setError('O login com e-mail/senha não está ativado no Firebase. Vá no Console do Firebase (Authentication > Sign-in method), ative o provedor "E-mail/Senha" e salve as alterações.');
      } else if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
        setError('E-mail ou senha inválidos. Verifique os dados e tente novamente. Caso seja a sua primeira vez de acesso no novo sistema unificado (celular/computador), utilize a aba "Criar Conta" para registrar-se.');
      } else if (err.code === 'auth/too-many-requests') {
        setError('Acesso temporariamente bloqueado por excesso de tentativas. Redefina sua senha ou tente novamente mais tarde.');
      } else {
        setError(`Erro ao logar (${err.code || 'desconhecido'}): ${err.message || 'Tente novamente.'}`);
        console.error("Erro de autenticação:", err.code, err.message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();
    
    if (registerPassword !== confirmPassword) {
      setError("As senhas não coincidem.");
      return;
    }
    
    if (registerPassword.length < 6) {
      setError("A senha deve conter pelo menos 6 caracteres.");
      return;
    }

    setIsLoading(true);
    try {
      await firebaseApi.auth.createUserWithEmailAndPassword(registerEmail, registerPassword);
      setMessage("Conta criada com sucesso! Você já está conectado de forma compartilhada.");
      setRegisterEmail('');
      setRegisterPassword('');
      setConfirmPassword('');
      setActiveTab('login');
    } catch (err: any) {
      if (err.code === 'auth/operation-not-allowed') {
        setError('O cadastro com e-mail/senha não está ativo no Firebase. Ative o provedor "E-mail/Senha" em Authentication > Sign-in method no Console do Firebase.');
      } else if (err.code === 'auth/email-already-in-use') {
        setError('Este e-mail já está sendo utilizado.');
      } else if (err.code === 'auth/invalid-email') {
        setError('O formato do e-mail é inválido.');
      } else if (err.code === 'auth/weak-password') {
        setError('A senha deve conter pelo menos 6 caracteres.');
      } else {
        setError(`Erro ao criar conta (${err.code || 'desconhecido'}): ${err.message}`);
        console.error("Erro de cadastro:", err.code, err.message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();
    if (!email) {
      setError("Por favor, insira seu e-mail para redefinir a senha.");
      return;
    }
    setIsLoading(true);
    try {
      await firebaseApi.resetPassword(email);
      setMessage(`Se uma conta existir para o e-mail ${email}, um link de redefinição de senha foi enviado.`);
      setIsResetView(false);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  if (isResetView) {
    return (
      <div className="p-2">
        <h2 className="text-xl font-extrabold text-slate-800 text-center mb-4">Redefinir Senha</h2>
        <p className="text-sm text-slate-600 text-center mb-6">
          Digite seu e-mail e enviaremos um link de recuperação.
        </p>
        <form onSubmit={handlePasswordReset} className="space-y-4">
          <div>
            <label htmlFor="reset-email" className="block text-sm font-semibold text-slate-700">E-mail</label>
            <input
              id="reset-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary text-slate-800"
            />
          </div>
          {error && <p className="text-red-500 text-sm text-center bg-red-50 p-2.5 rounded border border-red-100">{error}</p>}
          {message && <p className="text-green-600 text-sm text-center bg-green-50 p-2.5 rounded border border-green-100">{message}</p>}
          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center items-center py-2.5 px-4 rounded-xl shadow-md text-sm font-bold text-white bg-[#114D38] hover:bg-[#0d3b2b] active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#114D38] disabled:bg-slate-300 disabled:cursor-not-allowed transition duration-200 cursor-pointer"
            >
              {isLoading ? 'Enviando...' : 'Enviar Link de Redefinição'}
            </button>
          </div>
          <div className="text-sm text-center pt-2">
            <button type="button" onClick={() => { setIsResetView(false); clearMessages(); }} className="font-bold text-[#114D38] hover:text-[#0d3b2b] transition">
              Voltar para o Login
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="p-1">
      <div>
        <h2 className="text-lg font-bold text-slate-800 mb-4">Acesso Administrativo</h2>
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label htmlFor="admin-email" className="block text-sm font-semibold text-slate-700">E-mail</label>
            <input
              id="admin-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary text-slate-800"
            />
          </div>
          <div>
            <label htmlFor="admin-password" className="block text-sm font-semibold text-slate-700">Senha</label>
            <div className="mt-1 relative rounded-md shadow-sm">
              <input
                id="admin-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="block w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary text-slate-800"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-500"
                aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
              >
                {showPassword ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
              </button>
            </div>
          </div>
          
          {error && (
            <div className="text-red-600 text-sm bg-red-50 p-2.5 rounded border border-red-100 leading-relaxed">
              {error}
              {error.includes('Ative o provedor') || error.includes('ativado no Firebase') ? (
                <div className="mt-2 text-xs font-semibold text-red-700 bg-white p-2 rounded border border-red-200">
                  <p className="mb-1 text-slate-700">Siga estes passos para ativar:</p>
                  <ol className="list-decimal list-inside space-y-1 text-slate-600">
                    <li>Acesse o Console do Firebase usando o link abaixo.</li>
                    <li>Vá em <strong>Sign-in method</strong>.</li>
                    <li>Clique em <strong>Adicionar novo provedor</strong> e selecione <strong>E-mail/Senha</strong>.</li>
                    <li>Ative e salve as mudanças.</li>
                  </ol>
                  <a
                    href={`https://console.firebase.google.com/project/${firebaseConfig.projectId}/authentication/providers`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block mt-2 font-bold text-primary hover:underline"
                  >
                    Ir para o Console de Autenticação ↗
                  </a>
                </div>
              ) : null}
            </div>
          )}
          {message && <p className="text-green-600 text-sm text-center bg-green-50 p-2.5 rounded border border-green-100">{message}</p>}

          <div className="flex items-center justify-end">
            <div className="text-sm">
              <button type="button" onClick={() => { setIsResetView(true); clearMessages(); }} className="font-bold text-[#114D38] hover:text-[#0d3b2b] transition">
                Esqueceu a senha?
              </button>
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center items-center py-2.5 px-4 rounded-xl shadow-md text-sm font-bold text-white bg-[#114D38] hover:bg-[#0d3b2b] active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#114D38] disabled:bg-slate-300 disabled:cursor-not-allowed transition duration-200 cursor-pointer"
            >
              {isLoading ? 'Entrando...' : 'Entrar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Login;
