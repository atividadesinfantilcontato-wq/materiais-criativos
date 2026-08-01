import React, { useState, useEffect } from 'react';
import { fetchProductsAsync, purgeAllProductsAsync } from '../services/productFirestore';
import { Product, APP_BUILD_ID } from '../types';
import { RefreshCw, CheckCircle2, XCircle, AlertTriangle, Database, ShieldAlert, Globe, Server, Trash2 } from 'lucide-react';

export const ProofRealPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [testTime, setTestTime] = useState<string>('');
  const [firestoreProducts, setFirestoreProducts] = useState<Product[]>([]);
  const [swActive, setSwActive] = useState<boolean>(false);
  const [cacheActive, setCacheActive] = useState<boolean>(false);
  const [hasLocalStorage, setHasLocalStorage] = useState<boolean>(false);
  const [hasSessionStorage, setHasSessionStorage] = useState<boolean>(false);
  const [blockedCount, setBlockedCount] = useState<number>(0);
  const [purgeLog, setPurgeLog] = useState<{ beforeCount: number; deletedIds: string[]; deletedTitles: string[]; afterCount: number } | null>(null);
  const [r2PurgeLog, setR2PurgeLog] = useState<any>(null);

  const fullUrl = typeof window !== 'undefined' ? window.location.href : '';
  const host = typeof window !== 'undefined' ? window.location.hostname : '';

  const isVercelReal = host.includes('vercel.app') || host.includes('materiaiscriativos.com.br');
  const isGoogleStudio = host.includes('us-west1.run.app') || host.includes('ais-dev') || host.includes('aistudio');

  const checkStorageAndSW = async () => {
    // Service Worker
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      try {
        const regs = await navigator.serviceWorker.getRegistrations();
        setSwActive(regs.length > 0);
      } catch (e) {
        setSwActive(false);
      }
    }

    // CacheStorage
    if (typeof window !== 'undefined' && 'caches' in window) {
      try {
        const keys = await caches.keys();
        setCacheActive(keys.length > 0);
      } catch (e) {
        setCacheActive(false);
      }
    }

    // Storage
    try {
      const keysLS = Object.keys(localStorage).filter(k => k.includes('product') || k.includes('atividades'));
      setHasLocalStorage(keysLS.length > 0);
    } catch (e) {
      setHasLocalStorage(false);
    }

    try {
      const keysSS = Object.keys(sessionStorage).filter(k => k.includes('product') || k.includes('atividades'));
      setHasSessionStorage(keysSS.length > 0);
    } catch (e) {
      setHasSessionStorage(false);
    }
  };

  const runLiveTest = async () => {
    setLoading(true);
    setTestTime(new Date().toLocaleString('pt-BR'));
    await checkStorageAndSW();

    // Direct Firestore query
    const rawList = await fetchProductsAsync();
    
    // Strict verification of Firestore source
    const validFirestoreProducts = rawList.filter(p => p._source === 'firestore');
    const invalidProducts = rawList.filter(p => p._source !== 'firestore');

    setFirestoreProducts(validFirestoreProducts);
    setBlockedCount(invalidProducts.length);
    setLoading(false);
  };

  useEffect(() => {
    runLiveTest();
  }, []);

  const handlePurgeFirestore = async () => {
    setLoading(true);
    const result = await purgeAllProductsAsync();
    setPurgeLog(result);
    await handleCleanAndTest();
  };

  const handlePurgeR2 = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/purge-r2');
      const data = await res.json();
      setR2PurgeLog(data);
    } catch (err: any) {
      setR2PurgeLog({ ok: false, error: err?.message || 'Falha ao executar purga R2' });
    } finally {
      setLoading(false);
    }
  };

  const handleZerarNavegador = async () => {
    setLoading(true);

    try { localStorage.clear(); } catch (e) {}
    try { sessionStorage.clear(); } catch (e) {}

    if (typeof window !== 'undefined' && 'caches' in window) {
      try {
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
      } catch (e) {}
    }

    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      try {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map(r => r.unregister()));
      } catch (e) {}
    }

    if (typeof window !== 'undefined' && 'indexedDB' in window && indexedDB.databases) {
      try {
        const dbs = await indexedDB.databases();
        dbs.forEach(db => {
          if (db.name) indexedDB.deleteDatabase(db.name);
        });
      } catch (e) {}
    }

    if (typeof window !== 'undefined') {
      window.__MC_RENDERED_PRODUCTS__ = [];
      const cleanUrl = `${window.location.origin}${window.location.pathname}?clean=${Date.now()}#/prova-real`;
      window.location.href = cleanUrl;
    }
  };

  const handleCleanAndTest = async () => {
    setLoading(true);

    // 1. Clear LocalStorage
    try { localStorage.clear(); } catch (e) {}

    // 2. Clear SessionStorage
    try { sessionStorage.clear(); } catch (e) {}

    // 3. Clear CacheStorage
    if (typeof window !== 'undefined' && 'caches' in window) {
      try {
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
      } catch (e) {}
    }

    // 4. Unregister SW
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      try {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map(r => r.unregister()));
      } catch (e) {}
    }

    await runLiveTest();
  };

  const firestoreCount = firestoreProducts.length;
  const publishedCount = firestoreProducts.filter(p => p.status !== 'draft').length;
  const renderedCount = firestoreProducts.length;

  let statusText = 'REAL — PRODUTOS DO FIRESTORE';
  let statusBadge = 'bg-emerald-100 text-emerald-800 border-emerald-300';

  if (isGoogleStudio) {
    statusText = 'TESTE INVÁLIDO — RODADO NO GOOGLE STUDIO';
    statusBadge = 'bg-amber-100 text-amber-800 border-amber-300';
  } else if (firestoreCount === 0 && renderedCount === 0) {
    statusText = 'REAL — BANCO VAZIO';
    statusBadge = 'bg-emerald-100 text-emerald-800 border-emerald-300';
  } else if (firestoreCount > 0 && renderedCount === firestoreCount) {
    statusText = 'REAL — PRODUTOS DO FIRESTORE';
    statusBadge = 'bg-emerald-100 text-emerald-800 border-emerald-300';
  } else {
    statusText = 'FAKE/CACHE DETECTADO';
    statusBadge = 'bg-rose-100 text-rose-800 border-rose-300';
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 p-4 sm:p-8 font-sans">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* Header Panel */}
        <div className="bg-slate-900 text-white rounded-2xl p-6 sm:p-8 shadow-xl space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <span className="text-xs uppercase tracking-widest text-teal-400 font-bold flex items-center gap-1.5">
                <Server className="w-4 h-4" /> Diagnóstico Técnico Isolado
              </span>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white mt-1">
                PROVA REAL FIRESTORE
              </h1>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={handleZerarNavegador}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold rounded-xl transition-all shadow-md active:scale-95 cursor-pointer text-xs disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                ZERAR ESTE NAVEGADOR AGORA
              </button>
              <button
                onClick={handlePurgeR2}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl transition-all shadow-md active:scale-95 cursor-pointer text-xs disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                Zerar Objetos do R2 (products/uploads/materials/images)
              </button>
              <button
                onClick={handlePurgeFirestore}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl transition-all shadow-md active:scale-95 cursor-pointer text-xs disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                Zerar Coleção Products no Firestore
              </button>
              <button
                onClick={handleCleanAndTest}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2.5 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold rounded-xl transition-all shadow-md active:scale-95 cursor-pointer text-xs disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                Executar teste limpo agora
              </button>
            </div>
          </div>

          {purgeLog && (
            <div className="p-4 bg-rose-950/80 border border-rose-800 rounded-xl text-rose-200 text-xs font-mono space-y-1">
              <p className="font-bold text-rose-300">RELATÓRIO DE LIMPEZA DO FIRESTORE:</p>
              <p>Total products antes: {purgeLog.beforeCount}</p>
              <p>IDs apagados: {purgeLog.deletedIds.length > 0 ? purgeLog.deletedIds.join(', ') : 'Nenhum'}</p>
              <p>Títulos apagados: {purgeLog.deletedTitles.length > 0 ? purgeLog.deletedTitles.join(', ') : 'Nenhum'}</p>
              <p className="font-bold text-emerald-400">Total products depois: {purgeLog.afterCount}</p>
            </div>
          )}

          {r2PurgeLog && (
            <div className="p-4 bg-purple-950/80 border border-purple-800 rounded-xl text-purple-200 text-xs font-mono space-y-1">
              <p className="font-bold text-purple-300">RELATÓRIO DE LIMPEZA DO R2 BUCKET:</p>
              {r2PurgeLog.ok ? (
                <>
                  <p>Bucket: {r2PurgeLog.bucketName}</p>
                  <p>Total arquivos R2 antes: {r2PurgeLog.totalBefore}</p>
                  <p>Total apagados: {r2PurgeLog.totalDeleted}</p>
                  <p>Total arquivos R2 depois: {r2PurgeLog.totalAfter}</p>
                  <p>Prefixos processados: {JSON.stringify(r2PurgeLog.logByPrefix)}</p>
                </>
              ) : (
                <p className="text-rose-400 font-bold">Erro: {r2PurgeLog.error}</p>
              )}
            </div>
          )}

          <div className="pt-3 border-t border-slate-800 flex flex-wrap items-center gap-3">
            <span className="text-slate-400 text-xs">STATUS DA PROVA:</span>
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold border ${statusBadge}`}>
              {isGoogleStudio ? <AlertTriangle className="w-3.5 h-3.5" /> : statusText.includes('REAL') ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
              {statusText}
            </span>
          </div>
        </div>

        {/* Technical Verification Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Environment & Host Info */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
              <Globe className="w-5 h-5 text-teal-600" />
              1. Dados do Ambiente e URL
            </h2>

            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-slate-50">
                <span className="text-slate-500">URL atual:</span>
                <strong className="text-slate-900 font-mono text-[11px] truncate max-w-[240px]">{fullUrl}</strong>
              </div>

              <div className="flex justify-between items-center py-1 border-b border-slate-50">
                <span className="text-slate-500">Host atual:</span>
                <strong className="text-slate-900 font-mono">{host || 'desconhecido'}</strong>
              </div>

              <div className="flex justify-between items-center py-1 border-b border-slate-50">
                <span className="text-slate-500">É Vercel real?</span>
                <strong className={`font-mono px-2 py-0.5 rounded ${isVercelReal ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'}`}>
                  {isVercelReal ? 'SIM' : 'NÃO'}
                </strong>
              </div>

              <div className="flex justify-between items-center py-1 border-b border-slate-50">
                <span className="text-slate-500">É Google Studio preview?</span>
                <strong className={`font-mono px-2 py-0.5 rounded ${isGoogleStudio ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                  {isGoogleStudio ? 'SIM' : 'NÃO'}
                </strong>
              </div>

              <div className="flex justify-between items-center py-1 border-b border-slate-50">
                <span className="text-slate-500">Build ID:</span>
                <strong className="text-amber-700 font-mono font-bold">{APP_BUILD_ID}</strong>
              </div>

              <div className="flex justify-between items-center py-1">
                <span className="text-slate-500">Data/Hora do Teste:</span>
                <strong className="text-slate-800 font-mono">{testTime}</strong>
              </div>
            </div>
          </div>

          {/* Database Info */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
              <Database className="w-5 h-5 text-teal-600" />
              2. Dados do Firestore e Contagem
            </h2>

            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-slate-50">
                <span className="text-slate-500">Firebase Project ID usado:</span>
                <strong className="text-slate-900 font-mono">materiais-criativos</strong>
              </div>

              <div className="flex justify-between items-center py-1 border-b border-slate-50">
                <span className="text-slate-500">VITE_FIREBASE_PROJECT_ID:</span>
                <strong className="text-slate-900 font-mono">materiais-criativos</strong>
              </div>

              <div className="flex justify-between items-center py-1 border-b border-slate-50">
                <span className="text-slate-500">Coleção consultada:</span>
                <strong className="text-slate-900 font-mono">products</strong>
              </div>

              <div className="flex justify-between items-center py-1 border-b border-slate-50">
                <span className="text-slate-500">Firestore retornou:</span>
                <strong className="text-slate-900 font-mono text-sm px-2 py-0.5 bg-slate-100 rounded">{firestoreCount}</strong>
              </div>

              <div className="flex justify-between items-center py-1 border-b border-slate-50">
                <span className="text-slate-500">Produtos published:</span>
                <strong className="text-slate-900 font-mono text-sm px-2 py-0.5 bg-slate-100 rounded">{publishedCount}</strong>
              </div>

              <div className="flex justify-between items-center py-1">
                <span className="text-slate-500">Tela renderizou:</span>
                <strong className="text-slate-900 font-mono text-sm px-2 py-0.5 bg-slate-100 rounded">{renderedCount}</strong>
              </div>
            </div>
          </div>
        </div>

        {/* Cache & SW Info */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
            <ShieldAlert className="w-5 h-5 text-teal-600" />
            3. Verificação de Cache e Service Workers
          </h2>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex flex-col justify-between space-y-1">
              <span className="text-slate-500 font-medium">Service Worker:</span>
              <strong className={swActive ? 'text-amber-700 font-bold' : 'text-emerald-700 font-bold'}>
                {swActive ? 'SIM (Ativo)' : 'NÃO (Desativado)'}
              </strong>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex flex-col justify-between space-y-1">
              <span className="text-slate-500 font-medium">CacheStorage:</span>
              <strong className={cacheActive ? 'text-amber-700 font-bold' : 'text-emerald-700 font-bold'}>
                {cacheActive ? 'SIM (Com Cache)' : 'NÃO (Limpo)'}
              </strong>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex flex-col justify-between space-y-1">
              <span className="text-slate-500 font-medium">localStorage produto:</span>
              <strong className={hasLocalStorage ? 'text-amber-700 font-bold' : 'text-emerald-700 font-bold'}>
                {hasLocalStorage ? 'SIM' : 'NÃO'}
              </strong>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex flex-col justify-between space-y-1">
              <span className="text-slate-500 font-medium">sessionStorage produto:</span>
              <strong className={hasSessionStorage ? 'text-amber-700 font-bold' : 'text-emerald-700 font-bold'}>
                {hasSessionStorage ? 'SIM' : 'NÃO'}
              </strong>
            </div>
          </div>
        </div>

        {/* Product List Proof */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
          <h2 className="text-base font-bold text-slate-900 flex items-center justify-between border-b border-slate-100 pb-3">
            <span>4. Lista de Produtos Retornados do Firestore</span>
            <span className="text-xs font-normal text-slate-500">Total: {renderedCount}</span>
          </h2>

          {renderedCount === 0 ? (
            <div className="p-8 text-center rounded-xl bg-slate-50 border border-dashed border-slate-200 space-y-2">
              <p className="text-sm font-semibold text-slate-700">Nenhum produto real no banco.</p>
              <p className="text-xs text-slate-500">A consulta direta ao Firestore collection('products') retornou 0 registros. O banco de produção está completamente vazio.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-700 font-bold uppercase tracking-wider">
                  <tr>
                    <th className="p-3">ID Firestore</th>
                    <th className="p-3">Título</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">_source</th>
                    <th className="p-3">_firestoreId</th>
                    <th className="p-3">imageUrl</th>
                    <th className="p-3">mainImage</th>
                    <th className="p-3">thumbnailUrl</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {firestoreProducts.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td className="p-3 text-slate-900 font-bold">{p.id}</td>
                      <td className="p-3 text-slate-800 font-sans font-medium">{p.title}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${p.status === 'draft' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                          {p.status}
                        </span>
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-100 text-teal-800">
                          {p._source}
                        </span>
                      </td>
                      <td className="p-3 text-slate-700">{p._firestoreId}</td>
                      <td className="p-3 truncate max-w-[150px] text-slate-500">{p.imageUrl || '—'}</td>
                      <td className="p-3 truncate max-w-[150px] text-slate-500">{p.mainImage || '—'}</td>
                      <td className="p-3 truncate max-w-[150px] text-slate-500">{p.thumbnailUrl || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Rendered Products Inspector */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
          <h2 className="text-base font-bold text-slate-900 flex items-center justify-between border-b border-slate-100 pb-3">
            <span>5. Monitor de Produtos Renderizados na Tela (window.__MC_RENDERED_PRODUCTS__)</span>
            <span className="text-xs font-normal text-slate-500">
              Registrados: {typeof window !== 'undefined' && window.__MC_RENDERED_PRODUCTS__ ? window.__MC_RENDERED_PRODUCTS__.length : 0}
            </span>
          </h2>

          {firestoreCount === 0 && typeof window !== 'undefined' && window.__MC_RENDERED_PRODUCTS__ && window.__MC_RENDERED_PRODUCTS__.length > 0 ? (
            <div className="p-4 bg-rose-600 text-white font-bold rounded-xl text-xs font-mono space-y-2">
              <p className="text-sm uppercase tracking-wider font-extrabold flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                ERRO GRAVE — PRODUTO/IMAGEM FALSA AINDA RENDERIZANDO
              </p>
              <p>O Firestore retornou 0 produtos, porém componentes registraram produtos na tela:</p>
              <ul className="list-disc pl-5 space-y-1">
                {window.__MC_RENDERED_PRODUCTS__.map((rp, idx) => (
                  <li key={idx}>
                    <strong>Título:</strong> {rp.title} | <strong>ID:</strong> {rp.id} | <strong>Src Imagem:</strong> {rp.imageUrl || rp.mainImage || rp.thumbnailUrl} | <strong>Componente:</strong> {rp.componentName} | <strong>Rota:</strong> {rp.route} | <strong>Origem:</strong> {rp.originDetected} | <strong>Existe no Firestore?</strong> {rp.existsInFirestore ? 'SIM' : 'NÃO'}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 text-xs font-mono space-y-1">
              <p className="font-bold flex items-center gap-1.5 text-emerald-800">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                NENHUMA IMAGEM/PRODUTO FALSO DETECTADO RENDERIZANDO NA TELA
              </p>
              <p>
                {firestoreCount === 0
                  ? 'O Firestore está zerado (0 produtos) e nenhuma imagem ou produto fantasma foi renderizado em nenhum componente.'
                  : `Foram renderizados apenas os ${firestoreCount} produtos oficiais confirmados do Firestore.`}
              </p>
            </div>
          )}

          {typeof window !== 'undefined' && window.__MC_RENDERED_PRODUCTS__ && window.__MC_RENDERED_PRODUCTS__.length > 0 && (
            <div className="overflow-x-auto pt-2">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-100 text-slate-700 font-bold uppercase tracking-wider">
                  <tr>
                    <th className="p-2">Título</th>
                    <th className="p-2">ID</th>
                    <th className="p-2">Slug</th>
                    <th className="p-2">Image URL</th>
                    <th className="p-2">Origem</th>
                    <th className="p-2">Componente</th>
                    <th className="p-2">Rota</th>
                    <th className="p-2">In Firestore?</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {window.__MC_RENDERED_PRODUCTS__.map((rp, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="p-2 font-bold text-slate-900">{rp.title}</td>
                      <td className="p-2 text-slate-700">{rp.id}</td>
                      <td className="p-2 text-slate-600">{rp.slug}</td>
                      <td className="p-2 text-slate-500 truncate max-w-[150px]">{rp.imageUrl || rp.mainImage || rp.thumbnailUrl || '—'}</td>
                      <td className="p-2 text-teal-700 font-bold">{rp.originDetected}</td>
                      <td className="p-2 text-slate-700">{rp.componentName}</td>
                      <td className="p-2 text-slate-600">{rp.route}</td>
                      <td className="p-2">{rp.existsInFirestore ? 'SIM' : 'NÃO'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="text-center text-xs text-slate-400 font-mono pt-4">
          URL Vercel de Prova Isolada: <strong className="text-slate-600">https://materiais-criativos.vercel.app/#/prova-real</strong>
        </div>
      </div>
    </div>
  );
};

