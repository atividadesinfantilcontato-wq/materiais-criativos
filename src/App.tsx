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
import { ProofRealPage } from './pages/ProofRealPage';
import { CheckConexaoPage } from './pages/CheckConexaoPage';
import { ProofZeroPage, QUARANTINE_MODE } from './pages/ProofZeroPage';
import { VersionPage } from './pages/VersionPage';

function getNormalizedPath(): string {
  if (typeof window === 'undefined') return '/';
  const hash = window.location.hash;
  if (hash) {
    const cleaned = hash.replace(/^#\/?/, '/');
    return cleaned.endsWith('/') && cleaned.length > 1 ? cleaned.slice(0, -1) : cleaned;
  }
  const pathname = window.location.pathname;
  return pathname.endsWith('/') && pathname.length > 1 ? pathname.slice(0, -1) : pathname;
}

export default function App() {
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoaded, setProductsLoaded] = useState<boolean>(false);
  const [productsSource, setProductsSource] = useState<'loading' | 'firestore'>('loading');
  const [fakeBlockedCount, setFakeBlockedCount] = useState<number>(0);
  const [currentPath, setCurrentPath] = useState<string>(getNormalizedPath);

  const refreshProducts = async () => {
    setProducts([]);
    setProductsLoaded(false);
    setProductsSource('loading');

    const list = await fetchProductsAsync();
    const safeProducts = list.filter(p => p._source === 'firestore' && p._firestoreId);
    const blocked = list.length - safeProducts.length;

    setProducts(safeProducts);
    setFakeBlockedCount(blocked);
    setProductsLoaded(true);
    setProductsSource('firestore');
  };

  useEffect(() => {
    refreshProducts();
  }, []);

  useEffect(() => {
    trackPageView(currentPath || '/');
  }, [currentPath]);

  useEffect(() => {
    const handleLocationChange = () => {
      setCurrentPath(getNormalizedPath());
    };

    window.addEventListener('popstate', handleLocationChange);
    window.addEventListener('hashchange', handleLocationChange);
    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      window.removeEventListener('hashchange', handleLocationChange);
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

  // ISOLATED ROUTES FOR TECHNICAL PROOF & CONNECTION AUDIT
  if (currentPath === '/versao' || currentPath.startsWith('/versao')) {
    return <VersionPage />;
  }

  if (currentPath === '/prova-zero' || currentPath.startsWith('/prova-zero')) {
    return <ProofZeroPage />;
  }

  if (currentPath === '/check-conexao' || currentPath.startsWith('/check-conexao')) {
    return <CheckConexaoPage />;
  }

  if (currentPath === '/prova-real' || currentPath.startsWith('/prova-real')) {
    return <ProofRealPage />;
  }

  // Route Resolver for public app
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
      {fakeBlockedCount > 0 && (
        <div className="bg-rose-600 text-white px-4 py-2.5 text-xs font-mono font-bold text-center">
          ERRO GRAVE: {fakeBlockedCount} PRODUTO(S) FAKE BLOQUEADO(S). FIRESTORE REAL = {products.length}.
        </div>
      )}

      <HeaderNav currentPath={currentPath} onNavigate={navigateTo} />
      
      <main className="flex-1">
        {!productsLoaded ? (
          <div className="min-h-[60vh] flex flex-col items-center justify-center p-8 text-center space-y-3">
            <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-semibold text-slate-700">Carregando materiais reais...</p>
          </div>
        ) : (
          resolveRoute()
        )}
      </main>

      <Footer onNavigate={navigateTo} productsCount={products.length} />
    </div>
  );
}
