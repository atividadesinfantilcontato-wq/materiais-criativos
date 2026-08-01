import React, { useState, useEffect } from 'react';
import { APP_BUILD_ID } from '../types';

export const VersionPage: React.FC = () => {
  const [metaBuildId, setMetaBuildId] = useState<string>('');
  const [hasSW, setHasSW] = useState<boolean>(false);
  const [hasCache, setHasCache] = useState<boolean>(false);
  const [localStorageKeys, setLocalStorageKeys] = useState<string[]>([]);
  const [sessionStorageKeys, setSessionStorageKeys] = useState<string[]>([]);
  const [cleaned, setCleaned] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const meta = document.querySelector('meta[name="app-build-id"]');
      setMetaBuildId(meta?.getAttribute('content') || 'não encontrado');

      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(regs => {
          setHasSW(regs.length > 0);
        }).catch(() => setHasSW(false));
      }

      if ('caches' in window) {
        caches.keys().then(keys => {
          setHasCache(keys.length > 0);
        }).catch(() => setHasCache(false));
      }

      try {
        setLocalStorageKeys(Object.keys(localStorage));
        setSessionStorageKeys(Object.keys(sessionStorage));
      } catch (e) {}
    }
  }, []);

  const handleClearBrowser = async () => {
    try {
      localStorage.clear();
      sessionStorage.clear();

      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map(key => caches.delete(key)));
      }

      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map(r => r.unregister()));
      }

      if ('indexedDB' in window && indexedDB.databases) {
        const dbs = await indexedDB.databases();
        dbs.forEach(db => {
          if (db.name) indexedDB.deleteDatabase(db.name);
        });
      }

      setCleaned(true);
      setTimeout(() => {
        window.location.href = window.location.pathname + '?force-clean=' + Date.now() + '#/versao';
      }, 500);
    } catch (e) {
      console.error('Erro ao limpar navegador:', e);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans p-4 sm:p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="border-b border-slate-800 pb-4">
          <h1 className="text-2xl font-black text-emerald-400 tracking-tight">VERSÃO ATUAL DO SITE</h1>
          <p className="text-xs text-slate-400 mt-1 font-mono">Diagnóstico de Build, Meta Tags e Cache do Navegador</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2">
            <span className="text-slate-500 uppercase block font-bold">Build ID</span>
            <p className="text-emerald-400 font-bold text-sm select-all">{APP_BUILD_ID}</p>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2">
            <span className="text-slate-500 uppercase block font-bold">Meta Tag app-build-id</span>
            <p className={`font-bold text-sm ${metaBuildId === APP_BUILD_ID ? 'text-emerald-400' : 'text-rose-400'}`}>
              {metaBuildId}
            </p>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2">
            <span className="text-slate-500 uppercase block font-bold">Host</span>
            <p className="text-slate-200">{typeof window !== 'undefined' ? window.location.host : '-'}</p>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2">
            <span className="text-slate-500 uppercase block font-bold">Data / Hora Build</span>
            <p className="text-slate-200">2026-07-31T21:30:00Z</p>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2 md:col-span-2">
            <span className="text-slate-500 uppercase block font-bold">URL Completa</span>
            <p className="text-slate-300 break-all">{typeof window !== 'undefined' ? window.location.href : '-'}</p>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2">
            <span className="text-slate-500 uppercase block font-bold">Service Worker Ativo</span>
            <p className={hasSW ? 'text-amber-400 font-bold' : 'text-emerald-400 font-bold'}>
              {hasSW ? 'SIM (Ativo)' : 'NÃO (Desativado)'}
            </p>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2">
            <span className="text-slate-500 uppercase block font-bold">CacheStorage Ativo</span>
            <p className={hasCache ? 'text-amber-400 font-bold' : 'text-emerald-400 font-bold'}>
              {hasCache ? 'SIM (Com itens)' : 'NÃO (Limpo)'}
            </p>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2 md:col-span-2">
            <span className="text-slate-500 uppercase block font-bold">localStorage Chaves ({localStorageKeys.length})</span>
            <p className="text-slate-400 break-all">
              {localStorageKeys.length > 0 ? localStorageKeys.join(', ') : 'Nenhuma chave encontrada'}
            </p>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2 md:col-span-2">
            <span className="text-slate-500 uppercase block font-bold">sessionStorage Chaves ({sessionStorageKeys.length})</span>
            <p className="text-slate-400 break-all">
              {sessionStorageKeys.length > 0 ? sessionStorageKeys.join(', ') : 'Nenhuma chave encontrada'}
            </p>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-800 flex flex-col items-center space-y-3">
          <button
            onClick={handleClearBrowser}
            className="w-full sm:w-auto px-6 py-3 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-sm transition-all shadow-lg cursor-pointer"
          >
            {cleaned ? 'NAVEGADOR LIMPO! RECARREGANDO...' : 'LIMPAR ESTE NAVEGADOR'}
          </button>
          <p className="text-[11px] text-slate-500 text-center max-w-md">
            Remove localStorage, sessionStorage, Service Workers e CacheStorage deste navegador local e recarrega forçadamente.
          </p>
        </div>
      </div>
    </div>
  );
};
