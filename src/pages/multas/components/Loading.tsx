import React from 'react';
import { Loader2 } from 'lucide-react';

const Loading: React.FC = () => {
  return (
    <div className="absolute inset-0 bg-white/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="flex flex-col items-center animate-in fade-in">
        <Loader2 size={48} className="text-risel-green animate-spin" />
        <p className="mt-2 text-sm font-bold text-gray-600">Sincronizando...</p>
      </div>
    </div>
  );
};

export default Loading;