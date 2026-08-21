
import React from 'react';

export const RiselLogo: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 200 200" className={className} xmlns="http://www.w3.org/2000/svg">
    {/* Círculo externo com traço reduzido de 5 para 3 */}
    <circle cx="100" cy="100" r="98" fill="white" stroke="#ff9b00" strokeWidth="3"/>
    
    {/* Parte Verde Inferior (Onda) */}
    <path d="M 4 100 Q 100 160 196 100 A 96 96 0 0 1 4 100" fill="#00753f" />
    
    {/* Texto Risel */}
    <text x="100" y="85" fontFamily="Arial, sans-serif" fontWeight="900" fontSize="55" textAnchor="middle" fill="#00753f" style={{ letterSpacing: '-2px' }}>Risel</text>
    <text x="100" y="105" fontFamily="Arial, sans-serif" fontWeight="bold" fontSize="14" textAnchor="middle" fill="#00753f" letterSpacing="2">COMBUSTÍVEIS</text>

    {/* Detalhe Laranja Superior Esquerdo (Abstrato) - Traço reduzido de 8 para 4 */}
    <path d="M 35 60 Q 60 30 90 25" fill="none" stroke="#ff9b00" strokeWidth="4" strokeLinecap="round" opacity="0.8" />

    {/* Texto Disk Diesel */}
    <text x="100" y="150" fontFamily="Arial, sans-serif" fontWeight="900" fontSize="24" textAnchor="middle" fill="#ff9b00">DISK</text>
    <text x="100" y="172" fontFamily="Arial, sans-serif" fontWeight="900" fontSize="24" textAnchor="middle" fill="#ff9b00">DIESEL®</text>
    
    {/* Telefones na borda inferior */}
    <path id="curveBottom" d="M 30 165 Q 100 200 170 165" fill="transparent" />
    <text width="200">
      <textPath href="#curveBottom" startOffset="50%" textAnchor="middle" fill="white" fontWeight="bold" fontSize="16" fontFamily="Arial, sans-serif" letterSpacing="1">
        0800 17 02 02
      </textPath>
    </text>
  </svg>
);
