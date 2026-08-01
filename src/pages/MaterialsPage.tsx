import React, { useState, useMemo } from 'react';
import { Product } from '../types';
import { ProductCard } from '../components/ProductCard';
import { Search, Info, FileCheck, ShieldCheck } from 'lucide-react';

interface MaterialsPageProps {
  products: Product[];
  onSelectProduct: (slug: string) => void;
}

export const MaterialsPage: React.FC<MaterialsPageProps> = ({ products, onSelectProduct }) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('Todas');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const publishedProducts = useMemo(() => {
    return products
      .filter(p => p._source === 'firestore' && p.status !== 'draft')
      .sort((a, b) => (a.displayOrder || 999) - (b.displayOrder || 999) || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [products]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    publishedProducts.forEach(p => {
      if (p.category) set.add(p.category);
    });
    return ['Todas', ...Array.from(set)];
  }, [publishedProducts]);

  const filteredProducts = useMemo(() => {
    return publishedProducts.filter(p => {
      const matchesCategory = selectedCategory === 'Todas' || p.category === selectedCategory;
      const matchesSearch = searchQuery.trim() === '' || 
        p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.shortSummary.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.skillsWorked && p.skillsWorked.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesCategory && matchesSearch;
    });
  }, [publishedProducts, selectedCategory, searchQuery]);

  return (
    <div className="min-h-screen bg-slate-50/60 pb-20">
      
      {/* Hero / Header Section */}
      <section className="bg-white border-b border-slate-200/80 pt-10 pb-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center space-y-4">
          
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-softgreen-bg border border-softgreen-border text-[#2F8F6B] text-xs font-semibold">
            <FileCheck className="w-4 h-4 text-[#2F8F6B]" />
            <span>Vitrine Institucional de Recursos Pedagógicos</span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight">
            Materiais pedagógicos
          </h1>

          <p className="text-base sm:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
            Atividades em PDF organizadas para apoiar famílias, professoras e profissionais da educação infantil.
          </p>

          {/* Institutional Explanation Block */}
          <div className="mt-6 p-4 sm:p-5 bg-softgreen-bg border border-softgreen-border rounded-2xl max-w-2xl mx-auto flex items-start gap-3.5 text-left">
            <Info className="w-5 h-5 text-[#2F8F6B] shrink-0 mt-0.5" />
            <p className="text-xs sm:text-sm text-[#2F8F6B] font-medium leading-relaxed">
              Aqui você encontra materiais digitais em PDF. Você pode conhecer cada atividade, ver os detalhes e, se desejar, finalizar a compra pela Hotmart.
            </p>
          </div>

        </div>
      </section>

      {/* Filter and Search Bar */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          
          {/* Search Input */}
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar atividade..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-[#6BCB9A]/30 focus:border-[#6BCB9A] text-slate-900 placeholder-slate-400"
            />
          </div>

          {/* Categories Horizontal Scroll */}
          <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-2 md:pb-0 no-scrollbar">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                  selectedCategory === cat
                    ? 'bg-[#6BCB9A] text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

        </div>
      </section>

      {/* Products Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        {filteredProducts.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 max-w-md mx-auto my-12 space-y-3">
            <Info className="w-10 h-10 text-slate-400 mx-auto" />
            <h3 className="text-lg font-bold text-slate-800">
              {publishedProducts.length === 0 ? 'Nenhum material publicado ainda.' : 'Nenhum material encontrado'}
            </h3>
            <p className="text-xs text-slate-500">
              {publishedProducts.length === 0 ? 'Novos materiais serão adicionados em breve.' : 'Tente buscar por outros termos ou selecionar outra categoria.'}
            </p>
            {publishedProducts.length > 0 && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('Todas');
                }}
                className="mt-2 px-4 py-2 rounded-xl bg-teal-50 text-teal-700 text-xs font-bold"
              >
                Limpar filtros
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-6 sm:gap-8">
            {filteredProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onSelectProduct={onSelectProduct}
              />
            ))}
          </div>
        )}
      </section>

      {/* Reassurance Footer Banner */}
      <section className="max-w-4xl mx-auto px-4 mt-16 text-center">
        <div className="p-6 bg-white rounded-3xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4 text-left">
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-8 h-8 text-emerald-600 shrink-0" />
            <div>
              <h4 className="font-bold text-slate-900 text-sm">Garantia e Processamento Seguro</h4>
              <p className="text-xs text-slate-500">
                Seus arquivos são disponibilizados via Hotmart. Download rápido e suporte disponível.
              </p>
            </div>
          </div>
          <span className="text-xs font-bold text-teal-700 bg-teal-50 px-3 py-1.5 rounded-lg border border-teal-200 shrink-0">
            100% PDF Digital
          </span>
        </div>
      </section>

    </div>
  );
};
