import React, { useState } from 'react';
import { Product } from '../types';
import { BookOpen, Sparkles, HelpCircle, FileText, CheckCircle2, ShieldCheck, ArrowRight, Printer, Star } from 'lucide-react';
import { ProductCard } from '../components/ProductCard';
import { trackBioButtonClick } from '../services/analyticsService';

interface BioPageProps {
  products: Product[];
  onNavigate: (path: string) => void;
  onSelectProduct: (slug: string) => void;
}

export const BioPage: React.FC<BioPageProps> = ({ products, onNavigate, onSelectProduct }) => {
  const [showHowItWorksModal, setShowHowItWorksModal] = useState(false);

  // Filter published products strictly originating from Firestore
  const publishedProducts = products
    .filter(p => p._source === 'firestore' && p.status !== 'draft')
    .sort((a, b) => (a.displayOrder || 999) - (b.displayOrder || 999) || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const highlightedProducts = publishedProducts.filter(p => p.socialFeatured || p.featured);
  
  // Sort by display order
  const displayProducts = (highlightedProducts.length > 0 ? highlightedProducts : publishedProducts)
    .sort((a, b) => (a.displayOrder || 999) - (b.displayOrder || 999))
    .slice(0, 6);

  const scrollToDestaques = () => {
    const el = document.getElementById('destaques');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    } else {
      onNavigate('/materiais');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/50 pb-16">
      
      {/* Top Header Card */}
      <div className="max-w-xl mx-auto pt-8 sm:pt-12 px-4 text-center">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-[#6BCB9A] text-white shadow-lg shadow-[#6BCB9A]/25 mb-4 border-4 border-white">
          <BookOpen className="w-10 h-10" />
        </div>

        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          Materiais Criativos
        </h1>

        <p className="mt-2 text-sm sm:text-base text-slate-600 leading-relaxed font-medium max-w-md mx-auto">
          Materiais pedagógicos em PDF para imprimir e aplicar com crianças.
        </p>

        {/* Safety Badge */}
        <div className="mt-4 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-softgreen-bg text-[#2F8F6B] text-xs font-semibold border border-softgreen-border">
          <ShieldCheck className="w-4 h-4 text-[#2F8F6B]" />
          <span>Materiais em PDF • Entrega imediata via Hotmart</span>
        </div>
      </div>

      {/* Main Bio Links */}
      <div className="max-w-md mx-auto mt-8 px-4 space-y-3.5">
        
        {/* Button 1: Ver materiais pedagógicos */}
        <button
          onClick={() => {
            trackBioButtonClick('Ver materiais pedagógicos');
            onNavigate('/materiais');
          }}
          className="w-full py-4 px-6 rounded-2xl bg-[#6BCB9A] hover:bg-[#55B987] active:bg-[#46a375] text-white font-bold text-base shadow-md shadow-[#6BCB9A]/25 hover:shadow-lg transition-all flex items-center justify-between group"
        >
          <div className="flex items-center gap-3">
            <BookOpen className="w-5 h-5 text-white/90" />
            <span>Ver materiais pedagógicos</span>
          </div>
          <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
        </button>

        {/* Button 2: Ver atividades em destaque */}
        <button
          onClick={() => {
            trackBioButtonClick('Ver atividades em destaque');
            scrollToDestaques();
          }}
          className="w-full py-3.5 px-6 rounded-2xl bg-white hover:bg-slate-50 text-slate-800 font-semibold text-sm border border-slate-200 shadow-xs hover:shadow-md transition-all flex items-center justify-between text-left group"
        >
          <div className="flex items-center gap-3">
            <Star className="w-5 h-5 text-amber-500 fill-amber-500/20" />
            <div>
              <div className="text-slate-900 font-bold">Ver atividades em destaque</div>
              <div className="text-xs text-slate-500 font-normal">Conheça os recursos mais procurados</div>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform" />
        </button>

        {/* Button 3: Como funciona a entrega */}
        <button
          onClick={() => {
            trackBioButtonClick('Como funciona a entrega?');
            setShowHowItWorksModal(true);
          }}
          className="w-full py-3.5 px-6 rounded-2xl bg-white hover:bg-slate-50 text-slate-800 font-semibold text-sm border border-slate-200 shadow-xs hover:shadow-md transition-all flex items-center justify-between text-left"
        >
          <div className="flex items-center gap-3">
            <HelpCircle className="w-5 h-5 text-[#2F8F6B]" />
            <div>
              <div className="text-slate-900 font-bold">Como funciona a entrega?</div>
              <div className="text-xs text-slate-500 font-normal">Entenda o recebimento do PDF digital</div>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-400" />
        </button>

        {/* Button 4: Acessar vitrine completa */}
        <button
          onClick={() => {
            trackBioButtonClick('Acessar vitrine completa');
            onNavigate('/materiais');
          }}
          className="w-full py-3.5 px-6 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-sm border border-slate-200/80 transition-all flex items-center justify-between text-left"
        >
          <div className="flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-[#2F8F6B]" />
            <div>
              <div className="text-slate-900 font-bold">Acessar vitrine completa</div>
              <div className="text-xs text-slate-500 font-normal">Grade completa de atividades em PDF</div>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-500" />
        </button>

      </div>

      {/* Destaques Showcase Section */}
      <div id="destaques" className="max-w-5xl mx-auto mt-14 px-4 sm:px-6">
        <div className="text-center max-w-xl mx-auto mb-8">
          <span className="px-3.5 py-1 rounded-full bg-softgreen-bg text-[#2F8F6B] text-xs font-bold uppercase tracking-wider border border-softgreen-border">
            Vitrine em Destaque
          </span>
          <h2 className="mt-2 text-2xl font-bold text-slate-900">
            Conheça algumas de nossas atividades
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            Clique em "Saiba mais" para ver os detalhes completos de cada arquivo pedagógico.
          </p>
        </div>

        {displayProducts.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center border border-slate-200 max-w-sm mx-auto my-6 space-y-2">
            <p className="text-slate-600 font-semibold text-sm">Nenhum material publicado ainda.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {displayProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onSelectProduct={onSelectProduct}
              />
            ))}
          </div>
        )}

        <div className="mt-8 text-center">
          <button
            onClick={() => onNavigate('/materiais')}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-slate-900 text-white hover:bg-slate-800 font-semibold text-sm transition-all shadow-md"
          >
            <span>Ver toda a biblioteca de materiais</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Modal: Como funciona a entrega */}
      {showHowItWorksModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 space-y-6 shadow-2xl relative animate-in fade-in zoom-in duration-200">
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-teal-50 text-teal-700">
                  <FileText className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-lg">Como funciona a entrega?</h3>
                  <p className="text-xs text-slate-500">Transparência total em sua compra digital</p>
                </div>
              </div>
              <button
                onClick={() => setShowHowItWorksModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-sm text-slate-600 leading-relaxed">
              <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-slate-50">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-slate-900 block">100% Digital em PDF</strong>
                  Todos os nossos arquivos são disponibilizados em alta resolução prontos para impressão em papel tamanho A4.
                </div>
              </div>

              <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-slate-50">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-slate-900 block">Envio Imediato via Hotmart</strong>
                  Assim que o pagamento for confirmado, você receberá no seu e-mail cadastrado o link de acesso seguro da Hotmart para baixar os PDFs.
                </div>
              </div>

              <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-slate-50">
                <Printer className="w-5 h-5 text-teal-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-slate-900 block">Nenhum Envio Físico</strong>
                  Não enviamos materiais pelos Correios. Você pode imprimir quantas vezes quiser em casa ou gráfica de sua preferência.
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowHowItWorksModal(false)}
              className="w-full py-3 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-sm transition-colors"
            >
              Entendido
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
