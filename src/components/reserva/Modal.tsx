
import React from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: React.ReactNode;
  children: React.ReactNode;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-md z-50 flex justify-center items-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200/80 w-full max-w-lg overflow-hidden flex flex-col transform transition-all duration-300 scale-100">
        <div className="bg-gradient-to-r from-[#114D38] via-[#165a43] to-[#1d7053] px-6 py-4.5 flex justify-between items-center text-white border-b border-emerald-800/40 shadow-sm">
          <div className="text-lg font-bold flex items-center gap-2.5 tracking-wide text-white">{title}</div>
          <button 
            onClick={onClose} 
            className="text-emerald-100/80 hover:text-white p-1.5 hover:bg-white/15 rounded-xl transition-all cursor-pointer"
            aria-label="Fechar"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-6 overflow-y-auto max-h-[85vh]">
          {children}
        </div>
      </div>
    </div>
  );
};

export default Modal;

