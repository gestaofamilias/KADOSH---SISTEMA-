import React from "react";

export function KadoshLogo({ className = "h-12", showText = true }: { className?: string; showText?: boolean }) {
  return (
    <div className={`flex items-center gap-3 select-none ${className}`}>
      <div className="relative flex items-center justify-center">
        {/* Ambient flame aura */}
        <div className="absolute inset-0 bg-[#CC5A0D]/20 blur-xl rounded-full w-12 h-12"></div>
        {/* Custom flame path SVG based closely on Kadosh's official logo pattern */}
        <svg className="w-10 h-10 relative z-10" viewBox="0 0 100 120" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Main Back Flame - Orange Chama (#CC5A0D) */}
          <path 
            d="M50 5C56 22 42.5 35 46.5 54C49.5 37 68.5 28 66.5 48.5C64.5 69 49.5 81.5 51.5 94.5C28.5 91.5 21 68.5 34.5 51.5C32 57 29 64 29 71.5C29 81.5 37 88 43 90.5C31.5 75 35 52.5 40 36C42.5 27 46.5 15.5 50 5Z" 
            fill="#CC5A0D" 
          />
          {/* Accent Inner Flame - Bege Claro (#E7C19A) */}
          <path 
            d="M50 25C53.5 36.5 44.5 45.5 47.5 59.5C49.5 46 62.5 39.5 61 54C59.5 68 49 77 50 86.5C34 84.5 29.5 68 37.5 55.5C36 59.5 34 64.5 34 69.5C34 76.5 39.5 81.5 43.5 83C36 71.5 38.5 55 42 43C44 36.5 47.5 29 50 25Z" 
            fill="#E7C19A" 
            fillOpacity="0.9" 
          />
          {/* Subtle base spark */}
          <path 
            d="M48 95C51 92 49 88 47 87C45.5 88.5 44 91 44 93C44 95 46 96.5 48 95Z" 
            fill="#E7C19A" 
          />
        </svg>
      </div>
      
      {showText && (
        <div className="flex flex-col">
          <span className="font-display text-2xl font-bold tracking-[0.18em] text-[#E7C19A] leading-none">KADOSH</span>
          <span className="text-[9px] text-[#CC5A0D] tracking-[0.22em] font-medium mt-1 uppercase">Grupo de Louvor & Banda</span>
        </div>
      )}
    </div>
  );
}
