import React from 'react';
import { BookOpen, ShieldCheck, Heart, FileText, Lock } from 'lucide-react';
import { APP_BUILD_ID } from '../types';

interface FooterProps {
  onNavigate: (path: string) => void;
  productsCount?: number;
}

export const Footer: React.FC<FooterProps> = ({ onNavigate, productsCount = 0 }) => {
  return (
    <footer className="bg-slate-900 text-slate-300 pt-12 pb-8 border-t border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pb-10 border-b border-slate-800">
          
          {/* Col 1: Brand & Purpose */}
          <div className="space-y-4">
            <div className="flex items-center gap-3 text-white">
              <div className="w-9 h-9 rounded-xl bg-teal-500/20 text-teal-400 flex items-center justify-center border border-teal-500/30">
                <BookOpen className="w-5 h-5" />
              </div>
              <span className="font-bold text-lg tracking-tight text-white">
                Materiais Criativos
              </span>
            </div>
            <p className="text-sm text-slate-400 leading-relaxed">
              Materiais pedagógicos em PDF organizados para apoiar famílias, professoras, educadores e profissionais da infância.
            </p>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Plataforma de pagamento e entrega segura via Hotmart</span>
            </div>
          </div>

          {/* Col 2: Institutional & Transparency */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-white tracking-wider uppercase flex items-center gap-2">
              <FileText className="w-4 h-4 text-teal-400" /> Transparência & Avisos
            </h3>
            <ul className="space-y-2 text-xs text-slate-400 leading-relaxed">
              <li className="flex items-start gap-2">
                <span className="text-teal-400 font-bold">•</span>
                <span><strong>Produto 100% Digital:</strong> Arquivo em formato PDF pronto para imprimir.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-teal-400 font-bold">•</span>
                <span><strong>Entrega por E-mail:</strong> O acesso é disponibilizado pela Hotmart imediatamente após a aprovação.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-teal-400 font-bold">•</span>
                <span><strong>Sem Frete:</strong> Nenhum material ou kit físico será enviado pelos correios.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-teal-400 font-bold">•</span>
                <span><strong>Uso Supervisionado:</strong> Atividades com tesoura, peças pequenas ou cola exigem supervisão constante de um adulto.</span>
              </li>
            </ul>
          </div>

          {/* Col 3: Navigation */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-white tracking-wider uppercase">
              Navegação
            </h3>
            <ul className="space-y-2 text-sm text-slate-400">
              <li>
                <button
                  onClick={() => onNavigate('/')}
                  className="hover:text-white transition-colors"
                >
                  Página Inicial
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('/materiais')}
                  className="hover:text-white transition-colors"
                >
                  Vitrine de Materiais Pedagógicos
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('/bio')}
                  className="hover:text-white transition-colors"
                >
                  Link da Bio (Instagram/TikTok)
                </button>
              </li>
            </ul>
          </div>

        </div>

        {/* Bottom copyright & disclaimers */}
        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 text-center sm:text-left">
          <div className="flex flex-col items-center sm:items-start gap-1">
            <p>© 2026 Materiais Criativos. Todos os direitos reservados.</p>
            <button
              type="button"
              onClick={() => onNavigate('/admin')}
              aria-label="Acesso restrito"
              className="inline-flex items-center p-0.5 mt-0.5 bg-transparent border-none text-slate-500 opacity-5 sm:opacity-5 hover:opacity-70 focus:opacity-70 active:opacity-70 transition-all duration-200 cursor-pointer hover:text-teal-400"
            >
              <Lock className="w-3 h-3" />
            </button>
          </div>
          <p className="flex items-center justify-center gap-1">
            Desenvolvido com <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" /> para apoiar a educação infantil.
          </p>
        </div>
      </div>
    </footer>
  );
};
