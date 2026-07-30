import React, { useState, useEffect } from 'react';
import { Product } from '../types';
import { FileCheck, Printer, ArrowRight, Sparkles } from 'lucide-react';
import { generateSlug } from '../utils/slug';
import { trackMaterialCardClick } from '../services/analyticsService';

interface ProductCardProps {
  product: Product;
  onSelectProduct: (slug: string) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product, onSelectProduct }) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const imageSrc = (product.imageUrl && product.imageUrl.trim() !== '')
    ? product.imageUrl
    : ((product.thumbnailUrl && product.thumbnailUrl.trim() !== '') 
      ? product.thumbnailUrl 
      : ((product.mainImage && product.mainImage.trim() !== '') ? product.mainImage : null));

  useEffect(() => {
    setImageLoaded(false);
    setHasError(false);
  }, [imageSrc]);

  const handleClick = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const slugToUse = (product.slug && product.slug.trim() !== '') 
      ? product.slug 
      : (generateSlug(product.title) || product.id);
    trackMaterialCardClick({ ...product, slug: slugToUse });
    onSelectProduct(slugToUse);
  };

  return (
    <div 
      onClick={handleClick}
      className="group bg-white rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-xl hover:border-[#6BCB9A]/50 transition-all duration-300 flex flex-col h-full overflow-hidden cursor-pointer"
    >
      {/* Product Image Container */}
      <div className="relative aspect-4/3 w-full bg-slate-200 overflow-hidden">
        {!imageLoaded && !hasError && imageSrc && (
          <div className="absolute inset-0 bg-slate-200 animate-pulse flex items-center justify-center">
            <span className="text-slate-400 text-xs font-medium">Carregando imagem...</span>
          </div>
        )}
        {imageSrc && !hasError ? (
          <img
            src={imageSrc}
            alt={product.title}
            onLoad={() => setImageLoaded(true)}
            onError={() => setHasError(true)}
            className={`w-full h-full object-cover group-hover:scale-105 transition-all duration-500 ${
              imageLoaded ? 'opacity-100' : 'opacity-0'
            }`}
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full bg-slate-100 flex items-center justify-center text-slate-400">
            <Sparkles className="w-8 h-8 opacity-40" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        
        {/* Category & Age Badges */}
        <div className="absolute top-3 left-3 flex flex-wrap gap-1.5 max-w-[85%] z-10">
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-white/95 text-slate-800 shadow-xs backdrop-blur-xs">
            {product.category}
          </span>
          {product.targetAge && (
            <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-[#6BCB9A] text-white shadow-xs">
              {product.targetAge}
            </span>
          )}
        </div>

        {(product.featured || product.socialFeatured) && (
          <div className="absolute top-3 right-3 bg-amber-400 text-amber-950 p-1.5 rounded-full shadow-xs z-10" title="Destaque">
            <Sparkles className="w-3.5 h-3.5 fill-amber-950" />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
        <div className="space-y-2">
          <h3 className="font-bold text-slate-900 text-lg leading-snug group-hover:text-[#2F8F6B] transition-colors">
            {product.title}
          </h3>
          <p className="text-sm text-slate-600 line-clamp-2 leading-relaxed">
            {product.shortSummary}
          </p>
        </div>

        {/* Feature Badges */}
        <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-2 text-xs text-slate-500 font-medium">
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-slate-100 text-slate-700">
            <FileCheck className="w-3.5 h-3.5 text-[#2F8F6B]" />
            PDF digital
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-slate-100 text-slate-700">
            <Printer className="w-3.5 h-3.5 text-[#2F8F6B]" />
            Pronto para imprimir
          </span>
        </div>

        {/* Action Button - "Saiba mais" Only */}
        <div className="pt-1">
          <button
            type="button"
            onClick={(e) => handleClick(e)}
            className="w-full py-2.5 px-4 rounded-xl bg-[#6BCB9A] hover:bg-[#55B987] active:bg-[#46a375] text-white font-semibold text-sm transition-all duration-200 flex items-center justify-center gap-2 shadow-xs group-hover:shadow-md cursor-pointer"
          >
            <span>Saiba mais</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </div>
    </div>
  );
};
