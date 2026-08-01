import React, { useState, useEffect } from 'react';
import { collection, getDocs, doc, setDoc, deleteDoc, getDoc, query } from 'firebase/firestore';
import { db, auth, isFirebaseConfigured, app } from '../services/firebase';
import { APP_BUILD_ID } from '../types';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Database,
  Server,
  ShieldCheck,
  Globe,
  Upload,
  Play,
  Lock,
  Layers
} from 'lucide-react';

export const CheckConexaoPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [testTime, setTestTime] = useState<string>('');

  // Environment checks
  const href = typeof window !== 'undefined' ? window.location.href : '';
  const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
  const isOfficialSite = hostname.includes('materiaiscriativos.com.br');
  const isVercel = hostname.includes('vercel.app') || isOfficialSite;
  const isStudioPreview = hostname.includes('run.app') || hostname.includes('ai.studio');
  const isLocalhost = hostname.includes('localhost') || hostname === '127.0.0.1';

  // Firebase Env Vars
  const apiKeyRaw = import.meta.env.VITE_FIREBASE_API_KEY || '';
  const apiKeyMasked = apiKeyRaw.length > 4 ? `PRESENTE (...${apiKeyRaw.slice(-4)})` : 'AUSENTE';
  const authDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'AUSENTE';
  const projectIdEnv = import.meta.env.VITE_FIREBASE_PROJECT_ID || 'AUSENTE';
  const databaseIdEnv = import.meta.env.VITE_FIREBASE_DATABASE_ID || 'AUSENTE';
  const messagingSenderId = import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ? 'PRESENTE' : 'AUSENTE';
  const appId = import.meta.env.VITE_FIREBASE_APP_ID ? 'PRESENTE' : 'AUSENTE';

  // Initialized Options
  const appProjectId = app?.options?.projectId || 'NÃO INICIALIZADO';
  const firestoreProjectId = db?.app?.options?.projectId || 'NÃO INICIALIZADO';
  const authProjectId = auth?.app?.options?.projectId || 'NÃO INICIALIZADO';

  const isProjectIdCorrect =
    appProjectId === 'materiais-criativos' &&
    firestoreProjectId === 'materiais-criativos' &&
    authProjectId === 'materiais-criativos';

  // Firestore Read state
  const [firestoreReadOk, setFirestoreReadOk] = useState<boolean | null>(null);
  const [totalProducts, setTotalProducts] = useState<number>(0);
  const [totalPublished, setTotalPublished] = useState<number>(0);
  const [firestoreReadError, setFirestoreReadError] = useState<string | null>(null);

  // Auth & Admin state
  const currentUser = auth?.currentUser;
  const isLoggedIn = Boolean(currentUser);
  const userUid = currentUser?.uid || 'Não autenticado';
  const [isAdminDocFound, setIsAdminDocFound] = useState<boolean | null>(null);
  const [isAdminActive, setIsAdminActive] = useState<boolean | null>(null);

  // Firestore Write test state
  const [testingWrite, setTestingWrite] = useState<boolean>(false);
  const [writeCreated, setWriteCreated] = useState<boolean | null>(null);
  const [writeRead, setWriteRead] = useState<boolean | null>(null);
  const [writeDeleted, setWriteDeleted] = useState<boolean | null>(null);
  const [writeError, setWriteError] = useState<string | null>(null);

  // R2 Backend check state
  const [r2Data, setR2Data] = useState<any>(null);
  const [r2Loading, setR2Loading] = useState<boolean>(true);
  const [r2UrlProbeOk, setR2UrlProbeOk] = useState<boolean | null>(null);
  const [r2ProbeStatus, setR2ProbeStatus] = useState<number | null>(null);

  const runAllChecks = async () => {
    setLoading(true);
    setTestTime(new Date().toLocaleString('pt-BR'));

    // 1. Check Firestore Read
    if (isFirebaseConfigured && db) {
      try {
        const q = query(collection(db, 'products'));
        const snapshot = await getDocs(q);
        setFirestoreReadOk(true);
        setTotalProducts(snapshot.size);
        let pubCount = 0;
        snapshot.forEach(docSnap => {
          if (docSnap.data().status === 'published') pubCount++;
        });
        setTotalPublished(pubCount);
        setFirestoreReadError(null);
      } catch (err: any) {
        setFirestoreReadOk(false);
        setFirestoreReadError(err?.message || 'Erro na leitura Firestore');
      }

      // Check Admin doc if logged in
      if (currentUser?.uid) {
        try {
          const adminDocRef = doc(db, 'admins', currentUser.uid);
          const adminSnap = await getDoc(adminDocRef);
          if (adminSnap.exists()) {
            setIsAdminDocFound(true);
            const data = adminSnap.data();
            setIsAdminActive(data.active !== false && (data.role === 'admin' || data.role === 'superadmin'));
          } else {
            setIsAdminDocFound(false);
            setIsAdminActive(false);
          }
        } catch (adminErr) {
          setIsAdminDocFound(false);
          setIsAdminActive(false);
        }
      } else {
        setIsAdminDocFound(null);
        setIsAdminActive(null);
      }
    } else {
      setFirestoreReadOk(false);
      setFirestoreReadError('Firebase não configurado no cliente');
    }

    // 2. Check R2 API
    await checkR2Connection();

    setLoading(false);
  };

  const checkR2Connection = async () => {
    setR2Loading(true);
    try {
      const res = await fetch('/api/check-r2');
      const data = await res.json();
      setR2Data(data);

      if (data?.generatedUrl) {
        try {
          const probe = await fetch(data.generatedUrl, { method: 'GET' });
          setR2ProbeStatus(probe.status);
          setR2UrlProbeOk(probe.ok || probe.status === 200);
        } catch (probeErr) {
          setR2ProbeStatus(0);
          setR2UrlProbeOk(false);
        }
      } else {
        setR2UrlProbeOk(null);
        setR2ProbeStatus(null);
      }
    } catch (err: any) {
      setR2Data({
        ok: false,
        error: err?.message || 'Não foi possível se conectar com /api/check-r2',
      });
      setR2UrlProbeOk(false);
    } finally {
      setR2Loading(false);
    }
  };

  const executeFirestoreWriteTest = async () => {
    if (!isFirebaseConfigured || !db) {
      setWriteError('Firebase não configurado');
      return;
    }

    setTestingWrite(true);
    setWriteCreated(null);
    setWriteRead(null);
    setWriteDeleted(null);
    setWriteError(null);

    const testDocId = '__connection_test__';
    const testDocRef = doc(db, 'products', testDocId);

    try {
      // 1. Create doc
      const payload = {
        title: '__CONNECTION_TEST__',
        status: 'draft',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        connectionTest: true,
      };
      await setDoc(testDocRef, payload, { merge: true });
      setWriteCreated(true);

      // 2. Read doc back
      const snap = await getDoc(testDocRef);
      if (snap.exists() && snap.data().title === '__CONNECTION_TEST__') {
        setWriteRead(true);
      } else {
        setWriteRead(false);
      }

      // 3. Delete doc
      await deleteDoc(testDocRef);
      setWriteDeleted(true);
    } catch (err: any) {
      setWriteError(err?.message || 'Erro durante o teste de escrita Firestore');
      if (writeCreated === null) setWriteCreated(false);
      if (writeRead === null) setWriteRead(false);
      if (writeDeleted === null) setWriteDeleted(false);
    } finally {
      setTestingWrite(false);
      // Refresh count
      const q = query(collection(db, 'products'));
      const snapshot = await getDocs(q);
      setTotalProducts(snapshot.size);
    }
  };

  useEffect(() => {
    runAllChecks();
  }, []);

  const overallStatusOk =
    isProjectIdCorrect &&
    firestoreReadOk &&
    r2Data?.ok &&
    r2Data?.uploadOk;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 md:p-10 font-sans">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* HEADER */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-teal-500/10 text-teal-400 border border-teal-500/20">
                AUDITORIA DE INFRAESTRUTURA
              </span>
              <span className="text-xs text-slate-500 font-mono">BUILD ID: {APP_BUILD_ID}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
              <Server className="w-7 h-7 text-teal-400" />
              CHECK DE CONEXÃO REAL
            </h1>
            <p className="text-slate-400 text-xs sm:text-sm mt-1">
              Validação das variáveis e serviços em tempo real (Vercel + Firebase Firestore + Cloudflare R2).
            </p>
          </div>

          <button
            onClick={runAllChecks}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2.5 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold rounded-xl transition-all shadow-lg active:scale-95 cursor-pointer text-xs disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Atualizar Diagnóstico
          </button>
        </div>

        {/* OVERALL BANNER */}
        <div className={`p-4 sm:p-6 rounded-2xl border flex items-start gap-4 shadow-xl ${
          overallStatusOk
            ? 'bg-emerald-950/40 border-emerald-800/80 text-emerald-200'
            : 'bg-amber-950/40 border-amber-800/80 text-amber-200'
        }`}>
          {overallStatusOk ? (
            <CheckCircle2 className="w-8 h-8 text-emerald-400 shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="w-8 h-8 text-amber-400 shrink-0 mt-0.5" />
          )}
          <div className="space-y-1">
            <h2 className="text-lg font-extrabold tracking-wide">
              STATUS DA CONEXÃO: {overallStatusOk ? 'CONEXÃO 100% REAL CONFIRMADA' : 'ATENÇÃO — REVISAR AMBIENTE E PERMISSÕES'}
            </h2>
            <p className="text-xs sm:text-sm opacity-90 leading-relaxed">
              {overallStatusOk
                ? 'Todos os serviços críticos (Frontend Firebase config, Firestore DB "materiais-criativos", e API Backend Cloudflare R2) estão ativos e validados em tempo real.'
                : 'O teste de diagnóstico identificou pendências de variáveis ou de autenticação. Verifique os blocos abaixo.'}
            </p>
            <p className="text-[11px] font-mono opacity-70">Data/Hora do teste: {testTime}</p>
          </div>
        </div>

        {/* GRID OF DIAGNOSTICS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* 1. AMBIENTE ATUAL */}
          <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl space-y-4 shadow-md">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
              <Globe className="w-5 h-5 text-teal-400" />
              <h3 className="font-bold text-sm text-slate-200 uppercase tracking-wider">1. Ambiente Atual</h3>
            </div>
            <div className="space-y-2 text-xs font-mono">
              <div className="flex justify-between border-b border-slate-800/50 pb-1.5">
                <span className="text-slate-400">Host:</span>
                <span className="text-slate-200 font-bold">{hostname}</span>
              </div>
              <div className="flex justify-between border-b border-slate-800/50 pb-1.5">
                <span className="text-slate-400">É site oficial?</span>
                <span className={`font-bold ${isOfficialSite ? 'text-emerald-400' : 'text-slate-400'}`}>
                  {isOfficialSite ? 'SIM' : 'NÃO'}
                </span>
              </div>
              <div className="flex justify-between border-b border-slate-800/50 pb-1.5">
                <span className="text-slate-400">É Vercel real?</span>
                <span className={`font-bold ${isVercel ? 'text-emerald-400' : 'text-slate-400'}`}>
                  {isVercel ? 'SIM' : 'NÃO'}
                </span>
              </div>
              <div className="flex justify-between border-b border-slate-800/50 pb-1.5">
                <span className="text-slate-400">É Google Studio preview?</span>
                <span className={`font-bold ${isStudioPreview ? 'text-amber-400' : 'text-slate-400'}`}>
                  {isStudioPreview ? 'SIM' : 'NÃO'}
                </span>
              </div>
              <div className="flex justify-between border-b border-slate-800/50 pb-1.5">
                <span className="text-slate-400">É Localhost?</span>
                <span className={`font-bold ${isLocalhost ? 'text-sky-400' : 'text-slate-400'}`}>
                  {isLocalhost ? 'SIM' : 'NÃO'}
                </span>
              </div>
              <div className="pt-1">
                <span className="text-slate-400 block text-[10px] mb-1">URL Completa:</span>
                <div className="bg-slate-950 p-2 rounded-lg text-slate-300 break-all text-[11px] border border-slate-800">
                  {href}
                </div>
              </div>
            </div>
          </div>

          {/* 2. VARIÁVEIS FIREBASE FRONTEND */}
          <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl space-y-4 shadow-md">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
              <Lock className="w-5 h-5 text-teal-400" />
              <h3 className="font-bold text-sm text-slate-200 uppercase tracking-wider">2. Variáveis Firebase Frontend</h3>
            </div>
            <div className="space-y-2 text-xs font-mono">
              <div className="flex justify-between border-b border-slate-800/50 pb-1.5">
                <span className="text-slate-400">VITE_FIREBASE_API_KEY:</span>
                <span className={`font-bold ${apiKeyRaw ? 'text-emerald-400' : 'text-rose-400'}`}>{apiKeyMasked}</span>
              </div>
              <div className="flex justify-between border-b border-slate-800/50 pb-1.5">
                <span className="text-slate-400">VITE_FIREBASE_AUTH_DOMAIN:</span>
                <span className="text-slate-200 font-bold">{authDomain}</span>
              </div>
              <div className="flex justify-between border-b border-slate-800/50 pb-1.5">
                <span className="text-slate-400">VITE_FIREBASE_PROJECT_ID:</span>
                <span className={`font-bold ${projectIdEnv === 'materiais-criativos' ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {projectIdEnv}
                </span>
              </div>
              <div className="flex justify-between border-b border-slate-800/50 pb-1.5">
                <span className="text-slate-400">VITE_FIREBASE_DATABASE_ID:</span>
                <span className="text-slate-200 font-bold">{databaseIdEnv}</span>
              </div>
              <div className="flex justify-between border-b border-slate-800/50 pb-1.5">
                <span className="text-slate-400">VITE_FIREBASE_MESSAGING_SENDER_ID:</span>
                <span className="text-emerald-400 font-bold">{messagingSenderId}</span>
              </div>
              <div className="flex justify-between pb-1">
                <span className="text-slate-400">VITE_FIREBASE_APP_ID:</span>
                <span className="text-emerald-400 font-bold">{appId}</span>
              </div>
            </div>
          </div>

          {/* 3. FIREBASE INICIALIZADO */}
          <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl space-y-4 shadow-md">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
              <Database className="w-5 h-5 text-teal-400" />
              <h3 className="font-bold text-sm text-slate-200 uppercase tracking-wider">3. Firebase SDK Inicializado</h3>
            </div>
            <div className="space-y-2 text-xs font-mono">
              <div className="flex justify-between border-b border-slate-800/50 pb-1.5">
                <span className="text-slate-400">app.options.projectId:</span>
                <span className={`font-bold ${appProjectId === 'materiais-criativos' ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {appProjectId}
                </span>
              </div>
              <div className="flex justify-between border-b border-slate-800/50 pb-1.5">
                <span className="text-slate-400">firestore.app.options.projectId:</span>
                <span className={`font-bold ${firestoreProjectId === 'materiais-criativos' ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {firestoreProjectId}
                </span>
              </div>
              <div className="flex justify-between border-b border-slate-800/50 pb-1.5">
                <span className="text-slate-400">auth.app.options.projectId:</span>
                <span className={`font-bold ${authProjectId === 'materiais-criativos' ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {authProjectId}
                </span>
              </div>
              <div className="pt-2 flex items-center justify-between">
                <span className="text-slate-400">Status Validação Project ID:</span>
                <span className={`px-2 py-0.5 rounded font-bold text-[11px] ${
                  isProjectIdCorrect ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                }`}>
                  {isProjectIdCorrect ? 'OK (materiais-criativos)' : 'ERRO - FIREBASE ERRADO'}
                </span>
              </div>
            </div>
          </div>

          {/* 4. LEITURA FIRESTORE */}
          <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl space-y-4 shadow-md">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
              <Layers className="w-5 h-5 text-teal-400" />
              <h3 className="font-bold text-sm text-slate-200 uppercase tracking-wider">4. Leitura Firestore Products</h3>
            </div>
            <div className="space-y-2 text-xs font-mono">
              <div className="flex justify-between border-b border-slate-800/50 pb-1.5">
                <span className="text-slate-400">Coleção:</span>
                <span className="text-slate-200 font-bold">products</span>
              </div>
              <div className="flex justify-between border-b border-slate-800/50 pb-1.5">
                <span className="text-slate-400">Leitura Firestore:</span>
                <span className={`font-bold ${firestoreReadOk ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {firestoreReadOk ? 'OK' : 'ERRO'}
                </span>
              </div>
              <div className="flex justify-between border-b border-slate-800/50 pb-1.5">
                <span className="text-slate-400">Total Products no banco:</span>
                <span className="text-teal-400 font-bold text-sm">{totalProducts}</span>
              </div>
              <div className="flex justify-between border-b border-slate-800/50 pb-1.5">
                <span className="text-slate-400">Total Published:</span>
                <span className="text-emerald-400 font-bold text-sm">{totalPublished}</span>
              </div>
              {firestoreReadError && (
                <p className="text-rose-400 text-[11px] p-2 bg-rose-950/50 rounded border border-rose-800">
                  {firestoreReadError}
                </p>
              )}
            </div>
          </div>

          {/* 5. AUTENTICAÇÃO E ADMIN */}
          <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl space-y-4 shadow-md">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
              <ShieldCheck className="w-5 h-5 text-teal-400" />
              <h3 className="font-bold text-sm text-slate-200 uppercase tracking-wider">5. Autenticação & Admin</h3>
            </div>
            <div className="space-y-2 text-xs font-mono">
              <div className="flex justify-between border-b border-slate-800/50 pb-1.5">
                <span className="text-slate-400">Usuário Logado?</span>
                <span className={`font-bold ${isLoggedIn ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {isLoggedIn ? 'SIM' : 'NÃO (Visitante)'}
                </span>
              </div>
              <div className="flex justify-between border-b border-slate-800/50 pb-1.5">
                <span className="text-slate-400">UID Logado:</span>
                <span className="text-slate-300 font-mono text-[11px] break-all">{userUid}</span>
              </div>
              <div className="flex justify-between border-b border-slate-800/50 pb-1.5">
                <span className="text-slate-400">Doc em admins/{userUid}?</span>
                <span className={`font-bold ${isAdminDocFound ? 'text-emerald-400' : 'text-slate-400'}`}>
                  {isAdminDocFound === true ? 'SIM' : isAdminDocFound === false ? 'NÃO' : 'N/A'}
                </span>
              </div>
              <div className="flex justify-between border-b border-slate-800/50 pb-1.5">
                <span className="text-slate-400">Admin Ativo & Role Válida?</span>
                <span className={`font-bold ${isAdminActive ? 'text-emerald-400' : 'text-slate-400'}`}>
                  {isAdminActive === true ? 'SIM' : isAdminActive === false ? 'NÃO' : 'N/A'}
                </span>
              </div>
              {!isLoggedIn && (
                <p className="text-slate-400 text-[11px] italic bg-slate-950 p-2 rounded border border-slate-800">
                  Nota: Visitantes não autenticados possuem permissão de leitura de produtos publicados. Login no Admin é necessário para cadastrar/editar.
                </p>
              )}
            </div>
          </div>

          {/* 6. TESTE DE PERMISSÃO DE ESCRITA NO FIRESTORE */}
          <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl space-y-4 shadow-md">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
              <Play className="w-5 h-5 text-teal-400" />
              <h3 className="font-bold text-sm text-slate-200 uppercase tracking-wider">6. Teste de Escrita Temporária</h3>
            </div>
            <p className="text-xs text-slate-400">
              Testa permissão real de gravação criando, lendo e apagando um documento temporário em <code className="text-teal-300">products/__connection_test__</code>.
            </p>
            <div className="space-y-2 text-xs font-mono">
              <button
                onClick={executeFirestoreWriteTest}
                disabled={testingWrite}
                className="w-full py-2 bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 font-bold border border-teal-500/40 rounded-xl transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {testingWrite ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                Executar Teste de Escrita/Leitura/Exclusão
              </button>

              <div className="pt-2 space-y-1.5">
                <div className="flex justify-between border-b border-slate-800/50 pb-1">
                  <span className="text-slate-400">Criou doc teste?</span>
                  <span className={`font-bold ${writeCreated === true ? 'text-emerald-400' : writeCreated === false ? 'text-rose-400' : 'text-slate-500'}`}>
                    {writeCreated === true ? 'SIM (OK)' : writeCreated === false ? 'NÃO (FALHOU)' : 'NÃO TESTADO'}
                  </span>
                </div>
                <div className="flex justify-between border-b border-slate-800/50 pb-1">
                  <span className="text-slate-400">Leu doc teste?</span>
                  <span className={`font-bold ${writeRead === true ? 'text-emerald-400' : writeRead === false ? 'text-rose-400' : 'text-slate-500'}`}>
                    {writeRead === true ? 'SIM (OK)' : writeRead === false ? 'NÃO (FALHOU)' : 'NÃO TESTADO'}
                  </span>
                </div>
                <div className="flex justify-between border-b border-slate-800/50 pb-1">
                  <span className="text-slate-400">Apagou doc teste?</span>
                  <span className={`font-bold ${writeDeleted === true ? 'text-emerald-400' : writeDeleted === false ? 'text-rose-400' : 'text-slate-500'}`}>
                    {writeDeleted === true ? 'SIM (OK)' : writeDeleted === false ? 'NÃO (FALHOU)' : 'NÃO TESTADO'}
                  </span>
                </div>
                {writeError && (
                  <p className="text-rose-400 text-[11px] p-2 bg-rose-950/50 rounded border border-rose-800">
                    Erro de Escrita: {writeError}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* 7. TESTE CLOUDFLARE R2 */}
          <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl space-y-4 shadow-md md:col-span-2">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
              <Upload className="w-5 h-5 text-teal-400" />
              <h3 className="font-bold text-sm text-slate-200 uppercase tracking-wider">7. API Cloudflare R2 (/api/check-r2)</h3>
            </div>
            
            {r2Loading ? (
              <div className="flex items-center gap-2 text-xs font-mono text-teal-400">
                <RefreshCw className="w-4 h-4 animate-spin" />
                Validando variáveis do R2 no servidor...
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
                <div className="space-y-2">
                  <p className="font-bold text-slate-300 text-[11px] uppercase tracking-wider border-b border-slate-800 pb-1">
                    Variáveis do Servidor Backend
                  </p>
                  <div className="flex justify-between border-b border-slate-800/50 pb-1">
                    <span className="text-slate-400">CLOUDFLARE_ACCOUNT_ID:</span>
                    <span className={`font-bold ${r2Data?.statusVars?.CLOUDFLARE_ACCOUNT_ID === 'PRESENTE' ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {r2Data?.statusVars?.CLOUDFLARE_ACCOUNT_ID || 'AUSENTE'}
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-slate-800/50 pb-1">
                    <span className="text-slate-400">R2_ACCESS_KEY_ID:</span>
                    <span className={`font-bold ${r2Data?.statusVars?.R2_ACCESS_KEY_ID === 'PRESENTE' ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {r2Data?.statusVars?.R2_ACCESS_KEY_ID || 'AUSENTE'}
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-slate-800/50 pb-1">
                    <span className="text-slate-400">R2_SECRET_ACCESS_KEY:</span>
                    <span className={`font-bold ${r2Data?.statusVars?.R2_SECRET_ACCESS_KEY === 'PRESENTE' ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {r2Data?.statusVars?.R2_SECRET_ACCESS_KEY || 'AUSENTE'}
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-slate-800/50 pb-1">
                    <span className="text-slate-400">R2_BUCKET_NAME:</span>
                    <span className="text-slate-200 font-bold">{r2Data?.statusVars?.R2_BUCKET_NAME || 'AUSENTE'}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-800/50 pb-1">
                    <span className="text-slate-400">R2_PUBLIC_URL:</span>
                    <span className="text-slate-200 font-bold">{r2Data?.statusVars?.R2_PUBLIC_URL || 'AUSENTE'}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="font-bold text-slate-300 text-[11px] uppercase tracking-wider border-b border-slate-800 pb-1">
                    Resultado Teste de Upload R2 Real
                  </p>
                  <div className="flex justify-between border-b border-slate-800/50 pb-1">
                    <span className="text-slate-400">Upload R2 Teste:</span>
                    <span className={`font-bold ${r2Data?.uploadOk ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {r2Data?.uploadOk ? 'OK' : 'ERRO'}
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-slate-800/50 pb-1">
                    <span className="text-slate-400">URL Pública Gerada:</span>
                    <span className="text-teal-300 font-bold break-all text-[11px]">
                      {r2Data?.generatedUrl || 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-slate-800/50 pb-1">
                    <span className="text-slate-400">URL Abre Direto (HTTP Status):</span>
                    <span className={`font-bold ${r2UrlProbeOk ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {r2UrlProbeOk ? `SIM (HTTP ${r2ProbeStatus})` : r2ProbeStatus ? `NÃO (HTTP ${r2ProbeStatus})` : 'N/A'}
                    </span>
                  </div>
                  {r2Data?.error && (
                    <p className="text-rose-400 text-[11px] p-2 bg-rose-950/50 rounded border border-rose-800">
                      {r2Data.error}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 8. VALIDAÇÃO DO BOTÃO SALVAR PRODUTO */}
          <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl space-y-3 shadow-md md:col-span-2">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
              <ShieldCheck className="w-5 h-5 text-teal-400" />
              <h3 className="font-bold text-sm text-slate-200 uppercase tracking-wider">
                8. Auditoria de Trava do Botão Salvar Produto (Admin)
              </h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs font-mono">
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
                <span className="text-slate-400 text-[10px] block font-bold uppercase">Upload Imagem</span>
                <span className="text-emerald-400 font-bold block">100% Cloudflare R2 HTTPS</span>
                <span className="text-[10px] text-slate-500 block">Proibido blob/base64/local</span>
              </div>
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
                <span className="text-slate-400 text-[10px] block font-bold uppercase">Gravação Banco</span>
                <span className="text-emerald-400 font-bold block">Firestore setDoc/addDoc</span>
                <span className="text-[10px] text-slate-500 block">Proibido localStorage/mock</span>
              </div>
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
                <span className="text-slate-400 text-[10px] block font-bold uppercase">Confirmação</span>
                <span className="text-emerald-400 font-bold block">Verificação de Escrita Real</span>
                <span className="text-[10px] text-slate-500 block">Exibe erro se R2 ou DB falhar</span>
              </div>
            </div>
          </div>

        </div>

        {/* FOOTER ACTION */}
        <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-slate-900/80 rounded-2xl border border-slate-800 text-xs text-slate-400 font-mono">
          <div>
            Link de Prova Real: <span className="text-teal-400">https://materiais-criativos.vercel.app/#/check-conexao</span>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="#/admin"
              className="px-4 py-2 bg-teal-500 text-slate-950 font-bold rounded-xl hover:bg-teal-400 transition-colors"
            >
              Ir para Painel Admin
            </a>
            <a
              href="#/prova-real"
              className="px-4 py-2 bg-slate-800 text-slate-200 font-bold rounded-xl hover:bg-slate-700 transition-colors"
            >
              Ver Prova Real
            </a>
          </div>
        </div>

      </div>
    </div>
  );
};
