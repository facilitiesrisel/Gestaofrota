import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import { auth } from '../services/firebaseService';

interface ReservationAuthContextType {
  user: firebase.User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const ReservationAuthContext = createContext<ReservationAuthContextType | undefined>(undefined);

export const ReservationAuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<firebase.User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Este listener do Firebase gerencia o estado de autenticação do usuário.
    const unsubscribe = auth.onAuthStateChanged((currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        setLoading(false);
      } else {
        // Tenta login anônimo para acesso público
        auth.signInAnonymously().catch((error) => {
          // Ignora erro 'auth/invalid-credential' que pode ocorrer se anon auth não estiver habilitado ou conflito de sessão
          // Isso permite que a UI carregue como deslogado sem travar
          if (error.code !== 'auth/invalid-credential' && error.code !== 'auth/operation-not-allowed') {
             console.error("Falha no login anônimo.", error);
          } else {
             console.warn("Aviso: Autenticação anônima não configurada ou credencial inválida. O acesso público pode estar restrito.");
          }
          setUser(null);
          setLoading(false);
        });
      }
    });
  
    return () => unsubscribe();
  }, []);

  const signIn = async (email: string, password: string): Promise<void> => {
    await auth.signInWithEmailAndPassword(email, password);
  };

  const signOut = async (): Promise<void> => {
    await auth.signOut();
  };

  const value = { user, loading, signIn, signOut };

  // Renderiza os children apenas quando o carregamento inicial terminar
  return (
    <ReservationAuthContext.Provider value={value}>
      {children}
    </ReservationAuthContext.Provider>
  );
};

// Hook customizado para usar o contexto de autenticação de reservas
export const useReservationAuth = (): ReservationAuthContextType => {
  const context = useContext(ReservationAuthContext);
  if (context === undefined) {
    throw new Error('useReservationAuth deve ser usado dentro de um ReservationAuthProvider');
  }
  return context;
};

// Aliases para compatibilidade com componentes clonados
export { useReservationAuth as useAuth, ReservationAuthProvider as AuthProvider };
