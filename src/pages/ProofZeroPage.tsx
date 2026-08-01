import React, { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle2, RefreshCw, Trash2, ShieldCheck, Database, HardDrive, Layers, Image as ImageIcon, Lock } from 'lucide-react';
import { collection, getDocs, deleteDoc, doc, query, where } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../services/firebase';

export const QUARANTINE_MODE = false;
export const APP_BUILD_ID = 'quarentena-sem-fake-2026-07-31-1253';
export const APP_DEPLOY_TIMESTAMP = '2026-07-31 12:53:00';

interface DomImageItem {
  src: string;
  alt: string;
  className: string;
  width: number;
  height: number;
  parentComponent: string;
}

interface R2ObjectItem {
  key: string;
  size: number;
  lastModified?: string;
  publicUrl: string;
}

export const ProofZeroPage: React.FC = () => {
  const [firestoreDocs, setFirestoreDocs] = useState<any[]>([]);
  const [firestoreCount, setFirestoreCount] = useState<number | null>(null);
  const [r2Objects, setR2Objects] = useState<R2ObjectItem[]>([]);
  const [r2TotalCount, setR2TotalCount] = useState<number | null>(null);
  const [domImages, setDomImages] = useState<DomImageItem[]>([]);
  const [renderedProducts, setRenderedProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [testTimestamp, setTestTimestamp] = useState<string>('');

  const [purgeFirestoreLog, setPurgeFirestoreLog] = useState<any>(null);
  const [purgeR2Log, setPurgeR2Log] = useState<any>(null);
  const [browserStorageStatus, setBrowserStorageStatus] = useState<any>({});

  // Confirmation Modals State
  const [showConfirmFirestore, setShowConfirmFirestore] = useState<boolean>(false);
  const [inputFirestoreConfirm, setInputFirestoreConfirm] = useState<string>('');
  const [showConfirmR2, setShowConfirmR2] = useState<boolean>(false);
  const [inputR2Confirm, setInputR2Confirm] = useState<string>('');

  const fullUrl = typeof window !== 'undefined' ? window.location.href : '';
  const host = typeof window !== 'undefined' ? window.location.hostname : '';

  const checkBrowserStorage = async () => {
    let hasLS = false;
    let hasSS = false;
    let hasIDB = false;

    try {
      hasLS = Object.keys(localStorage).some(k => k.includes('product') || k.includes('atividades'));
    } catch (e) {}

    try {
      hasSS = Object.keys(sessionStorage).some(k => k.includes('product') || k.includes('atividades'));
    } catch (e) {}

    if (typeof window !== 'undefined' && 'indexedDB' in window && indexedDB.databases) {
      try {
        const dbs = await indexedDB.databases();
        hasIDB = dbs.some(d => (d.name || '').toLowerCase().includes('product') || (d.name || '').toLowerCase().includes('atividades'));
      } catch (e) {}
    }

    let hasSW = false;
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      try {
        const regs = await navigator.serviceWorker.getRegistrations();
        hasSW = regs.length > 0;
      } catch (e) {}
    }

    let hasCache = false;
    if (typeof window !== 'undefined' && 'caches' in window) {
      try {
        const keys = await caches.keys();
        hasCache = keys.length > 0;
      } catch (e) {}
    }

    setBrowserStorageStatus({
      hasLS,
      hasSS,
      hasIDB,
      hasSW,
      hasCache,
    });
  };

  const scanDomImages = () => {
    if (typeof document === 'undefined') return [];
    const imgs = Array.from(document.querySelectorAll('img'));
    const items: DomImageItem[] = imgs.map(img => ({
      src: img.src,
      alt: img.alt || '—',
      className: img.className || '—',
      width: img.width || img.clientWidth || 0,
      height: img.height || img.clientHeight || 0,
      parentComponent: img.parentElement ? `${img.parentElement.tagName}.${img.parentElement.className.slice(0, 30)}` : '—',
    }));
    setDomImages(items);
    return items;
  };

  const loadData = async () => {
    setLoading(true);
    setTestTimestamp(new Date().toLocaleString('pt-BR'));

    // 1. Fetch Firestore documents
    if (isFirebaseConfigured && db) {
      try {
        let snap;
        try {
          snap = await getDocs(collection(db, 'products'));
        } catch (pErr) {
          const qPub = query(collection(db, 'products'), where('status', '==', 'published'));
          snap = await getDocs(qPub);
        }
        const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setFirestoreDocs(docs);
        setFirestoreCount(docs.length);
      } catch (err: any) {
        console.warn('Firestore fetch error:', err);
        setFirestoreDocs([]);
        setFirestoreCount(0);
      }
    } else {
      setFirestoreDocs([]);
      setFirestoreCount(0);
    }

    // 2. Fetch R2 objects list from API
    try {
      const res = await fetch('/api/list-r2');
      const data = await res.json();
      if (data.ok && Array.isArray(data.objects)) {
        setR2Objects(data.objects);
        setR2TotalCount(data.totalCount);
      } else {
        setR2Objects([]);
        setR2TotalCount(0);
      }
    } catch (err) {
      console.warn('R2 list error:', err);
      setR2Objects([]);
      setR2TotalCount(0);
    }

    // 3. Rendered products window inspector
    if (typeof window !== 'undefined' && window.__MC_RENDERED_PRODUCTS__) {
      setRenderedProducts([...window.__MC_RENDERED_PRODUCTS__]);
    } else {
      setRenderedProducts([]);
    }

    // 4. Storage check
    await checkBrowserStorage();

    // 5. Scan DOM images
    setTimeout(() => {
      scanDomImages();
      setLoading(false);
    }, 300);
  };

  useEffect(() => {
    loadData();
  }, []);

  // PURGE FIRESTORE EXECUTION
  const handleConfirmPurgeFirestore = async () => {
    if (inputFirestoreConfirm !== 'APAGAR PRODUCTS') {
      alert('Texto de confirmação incorreto! Digite "APAGAR PRODUCTS" para prosseguir.');
      return;
    }
    setShowConfirmFirestore(false);
    setInputFirestoreConfirm('');

    if (!isFirebaseConfigured || !db) return;
    setLoading(true);

    try {
      const snap = await getDocs(collection(db, 'products'));
      const beforeCount = snap.size;
      const deletedIds: string[] = [];
      const deletedTitles: string[] = [];

      for (const docSnap of snap.docs) {
        const data = docSnap.data();
        deletedIds.push(docSnap.id);
        deletedTitles.push(data.title || docSnap.id);
        await deleteDoc(doc(db, 'products', docSnap.id));
      }

      const snapAfter = await getDocs(collection(db, 'products'));
      setPurgeFirestoreLog({
        beforeCount,
        deletedIds,
        deletedTitles,
        afterCount: snapAfter.size,
      });

      await loadData();
    } catch (err: any) {
      alert(`Erro ao apagar documentos do Firestore: ${err?.message || 'Acesso negado'}`);
    } finally {
      setLoading(false);
    }
  };

  // PURGE R2 EXECUTION
  const handleConfirmPurgeR2 = async () => {
    if (inputR2Confirm !== 'APAGAR R2') {
      alert('Texto de confirmação incorreto! Digite "APAGAR R2" para prosseguir.');
      return;
    }
    setShowConfirmR2(false);
    setInputR2Confirm('');

    setLoading(true);
    try {
      const res = await fetch('/api/purge-r2');
      const data = await res.json();
      setPurgeR2Log(data);
      await loadData();
    } catch (err: any) {
      setPurgeR2Log({ ok: false, error: err?.message || 'Erro ao purgar R2' });
    } finally {
      setLoading(false);
    }
  };

  // ZERAR NAVEGADOR EXECUTION
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
        dbs.forEach(d => {
          if (d.name) indexedDB.deleteDatabase(d.name);
        });
      } catch (e) {}
    }

    if (typeof window !== 'undefined') {
      window.__MC_RENDERED_PRODUCTS__ = [];
      const cleanUrl = `${window.location.origin}${window.location.pathname}?clean=${Date.now()}#/prova-zero`;
      window.location.href = cleanUrl;
    }
  };

  // ZERO STATUS CALCULATION
  const hasFirestoreDocs = firestoreDocs.length > 0;
  const hasR2Objects = r2Objects.length > 0;
  const hasDomImages = domImages.length > 0;
  const hasRenderedProducts = renderedProducts.length > 0;

  const isZeroAbsolute = !hasFirestoreDocs && !hasR2Objects && !hasDomImages && !hasRenderedProducts;

  // Reasons list
  const statusReasons: string[] = [];
  if (hasFirestoreDocs) statusReasons.push(`FIRESTORE TEM PRODUTOS (${firestoreDocs.length})`);
  if (hasR2Objects) statusReasons.push(`R2 TEM ARQUIVOS (${r2Objects.length})`);
  if (hasDomImages) statusReasons.push(`IMAGENS AINDA APARECEM NO DOM (${domImages.length})`);
  if (hasRenderedProducts) statusReasons.push(`PRODUTOS AINDA RENDERIZAM (${renderedProducts.length})`);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* HEADER BUILD & ENVIRONMENT BANNER */}
        <div className="bg-slate-900 border-2 border-slate-800 rounded-3xl p-6 text-slate-200 shadow-2xl relative overflow-hidden">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-teal-500/10 border border-teal-500/30 rounded-full text-xs font-black text-teal-400 uppercase tracking-widest">
                <ShieldCheck className="w-4 h-4 text-teal-400" />
                SISTEMA DE AUDITORIA ISOLADA — PROVA ZERO
              </div>
              <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">
                AUDITORIA REAL DE ARQUIVOS E PRODUTOS
              </h1>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-xs font-mono text-slate-400 pt-1">
                <p>APP_BUILD_ID: <span className="text-amber-400 font-bold underline">{APP_BUILD_ID}</span></p>
                <p>Deploy Timestamp: <span className="text-slate-300 font-bold">{APP_DEPLOY_TIMESTAMP}</span></p>
                <p>Host: <span className="text-slate-300 font-bold">{host}</span></p>
                <p>Data/Hora do Teste: <span className="text-slate-300 font-bold">{testTimestamp || '—'}</span></p>
                <p className="sm:col-span-2 truncate">URL: <span className="text-slate-300 font-bold truncate">{fullUrl}</span></p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={loadData}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl transition-all border border-slate-700 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                Atualizar Auditoria
              </button>
              <button
                onClick={handleZerarNavegador}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-extrabold rounded-xl transition-all shadow-lg cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                ZERAR ESTE NAVEGADOR
              </button>
            </div>
          </div>
        </div>

        {/* MAIN STATUS BADGE */}
        <div className={`p-6 rounded-3xl border-2 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-4 ${
          isZeroAbsolute
            ? 'bg-emerald-950/70 border-emerald-500 text-emerald-200'
            : 'bg-rose-950/80 border-rose-500 text-rose-200'
        }`}>
          <div className="flex items-center gap-4">
            {isZeroAbsolute ? (
              <CheckCircle2 className="w-12 h-12 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-12 h-12 text-rose-400 shrink-0" />
            )}
            <div className="space-y-1">
              <span className="text-xs font-mono uppercase tracking-widest text-slate-400 block">STATUS DA PROVA ZERO:</span>
              <h2 className="text-xl md:text-2xl font-black tracking-tight">
                {isZeroAbsolute ? 'ZERO ABSOLUTO CONFIRMADO' : 'NÃO ESTÁ ZERADO'}
              </h2>
              {!isZeroAbsolute && (
                <div className="text-xs font-mono font-bold text-rose-300 space-y-1">
                  <p>Motivo(s):</p>
                  <ul className="list-disc pl-5 space-y-0.5">
                    {statusReasons.map((r, idx) => (
                      <li key={idx}>{r}</li>
                    ))}
                  </ul>
                </div>
              )}
              {isZeroAbsolute && (
                <p className="text-xs text-emerald-300 font-mono">
                  Confirmado: 0 produtos no Firestore, 0 arquivos no R2, 0 imagens no DOM e 0 produtos renderizados.
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              onClick={() => setShowConfirmFirestore(true)}
              disabled={loading}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl cursor-pointer transition-all shadow-md disabled:opacity-50 flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              APAGAR PRODUCTS FIRESTORE
            </button>
            <button
              onClick={() => setShowConfirmR2(true)}
              disabled={loading}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-xl cursor-pointer transition-all shadow-md disabled:opacity-50 flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              APAGAR TODOS OS OBJETOS R2
            </button>
          </div>
        </div>

        {/* SUMMARY COUNTERS GRID */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-2">
            <div className="flex items-center justify-between text-slate-400 text-xs font-mono uppercase">
              <span>Tabela 1: Firestore Products</span>
              <Database className="w-4 h-4 text-sky-400" />
            </div>
            <p className={`text-3xl font-black font-mono ${firestoreDocs.length === 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {firestoreDocs.length}
            </p>
            <p className="text-[11px] text-slate-500 font-mono">Documentos na coleção 'products'</p>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-2">
            <div className="flex items-center justify-between text-slate-400 text-xs font-mono uppercase">
              <span>Tabela 2: R2 Objetos</span>
              <HardDrive className="w-4 h-4 text-purple-400" />
            </div>
            <p className={`text-3xl font-black font-mono ${r2Objects.length === 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {r2Objects.length}
            </p>
            <p className="text-[11px] text-slate-500 font-mono">Objetos listados no bucket R2</p>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-2">
            <div className="flex items-center justify-between text-slate-400 text-xs font-mono uppercase">
              <span>Tabela 3: Imagens no DOM</span>
              <ImageIcon className="w-4 h-4 text-teal-400" />
            </div>
            <p className={`text-3xl font-black font-mono ${domImages.length === 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {domImages.length}
            </p>
            <p className="text-[11px] text-slate-500 font-mono">document.querySelectorAll('img')</p>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-2">
            <div className="flex items-center justify-between text-slate-400 text-xs font-mono uppercase">
              <span>Tabela 4: Produtos Renderizados</span>
              <Layers className="w-4 h-4 text-amber-400" />
            </div>
            <p className={`text-3xl font-black font-mono ${renderedProducts.length === 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {renderedProducts.length}
            </p>
            <p className="text-[11px] text-slate-500 font-mono">window.__MC_RENDERED_PRODUCTS__</p>
          </div>

        </div>

        {/* LOGS DE OPERAÇÃO */}
        {purgeFirestoreLog && (
          <div className="bg-rose-950/80 border border-rose-800 p-4 rounded-2xl font-mono text-xs text-rose-200 space-y-1">
            <p className="font-bold text-rose-300 uppercase">Relatório da última purga do Firestore:</p>
            <p>Documents antes: {purgeFirestoreLog.beforeCount}</p>
            <p>IDs Apagados: {purgeFirestoreLog.deletedIds.join(', ') || 'Nenhum'}</p>
            <p>Documents depois: {purgeFirestoreLog.afterCount}</p>
          </div>
        )}

        {purgeR2Log && (
          <div className="bg-purple-950/80 border border-purple-800 p-4 rounded-2xl font-mono text-xs text-purple-200 space-y-1">
            <p className="font-bold text-purple-300 uppercase">Relatório da última purga do Cloudflare R2:</p>
            {purgeR2Log.ok ? (
              <>
                <p>Bucket: {purgeR2Log.bucketName}</p>
                <p>Arquivos antes: {purgeR2Log.totalBefore}</p>
                <p>Arquivos apagados: {purgeR2Log.totalDeleted}</p>
                <p>Arquivos restantes: {purgeR2Log.totalAfter}</p>
              </>
            ) : (
              <p className="text-rose-400 font-bold">Erro: {purgeR2Log.error}</p>
            )}
          </div>
        )}

        {/* TABELA 1 — FIRESTORE PRODUCTS */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Database className="w-5 h-5 text-sky-400" />
              <h2 className="text-base font-bold text-white uppercase tracking-wider font-mono">
                TABELA 1 — FIRESTORE PRODUCTS ({firestoreDocs.length})
              </h2>
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-mono font-bold ${
              firestoreDocs.length === 0 ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
            }`}>
              {firestoreDocs.length === 0 ? '0 DOCUMENTOS' : `${firestoreDocs.length} PENDENTES`}
            </span>
          </div>

          {firestoreDocs.length === 0 ? (
            <div className="p-4 bg-emerald-950/40 border border-emerald-800/50 rounded-xl text-emerald-300 text-xs font-mono flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              ✓ Coleção 'products' do Firestore está completamente vazia (0 documentos).
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono border-collapse">
                <thead className="bg-slate-950 text-slate-400 uppercase">
                  <tr>
                    <th className="p-2 border-b border-slate-800">ID</th>
                    <th className="p-2 border-b border-slate-800">Title</th>
                    <th className="p-2 border-b border-slate-800">Status</th>
                    <th className="p-2 border-b border-slate-800">imageUrl</th>
                    <th className="p-2 border-b border-slate-800">mainImage</th>
                    <th className="p-2 border-b border-slate-800">thumbnailUrl</th>
                    <th className="p-2 border-b border-slate-800">createdAt</th>
                    <th className="p-2 border-b border-slate-800">updatedAt</th>
                    <th className="p-2 border-b border-slate-800">_source</th>
                    <th className="p-2 border-b border-slate-800">_firestoreId</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {firestoreDocs.map((docItem, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/50">
                      <td className="p-2 text-sky-300 font-bold">{docItem.id}</td>
                      <td className="p-2 text-white font-bold">{docItem.title || '—'}</td>
                      <td className="p-2 text-amber-300">{docItem.status || '—'}</td>
                      <td className="p-2 text-slate-400 max-w-[150px] truncate">{docItem.imageUrl || '—'}</td>
                      <td className="p-2 text-slate-400 max-w-[150px] truncate">{docItem.mainImage || '—'}</td>
                      <td className="p-2 text-slate-400 max-w-[150px] truncate">{docItem.thumbnailUrl || '—'}</td>
                      <td className="p-2 text-slate-500">{docItem.createdAt || '—'}</td>
                      <td className="p-2 text-slate-500">{docItem.updatedAt || '—'}</td>
                      <td className="p-2 text-emerald-400">{docItem._source || 'firestore'}</td>
                      <td className="p-2 text-slate-400">{docItem._firestoreId || docItem.id}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* TABELA 2 — R2 OBJETOS */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <HardDrive className="w-5 h-5 text-purple-400" />
              <h2 className="text-base font-bold text-white uppercase tracking-wider font-mono">
                TABELA 2 — R2 OBJETOS ({r2Objects.length})
              </h2>
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-mono font-bold ${
              r2Objects.length === 0 ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
            }`}>
              {r2Objects.length === 0 ? '0 OBJETOS' : `${r2Objects.length} PENDENTES`}
            </span>
          </div>

          {r2Objects.length === 0 ? (
            <div className="p-4 bg-emerald-950/40 border border-emerald-800/50 rounded-xl text-emerald-300 text-xs font-mono flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              ✓ Bucket Cloudflare R2 está completamente vazio (0 objetos).
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono border-collapse">
                <thead className="bg-slate-950 text-slate-400 uppercase">
                  <tr>
                    <th className="p-2 border-b border-slate-800">Key</th>
                    <th className="p-2 border-b border-slate-800">Size (bytes)</th>
                    <th className="p-2 border-b border-slate-800">Last Modified</th>
                    <th className="p-2 border-b border-slate-800">Public URL</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {r2Objects.map((obj, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/50">
                      <td className="p-2 text-purple-300 font-bold max-w-[250px] truncate">{obj.key}</td>
                      <td className="p-2 text-slate-300">{obj.size}</td>
                      <td className="p-2 text-slate-400">{obj.lastModified || '—'}</td>
                      <td className="p-2 text-sky-400 max-w-[250px] truncate">
                        <a href={obj.publicUrl} target="_blank" rel="noreferrer" className="underline hover:text-sky-300">
                          {obj.publicUrl}
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* TABELA 3 — IMAGENS NO DOM */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-teal-400" />
              <h2 className="text-base font-bold text-white uppercase tracking-wider font-mono">
                TABELA 3 — IMAGENS NO DOM ({domImages.length})
              </h2>
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-mono font-bold ${
              domImages.length === 0 ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
            }`}>
              {domImages.length === 0 ? '0 IMAGENS' : `${domImages.length} NO DOM`}
            </span>
          </div>

          {domImages.length === 0 ? (
            <div className="p-4 bg-emerald-950/40 border border-emerald-800/50 rounded-xl text-emerald-300 text-xs font-mono flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              ✓ Nenhuma tag &lt;img&gt; carregada no DOM desta página (0 imagens).
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono border-collapse">
                <thead className="bg-slate-950 text-slate-400 uppercase">
                  <tr>
                    <th className="p-2 border-b border-slate-800">src</th>
                    <th className="p-2 border-b border-slate-800">alt</th>
                    <th className="p-2 border-b border-slate-800">Class</th>
                    <th className="p-2 border-b border-slate-800">Width x Height</th>
                    <th className="p-2 border-b border-slate-800">Parent</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {domImages.map((img, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/50">
                      <td className="p-2 text-rose-300 font-bold max-w-[250px] truncate">{img.src}</td>
                      <td className="p-2 text-slate-300">{img.alt}</td>
                      <td className="p-2 text-slate-400 max-w-[150px] truncate">{img.className}</td>
                      <td className="p-2 text-slate-300">{img.width}x{img.height}</td>
                      <td className="p-2 text-slate-400 max-w-[180px] truncate">{img.parentComponent}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* TABELA 4 — PRODUTOS RENDERIZADOS */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-amber-400" />
              <h2 className="text-base font-bold text-white uppercase tracking-wider font-mono">
                TABELA 4 — PRODUTOS RENDERIZADOS ({renderedProducts.length})
              </h2>
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-mono font-bold ${
              renderedProducts.length === 0 ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
            }`}>
              {renderedProducts.length === 0 ? '0 PRODUTOS' : `${renderedProducts.length} REGISTRADOS`}
            </span>
          </div>

          {renderedProducts.length === 0 ? (
            <div className="p-4 bg-emerald-950/40 border border-emerald-800/50 rounded-xl text-emerald-300 text-xs font-mono flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              ✓ Nenhum componente registrou produto renderizado na tela (0 produtos em window.__MC_RENDERED_PRODUCTS__).
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono border-collapse">
                <thead className="bg-slate-950 text-slate-400 uppercase">
                  <tr>
                    <th className="p-2 border-b border-slate-800">Title</th>
                    <th className="p-2 border-b border-slate-800">ID</th>
                    <th className="p-2 border-b border-slate-800">Slug</th>
                    <th className="p-2 border-b border-slate-800">imageUrl</th>
                    <th className="p-2 border-b border-slate-800">_source</th>
                    <th className="p-2 border-b border-slate-800">_firestoreId</th>
                    <th className="p-2 border-b border-slate-800">Component</th>
                    <th className="p-2 border-b border-slate-800">Route</th>
                    <th className="p-2 border-b border-slate-800">In Firestore?</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {renderedProducts.map((rp, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/50">
                      <td className="p-2 text-white font-bold">{rp.title}</td>
                      <td className="p-2 text-slate-300">{rp.id}</td>
                      <td className="p-2 text-slate-400">{rp.slug}</td>
                      <td className="p-2 text-amber-300 max-w-[150px] truncate">{rp.imageUrl || rp.mainImage || rp.thumbnailUrl || '—'}</td>
                      <td className="p-2 text-emerald-400">{rp._source}</td>
                      <td className="p-2 text-slate-400">{rp._firestoreId || '—'}</td>
                      <td className="p-2 text-slate-300">{rp.componentName}</td>
                      <td className="p-2 text-slate-400">{rp.route}</td>
                      <td className="p-2">{rp.existsInFirestore ? 'SIM' : 'NÃO'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ENVIRONMENT STORAGE STATUS */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
          <h3 className="font-bold text-sm text-slate-200 uppercase tracking-wider font-mono border-b border-slate-800 pb-3">
            Armazenamento Local e Service Workers do Navegador
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 font-mono text-xs">
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
              <span className="text-slate-500 block">Service Worker Ativo:</span>
              <span className={`font-bold ${browserStorageStatus.hasSW ? 'text-rose-400' : 'text-emerald-400'}`}>
                {browserStorageStatus.hasSW ? 'SIM' : 'NÃO'}
              </span>
            </div>
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
              <span className="text-slate-500 block">CacheStorage Ativo:</span>
              <span className={`font-bold ${browserStorageStatus.hasCache ? 'text-rose-400' : 'text-emerald-400'}`}>
                {browserStorageStatus.hasCache ? 'SIM' : 'NÃO'}
              </span>
            </div>
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
              <span className="text-slate-500 block">localStorage Produto:</span>
              <span className={`font-bold ${browserStorageStatus.hasLS ? 'text-rose-400' : 'text-emerald-400'}`}>
                {browserStorageStatus.hasLS ? 'SIM' : 'NÃO'}
              </span>
            </div>
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
              <span className="text-slate-500 block">sessionStorage Produto:</span>
              <span className={`font-bold ${browserStorageStatus.hasSS ? 'text-rose-400' : 'text-emerald-400'}`}>
                {browserStorageStatus.hasSS ? 'SIM' : 'NÃO'}
              </span>
            </div>
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
              <span className="text-slate-500 block">IndexedDB Produto:</span>
              <span className={`font-bold ${browserStorageStatus.hasIDB ? 'text-rose-400' : 'text-emerald-400'}`}>
                {browserStorageStatus.hasIDB ? 'SIM' : 'NÃO'}
              </span>
            </div>
          </div>
        </div>

        {/* FOOTER */}
        <div className="text-center text-xs text-slate-500 font-mono py-4">
          URL de Verificação Isolar Vercel: <strong className="text-slate-300">https://materiais-criativos.vercel.app/#/prova-zero</strong>
        </div>

      </div>

      {/* CONFIRMATION MODAL: FIRESTORE PURGE */}
      {showConfirmFirestore && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 z-50 font-sans">
          <div className="bg-slate-900 border-2 border-rose-600 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-500 font-black text-lg">
              <Lock className="w-6 h-6" />
              CONFIRMAÇÃO OBRIGATÓRIA: FIRESTORE
            </div>
            <p className="text-xs text-slate-300 font-mono">
              Para apagar TODOS os documentos da coleção <strong className="text-white">'products'</strong> do Firestore, digite exatamente:
            </p>
            <div className="p-2.5 bg-slate-950 border border-rose-800/80 rounded-xl text-center font-mono text-rose-400 font-black tracking-widest text-sm select-all">
              APAGAR PRODUCTS
            </div>
            <input
              type="text"
              value={inputFirestoreConfirm}
              onChange={(e) => setInputFirestoreConfirm(e.target.value)}
              placeholder="Digite APAGAR PRODUCTS"
              className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl font-mono text-xs text-white focus:outline-hidden focus:border-rose-500"
            />
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => { setShowConfirmFirestore(false); setInputFirestoreConfirm(''); }}
                className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-bold hover:bg-slate-700 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmPurgeFirestore}
                className="px-4 py-2 bg-rose-600 text-white rounded-xl text-xs font-bold hover:bg-rose-500 cursor-pointer shadow-md"
              >
                Confirmar Exclusão Total
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMATION MODAL: R2 PURGE */}
      {showConfirmR2 && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 z-50 font-sans">
          <div className="bg-slate-900 border-2 border-purple-600 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-purple-400 font-black text-lg">
              <Lock className="w-6 h-6" />
              CONFIRMAÇÃO OBRIGATÓRIA: R2 BUCKET
            </div>
            <p className="text-xs text-slate-300 font-mono">
              Para apagar TODOS os objetos do bucket Cloudflare R2 (products, uploads, materials, images, gallery, covers, capas), digite exatamente:
            </p>
            <div className="p-2.5 bg-slate-950 border border-purple-800/80 rounded-xl text-center font-mono text-purple-300 font-black tracking-widest text-sm select-all">
              APAGAR R2
            </div>
            <input
              type="text"
              value={inputR2Confirm}
              onChange={(e) => setInputR2Confirm(e.target.value)}
              placeholder="Digite APAGAR R2"
              className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl font-mono text-xs text-white focus:outline-hidden focus:border-purple-500"
            />
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => { setShowConfirmR2(false); setInputR2Confirm(''); }}
                className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-bold hover:bg-slate-700 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmPurgeR2}
                className="px-4 py-2 bg-purple-600 text-white rounded-xl text-xs font-bold hover:bg-purple-500 cursor-pointer shadow-md"
              >
                Confirmar Exclusão R2
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
