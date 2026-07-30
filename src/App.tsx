import React, { useState, useEffect } from 'react';
import { Product } from './types';
import { fetchProductsAsync } from './services/productFirestore';
import { generateSlug } from './utils/slug';
import { trackPageView } from './services/analyticsService';
import { HeaderNav } from './components/HeaderNav';
import { Footer } from './components/Footer';
import { BioPage } from './pages/BioPage';
import { MaterialsPage } from './pages/MaterialsPage';
import { ProductDetailPage } from './pages/ProductDetailPage';
import { AdminPage } from './pages/AdminPage';

export default function App() {
  const [products, setProducts] = useState<Product[]>([]);
  const [currentPath, setCurrentPath] = useState<string>(() => {
    return window.location.hash ? window.location.hash.slice(1) : window.location.pathname;
  });

  const refreshProducts = async () => {
    const list = await fetchProductsAsync();
    setProducts(list);
  };

  useEffect(() => {
    refreshProducts();
  }, []);


  useEffect(() => {
    trackPageView(currentPath || '/');
  }, [currentPath]);

  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.hash ? window.location.hash.slice(1) : window.location.pathname;
      setCurrentPath(path || '/');
    };

    window.addEventListener('popstate', handlePopState);
    window.addEventListener('hashchange', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('hashchange', handlePopState);
    };
  }, []);

  const navigateTo = (path: string) => {
    setCurrentPath(path);
    window.history.pushState({}, '', `#${path}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectProduct = (slug: string) => {
    const cleanSlug = slug.trim();
    navigateTo(`/atividade/${cleanSlug}`);
  };

  // Route Resolver
  const resolveRoute = () => {
    const rawPath = currentPath || '/';

    if (rawPath === '/materiais' || rawPath === '/atividades') {
      return (
        <MaterialsPage
          products={products}
          onSelectProduct={handleSelectProduct}
        />
      );
    }

    if (rawPath === '/admin') {
      return (
        <AdminPage
          products={products}
          onProductsUpdated={refreshProducts}
          onNavigate={navigateTo}
        />
      );
    }

    if (rawPath.startsWith('/atividade/') || rawPath.startsWith('/produto/')) {
      const rawSlug = rawPath.replace(/^\/(atividade|produto)\//, '');
      const searchSlug = rawSlug.toLowerCase().trim();

      // Look in React state first, matching by slug, title-slug or id
      const product = products.find(p => 
        (p.slug && p.slug.toLowerCase().trim() === searchSlug) ||
        generateSlug(p.title) === searchSlug ||
        p.id.toLowerCase() === searchSlug
      );
      
      if (product) {
        return (
          <ProductDetailPage
            product={product}
            onNavigate={navigateTo}
          />
        );
      }

      // If product not found
      return (
        <div className="min-h-[60vh] flex flex-col items-center justify-center p-8 text-center space-y-4">
          <h2 className="text-2xl font-bold text-slate-800">Material não encontrado</h2>
          <p className="text-slate-600 max-w-md">O produto procurado não foi localizado ou pode ter sido removido.</p>
          <button
            onClick={() => navigateTo('/materiais')}
            className="px-6 py-2.5 rounded-xl bg-[#6BCB9A] hover:bg-[#55B987] text-white font-semibold text-sm transition-colors cursor-pointer shadow-xs"
          >
            Voltar para materiais
          </button>
        </div>
      );
    }

    // Default: Link da Bio Page (for / and /bio)
    return (
      <BioPage
        products={products}
        onNavigate={navigateTo}
        onSelectProduct={handleSelectProduct}
      />
    );
  };

  return (
    <div className="min-h-screen flex flex-col font-sans bg-slate-50 text-slate-900 antialiased selection:bg-teal-100 selection:text-teal-900">
      <HeaderNav currentPath={currentPath} onNavigate={navigateTo} />
      
      <main className="flex-1">
        {resolveRoute()}
      </main>

      <Footer onNavigate={navigateTo} />
    </div>
  );
}
