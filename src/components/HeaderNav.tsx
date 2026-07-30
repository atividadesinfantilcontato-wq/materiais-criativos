import React, { useState } from 'react';
import { BookOpen, Sparkles, Menu, X, ShieldCheck, Lock } from 'lucide-react';

interface HeaderNavProps {
  currentPath: string;
  onNavigate: (path: string) => void;
}

export const HeaderNav: React.FC<HeaderNavProps> = ({ currentPath, onNavigate }) => {
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems = [
    { label: 'Link da Bio', path: '/' },
    { label: 'Materiais Pedagógicos', path: '/materiais' },
  ];

  const handleLinkClick = (path: string) => {
    onNavigate(path);
    setMobileOpen(false);
  };

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-100 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20">
          
          {/* Logo & Brand */}
          <button 
            onClick={() => handleLinkClick('/')}
            className="flex items-center gap-3 text-left focus:outline-hidden group"
          >
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-softgreen-bg text-[#2F8F6B] flex items-center justify-center border border-softgreen-border group-hover:scale-105 transition-transform">
              <BookOpen className="w-5 h-5 sm:w-6 sm:h-6 text-[#2F8F6B]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900 text-base sm:text-lg tracking-tight">
                  Materiais Criativos
                </span>
                <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-softgreen-bg text-[#2F8F6B] border border-softgreen-border">
                  <Sparkles className="w-3 h-3 mr-1 text-[#2F8F6B]" /> PDF Digital
                </span>
              </div>
              <p className="text-xs text-slate-500 font-normal">
                Materiais pedagógicos em PDF
              </p>
            </div>
          </button>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const isActive = (item.path === '/' && (currentPath === '/' || currentPath === '/bio' || !currentPath)) ||
                (item.path === '/materiais' && (currentPath === '/materiais' || currentPath === '/atividades' || currentPath.startsWith('/atividade/')));
              return (
                <button
                  key={item.path}
                  onClick={() => handleLinkClick(item.path)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-softgreen-bg text-[#2F8F6B] font-semibold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}

            <div className="h-5 w-px bg-slate-200 mx-2" />

            {/* Safety Badge Indicator */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-softgreen-bg text-[#2F8F6B] text-xs font-medium border border-softgreen-border">
              <ShieldCheck className="w-4 h-4 text-[#2F8F6B]" />
              <span>Ambiente Seguro</span>
            </div>
          </nav>

          {/* Mobile Menu Button */}
          <div className="flex items-center gap-2 md:hidden">
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="p-2.5 rounded-xl text-slate-700 hover:bg-slate-100 focus:outline-hidden"
              aria-label="Abrir menu"
            >
              {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>

        </div>
      </div>

      {/* Mobile Menu Overlay */}
      {mobileOpen && (
        <div className="md:hidden bg-white border-b border-slate-200 px-4 pt-2 pb-6 space-y-2">
          {navItems.map((item) => {
            const isActive = (item.path === '/' && (currentPath === '/' || currentPath === '/bio' || !currentPath)) ||
              (item.path === '/materiais' && (currentPath === '/materiais' || currentPath === '/atividades' || currentPath.startsWith('/atividade/')));
            return (
              <button
                key={item.path}
                onClick={() => handleLinkClick(item.path)}
                className={`w-full text-left px-4 py-3 rounded-xl text-base font-medium transition-colors ${
                  isActive
                    ? 'bg-softgreen-bg text-[#2F8F6B] font-semibold'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                {item.label}
              </button>
            );
          })}

          <div className="pt-2">
            <div className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-softgreen-bg text-[#2F8F6B] text-xs font-medium border border-softgreen-border">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Entrega digital garantida pela Hotmart</span>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
