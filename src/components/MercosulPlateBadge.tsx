import React from "react";

export interface MercosulPlateBadgeProps {
  plate?: string;
  isInactive?: boolean;
  size?: "sm" | "md";
  className?: string;
}

export const MercosulPlateBadge: React.FC<MercosulPlateBadgeProps> = ({
  plate = "",
  isInactive = false,
  size = "md",
  className = "",
}) => {
  const cleanPlate = (plate || "").toUpperCase().trim();
  const isSm = size === "sm";

  if (!cleanPlate || cleanPlate === "SEM PLACA" || cleanPlate === "N/D" || cleanPlate === "-" || cleanPlate === "SEM REGISTRO") {
    return (
      <div
        className={`inline-flex items-center justify-center border border-dashed border-slate-300 bg-slate-100/80 rounded-md px-1.5 py-1 text-center select-none shrink-0 ${className}`}
        style={{
          width: isSm ? "80px" : "92px",
          minWidth: isSm ? "80px" : "92px",
        }}
      >
        <span className="text-[9.5px] font-mono font-bold text-slate-400 uppercase tracking-wider truncate">
          {cleanPlate || "SEM PLACA"}
        </span>
      </div>
    );
  }

  const formattedPlate = cleanPlate;

  return (
    <div
      className={`inline-flex flex-col items-center justify-center border rounded-md sm:rounded-lg overflow-hidden shadow-2xs select-none transition-all duration-200 shrink-0 ${
        isInactive
          ? "border-slate-300 bg-slate-100 opacity-60"
          : "border-slate-300 bg-white hover:border-slate-400 hover:shadow-xs"
      } ${className}`}
      style={{
        width: isSm ? "80px" : "92px",
        minWidth: isSm ? "80px" : "92px",
      }}
    >
      {/* Faixa Azul Mercosul */}
      <div
        className={`w-full ${isSm ? "py-[2px] px-1" : "py-0.5 px-1.5"} flex items-center justify-between ${
          isInactive ? "bg-slate-500" : "bg-[#003399]"
        }`}
      >
        {/* Estrelas / Logo Mercosul */}
        <div className="flex items-center gap-0.5">
          <div className={`${isSm ? "w-1 h-1" : "w-1.5 h-1.5"} rounded-full bg-yellow-300 opacity-90`}></div>
          <div className={`${isSm ? "w-0.5 h-0.5" : "w-1 h-1"} rounded-full bg-yellow-200 opacity-70`}></div>
        </div>

        {/* Texto BRASIL */}
        <span
          className={`${
            isSm ? "text-[6.5px]" : "text-[7.5px]"
          } font-black text-white tracking-widest leading-none font-sans uppercase`}
        >
          BRASIL
        </span>

        {/* Mini Bandeira do Brasil */}
        <div
          className={`${
            isSm ? "w-2 h-1" : "w-2.5 h-1.5"
          } bg-emerald-500 rounded-[1px] relative flex items-center justify-center overflow-hidden`}
        >
          <div className={`${isSm ? "w-1.2 h-0.8" : "w-1.5 h-1"} bg-yellow-400 rotate-45 transform`}></div>
          <div className="w-0.5 h-0.5 rounded-full bg-blue-700 absolute"></div>
        </div>
      </div>

      {/* Corpo da Placa com Código e Fonte Monospace */}
      <div
        className={`w-full bg-white ${
          isSm ? "py-[2px] px-0.5" : "py-0.5 px-1"
        } text-center flex items-center justify-center`}
      >
        <span
          className={`${
            isSm ? "text-[10.5px]" : "text-[12px]"
          } font-mono font-black tracking-wider leading-tight ${
            isInactive ? "text-slate-500" : "text-slate-900"
          }`}
        >
          {formattedPlate}
        </span>
      </div>
    </div>
  );
};

export default MercosulPlateBadge;
