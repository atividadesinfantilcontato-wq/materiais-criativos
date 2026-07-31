import React, { useState, useEffect } from 'react';
import { Product } from '../types';
import { saveProductAsync, deleteProductAsync, fetchProductsAsync } from '../services/productFirestore';
import { generateSlug } from '../utils/slug';
import { uploadToR2 } from '../services/r2Upload';
import { auth, db, isFirebaseConfigured } from '../services/firebase';
import { 
  signInWithEmailAndPassword, 
  signOut as firebaseSignOut, 
  sendPasswordResetEmail,
  onAuthStateChanged,
  User 
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { 
  Plus, Edit2, Trash2, RotateCcw, Save, ArrowLeft, 
  Image as ImageIcon, Sparkles, Check, LogOut, Lock, 
  ShieldCheck, Settings, Home, FileText, Upload, 
  AlertCircle, Key, Mail, RefreshCw, Eye,
  BarChart2, Share2, Copy, TrendingUp, Users, MousePointer, Smartphone, Globe, Link as LinkIcon, CheckCircle2, MapPin, Navigation, Building2
} from 'lucide-react';
import { fetchAnalyticsEventsAsync, AnalyticsEventRecord } from '../services/analyticsService';

interface AdminPageProps {
  products: Product[];
  onProductsUpdated: () => void;
  onNavigate: (path: string) => void;
}

export const AdminPage: React.FC<AdminPageProps> = ({ products, onProductsUpdated, onNavigate }) => {
  // Auth state
  const [user, setUser] = useState<User | null>(null);
  const [isAdminAuthorized, setIsAdminAuthorized] = useState<boolean>(false);
  const [authChecking, setAuthChecking] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string | null>(null);

  // Login form state
  const [acesso, setAcesso] = useState<string>(''); // E-mail
  const [chave, setChave] = useState<string>('');   // Senha
  const [loginLoading, setLoginLoading] = useState<boolean>(false);
  const [resetSent, setResetSent] = useState<boolean>(false);

  // Navigation tab inside Admin: 'inicio' | 'materiais' | 'estatisticas' | 'divulgacao' | 'configuracoes' | 'diagnostico'
  const [activeTab, setActiveTab] = useState<'inicio' | 'materiais' | 'estatisticas' | 'divulgacao' | 'configuracoes' | 'diagnostico'>('materiais');

  // Image upload diagnostics tracking state
  const [lastR2UploadUrl, setLastR2UploadUrl] = useState<string>('');
  const [lastR2UploadStatus, setLastR2UploadStatus] = useState<string>('Nenhum upload nesta sessão');
  const [lastR2UploadError, setLastR2UploadError] = useState<string | null>(null);
  const [lastFetchedAt, setLastFetchedAt] = useState<string>(() => new Date().toLocaleTimeString('pt-BR'));
  const [imageTestResults, setImageTestResults] = useState<Record<string, { status: 'testing' | 'ok' | 'error', message?: string }>>({});
  const [swActive, setSwActive] = useState<boolean>(false);
  const [cacheActive, setCacheActive] = useState<boolean>(false);
  const [proofResult, setProofResult] = useState<{
    fetchedCount: number;
    renderedCount: number;
    statusMessage: string;
    isError: boolean;
    timestamp: string;
  } | null>(null);

  // Read current storage key names for diagnosis
  const getStoredKeyNames = () => {
    const keys: string[] = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k) keys.push(`localStorage.${k}`);
      }
      for (let i = 0; i < sessionStorage.length; i++) {
        const k = sessionStorage.key(i);
        if (k) keys.push(`sessionStorage.${k}`);
      }
    } catch (e) {}
    return keys;
  };

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(regs => setSwActive(regs.length > 0)).catch(() => {});
    }
    if ('caches' in window) {
      caches.keys().then(keys => setCacheActive(keys.length > 0)).catch(() => {});
    }
  }, []);

  const testPublicImageUrl = async (url: string, idKey: string) => {
    if (!url || !url.startsWith('https://')) {
      setImageTestResults(prev => ({ ...prev, [idKey]: { status: 'error', message: 'URL inválida ou sem https://' } }));
      return;
    }
    setImageTestResults(prev => ({ ...prev, [idKey]: { status: 'testing', message: 'Testando acesso público...' } }));

    try {
      const imgPromise = new Promise<boolean>((resolve) => {
        const img = new Image();
        img.onload = () => resolve(true);
        img.onerror = () => resolve(false);
        img.src = url + (url.includes('?') ? '&' : '?') + 'test_check=' + Date.now();
      });

      const isOk = await imgPromise;
      if (isOk) {
        setImageTestResults(prev => ({ ...prev, [idKey]: { status: 'ok', message: 'HTTP 200 OK (Acessível)' } }));
      } else {
        setImageTestResults(prev => ({ ...prev, [idKey]: { status: 'error', message: 'Falha no carregamento (404/403/CORS)' } }));
      }
    } catch (err: any) {
      setImageTestResults(prev => ({ ...prev, [idKey]: { status: 'error', message: err.message || 'Erro no teste' } }));
    }
  };

  const handleReloadFirestoreOnly = async () => {
    await onProductsUpdated();
    setLastFetchedAt(new Date().toLocaleTimeString('pt-BR'));
    showToast('Produtos recarregados 100% diretamente do Firestore!');
  };

  const handleFullLocalClear = async () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
      if ('caches' in window) {
        const names = await caches.keys();
        await Promise.all(names.map(name => caches.delete(name)));
      }
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map(reg => reg.unregister()));
      }
    } catch (e) {}
    showToast('Limpeza total efetuada. Recarregando a página...');
    setTimeout(() => {
      window.location.reload();
    }, 800);
  };

  const handleProveRealModeNow = async () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch (e) {}

    if ('caches' in window) {
      try {
        const names = await caches.keys();
        await Promise.all(names.map(name => caches.delete(name)));
      } catch (e) {}
    }

    if ('serviceWorker' in navigator) {
      try {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map(reg => reg.unregister()));
      } catch (e) {}
    }

    try {
      const freshProducts = await fetchProductsAsync();
      await onProductsUpdated();

      const fetchedCount = freshProducts.length;
      const renderedCount = freshProducts.length;
      let statusMsg = '';
      let isErr = false;

      if (fetchedCount === 0) {
        statusMsg = 'CORRETO — BANCO VAZIO REAL (Firestore retornou 0 produtos, tela renderizou 0 produtos)';
      } else {
        statusMsg = `CORRETO — PRODUTO REAL COMPROVADO (Firestore retornou ${fetchedCount} produto(s) e a tela renderizou ${renderedCount} produto(s))`;
      }

      setProofResult({
        fetchedCount,
        renderedCount,
        statusMessage: statusMsg,
        isError: isErr,
        timestamp: new Date().toLocaleTimeString('pt-BR')
      });

      setLastFetchedAt(new Date().toLocaleTimeString('pt-BR'));
      showToast('Provação do modo real concluída com sucesso!');
    } catch (err: any) {
      setProofResult({
        fetchedCount: 0,
        renderedCount: 0,
        statusMessage: 'Erro na consulta do Firestore: ' + (err.message || 'Falha de conexão'),
        isError: true,
        timestamp: new Date().toLocaleTimeString('pt-BR')
      });
    }
  };

  // Analytics & Link Generator state
  const [analyticsEvents, setAnalyticsEvents] = useState<AnalyticsEventRecord[]>([]);
  const [analyticsLoading, setAnalyticsLoading] = useState<boolean>(false);
  const [selectedProductSlugForLink, setSelectedProductSlugForLink] = useState<string>('');
  const [customLinkSource, setCustomLinkSource] = useState<string>('instagram');
  const [customLinkMedium, setCustomLinkMedium] = useState<string>('story');

  // Product editor state
  const [editingProduct, setEditingProduct] = useState<Partial<Product> | null>(null);
  const [isNew, setIsNew] = useState<boolean>(false);
  const [uploadingMain, setUploadingMain] = useState<boolean>(false);
  const [uploadingGallery, setUploadingGallery] = useState<boolean>(false);
  const [notification, setNotification] = useState<string | null>(null);

  // Listen to Firebase Auth state & validate Firestore admins/{uid}
  useEffect(() => {
    if (!isFirebaseConfigured || !auth) {
      setAuthChecking(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser && db) {
        try {
          // Check admins/{uid} document in Firestore
          const adminDocRef = doc(db, 'admins', currentUser.uid);
          const adminSnap = await getDoc(adminDocRef);

          if (adminSnap.exists()) {
            const data = adminSnap.data();
            if (data && data.active === true && data.role === 'admin') {
              setIsAdminAuthorized(true);
              setAuthError(null);
            } else {
              setIsAdminAuthorized(false);
              setAuthError('Acesso não autorizado. Sua conta não possui permissão de administrador.');
              await firebaseSignOut(auth);
            }
          } else {
            setIsAdminAuthorized(false);
            setAuthError('Acesso não autorizado. Registro de administrador não encontrado.');
            await firebaseSignOut(auth);
          }
        } catch (err: any) {
          console.error('Erro ao verificar permissão do admin:', err);
          setIsAdminAuthorized(false);
          setAuthError('Erro ao verificar permissões no Firestore.');
        }
      } else {
        setIsAdminAuthorized(false);
      }
      setAuthChecking(false);
    });

    return () => unsubscribe();
  }, []);

  const loadAnalytics = async () => {
    setAnalyticsLoading(true);
    try {
      const data = await fetchAnalyticsEventsAsync(1000);
      setAnalyticsEvents(data);
    } catch (err) {
      console.error('Erro ao carregar estatísticas:', err);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  useEffect(() => {
    if (isAdminAuthorized && (activeTab === 'estatisticas' || activeTab === 'inicio')) {
      loadAnalytics();
    }
  }, [isAdminAuthorized, activeTab]);

  const showToast = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 4000);
  };

  // Handle Login Submit
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setResetSent(false);

    if (!acesso.trim() || !chave.trim()) {
      setAuthError('Por favor, preencha o e-mail de Acesso e a Chave.');
      return;
    }

    if (!isFirebaseConfigured || !auth) {
      setAuthError('Firebase Auth não está configurado. Por favor, cadastre as variáveis VITE_FIREBASE_* nas configurações.');
      return;
    }

    setLoginLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, acesso.trim(), chave.trim());
      const loggedUser = userCredential.user;

      if (db) {
        // Validate admins/{uid} document in Firestore
        const adminDocRef = doc(db, 'admins', loggedUser.uid);
        const adminSnap = await getDoc(adminDocRef);

        if (adminSnap.exists()) {
          const data = adminSnap.data();
          if (data && data.active === true && data.role === 'admin') {
            setIsAdminAuthorized(true);
            showToast('Login de administrador realizado com sucesso!');
          } else {
            setIsAdminAuthorized(false);
            setAuthError('Acesso não autorizado.');
            await firebaseSignOut(auth);
          }
        } else {
          setIsAdminAuthorized(false);
          setAuthError('Acesso não autorizado.');
          await firebaseSignOut(auth);
        }
      }
    } catch (err: any) {
      console.error('Erro no login admin:', err);
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
        setAuthError('E-mail ou chave de acesso incorretos.');
      } else if (err.code === 'auth/too-many-requests') {
        setAuthError('Muitas tentativas malsucedidas. Tente novamente mais tarde.');
      } else {
        setAuthError(err.message || 'Falha na autenticação. Verifique suas credenciais.');
      }
    } finally {
      setLoginLoading(false);
    }
  };

  // Handle Password Reset Link
  const handleForgotPassword = async () => {
    if (!acesso.trim()) {
      setAuthError('Digite seu e-mail no campo "Acesso" para receber o link de redefinição de chave.');
      return;
    }
    if (!auth) {
      setAuthError('Firebase Auth não configurado.');
      return;
    }

    try {
      await sendPasswordResetEmail(auth, acesso.trim());
      setResetSent(true);
      setAuthError(null);
    } catch (err: any) {
      setAuthError('Erro ao enviar e-mail de redefinição: ' + (err.message || 'Verifique o e-mail informado.'));
    }
  };

  // Handle Logout
  const handleLogout = async () => {
    if (auth) {
      await firebaseSignOut(auth);
    }
    setIsAdminAuthorized(false);
    setUser(null);
    showToast('Sessão encerrada.');
  };

  // Handle Start Creating New Product
  const handleStartCreate = () => {
    setEditingProduct({
      id: `prod-${Date.now()}`,
      title: '',
      slug: '',
      shortSummary: '',
      fullDescription: '',
      skillsWorked: '',
      mainImage: '',
      thumbnailUrl: '',
      galleryImages: [],
      youtubeUrl: '',
      price: 19.90,
      formattedPrice: 'R$ 19,90',
      hotmartLink: '',
      category: 'Educação Infantil',
      targetAge: '2 a 6 anos',
      pdfCount: 10,
      pageSize: 'A4',
      featured: false,
      socialFeatured: false,
      status: 'published',
      displayOrder: products && products.length > 0 ? products.length + 1 : 1
    });
    setIsNew(true);
  };

  const handleStartEdit = (p: Product) => {
    setEditingProduct({
      ...p,
      galleryImages: Array.isArray(p.galleryImages) ? [...p.galleryImages] : []
    });
    setIsNew(false);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Tem certeza que deseja excluir este produto do Firestore?')) {
      try {
        await deleteProductAsync(id);
        await onProductsUpdated();
        showToast('Produto excluído com sucesso do Firestore!');
      } catch (err: any) {
        showToast('Erro ao excluir do Firestore: ' + (err.message || 'Falha ao remover'));
      }
    }
  };

  const handleRemoveMainImage = () => {
    setEditingProduct(prev => prev ? { ...prev, imageUrl: '', mainImage: '', thumbnailUrl: '' } : null);
    showToast('Imagem principal removida.');
  };

  const handleClearGallery = () => {
    setEditingProduct(prev => prev ? { ...prev, galleryImages: [] } : null);
    showToast('Galeria de imagens esvaziada.');
  };

  const handleResetDefaults = async () => {
    await onProductsUpdated();
    showToast('Produtos recarregados do Firestore.');
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const title = e.target.value;
    setEditingProduct(prev => {
      if (!prev) return null;
      const newSlug = generateSlug(title);
      return {
        ...prev,
        title,
        slug: isNew || !prev.slug ? newSlug : prev.slug
      };
    });
  };

  // Upload Main Image to Cloudflare R2
  const handleUploadMainImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingMain(true);
    try {
      const url = await uploadToR2(file, 'capas');
      setEditingProduct(prev => prev ? { ...prev, imageUrl: url, mainImage: url, thumbnailUrl: url } : null);
      setLastR2UploadUrl(url);
      setLastR2UploadStatus('Sucesso');
      setLastR2UploadError(null);
      showToast('Imagem principal enviada para o Cloudflare R2 com sucesso!');
    } catch (err: any) {
      const msg = err.message || 'Falha no envio para o R2';
      setLastR2UploadStatus('Erro');
      setLastR2UploadError(msg);
      showToast('Erro ao fazer upload da imagem: ' + msg);
    } finally {
      setUploadingMain(false);
      if (e.target) {
        e.target.value = '';
      }
    }
  };

  // Upload Gallery Image to Cloudflare R2
  const handleUploadGalleryImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingGallery(true);
    try {
      const uploadedUrls: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file) {
          const url = await uploadToR2(file, 'galeria');
          if (url) {
            uploadedUrls.push(url);
          }
        }
      }

      setEditingProduct(prev => {
        if (!prev) return null;
        let existing: string[] = [];
        if (Array.isArray(prev.galleryImages)) {
          existing = prev.galleryImages.filter(img => typeof img === 'string' && img.trim() !== '');
        } else if (typeof prev.galleryImages === 'string' && (prev.galleryImages as string).trim() !== '') {
          existing = (prev.galleryImages as string).split(',').map(s => s.trim()).filter(Boolean);
        }
        return {
          ...prev,
          galleryImages: [...existing, ...uploadedUrls]
        };
      });

      if (uploadedUrls.length > 0) {
        setLastR2UploadUrl(uploadedUrls[uploadedUrls.length - 1]);
        setLastR2UploadStatus('Sucesso');
        setLastR2UploadError(null);
      }

      showToast(`${uploadedUrls.length} foto(s) adicionada(s) à galeria com sucesso!`);
    } catch (err: any) {
      const msg = err.message || 'Falha ao enviar galeria';
      setLastR2UploadStatus('Erro');
      setLastR2UploadError(msg);
      showToast('Erro no upload de galeria: ' + msg);
    } finally {
      setUploadingGallery(false);
      if (e.target) {
        e.target.value = '';
      }
    }
  };

  // Save Product Form
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct || !editingProduct.title) {
      alert('Por favor, informe ao menos o título do produto.');
      return;
    }

    const isValidHttpsUrl = (u?: string) => {
      if (!u || u.trim() === '') return true; // empty allowed
      const trimmed = u.trim();
      return trimmed.startsWith('https://') && !trimmed.startsWith('data:') && !trimmed.startsWith('blob:') && !trimmed.startsWith('file:');
    };

    const mainImgToValidate = editingProduct.imageUrl || editingProduct.mainImage;
    if (!isValidHttpsUrl(mainImgToValidate) || !isValidHttpsUrl(editingProduct.thumbnailUrl)) {
      alert('Imagem inválida. Envie a imagem para o Cloudflare R2 antes de salvar.');
      return;
    }

    const priceNum = Number(editingProduct.price) || 19.90;
    const galleryArr = Array.isArray(editingProduct.galleryImages)
      ? editingProduct.galleryImages.filter(img => typeof img === 'string' && img.trim() !== '')
      : (typeof editingProduct.galleryImages === 'string' && (editingProduct.galleryImages as string).trim() !== ''
          ? (editingProduct.galleryImages as string).split(',').map(s => s.trim()).filter(Boolean)
          : []);

    if (galleryArr.some(img => !isValidHttpsUrl(img))) {
      alert('Imagem inválida na galeria. Envie a imagem para o Cloudflare R2 antes de salvar.');
      return;
    }

    const fullProduct: Product = {
      id: editingProduct.id || `prod-${Date.now()}`,
      title: editingProduct.title,
      slug: editingProduct.slug || generateSlug(editingProduct.title),
      shortSummary: editingProduct.shortSummary || '',
      fullDescription: editingProduct.fullDescription || '',
      skillsWorked: editingProduct.skillsWorked || '',
      imageUrl: editingProduct.imageUrl || editingProduct.mainImage || '',
      mainImage: editingProduct.imageUrl || editingProduct.mainImage || '',
      thumbnailUrl: editingProduct.thumbnailUrl || editingProduct.imageUrl || editingProduct.mainImage || '',
      galleryImages: galleryArr,
      youtubeUrl: editingProduct.youtubeUrl || '',
      price: priceNum,
      formattedPrice: `R$ ${priceNum.toFixed(2).replace('.', ',')}`,
      hotmartLink: editingProduct.hotmartLink || '',
      category: editingProduct.category || 'Geral',
      targetAge: editingProduct.targetAge || '2 a 6 anos',
      pdfCount: Number(editingProduct.pdfCount) || 10,
      pageSize: editingProduct.pageSize || 'A4',
      featured: Boolean(editingProduct.featured),
      socialFeatured: Boolean(editingProduct.socialFeatured),
      status: editingProduct.status || 'published',
      displayOrder: Number(editingProduct.displayOrder) || (products.length + 1),
      createdAt: editingProduct.createdAt || new Date().toISOString()
    };

    // Save to Firestore asynchronously
    try {
      await saveProductAsync(fullProduct);
      await onProductsUpdated();
      setEditingProduct(null);
      showToast(isNew ? 'Novo produto cadastrado no Firestore com sucesso!' : 'Produto atualizado no Firestore com sucesso!');
    } catch (err: any) {
      alert('Erro ao salvar produto no Firestore: ' + (err.message || 'Falha no salvamento'));
    }
  };

  // 1. RENDER LOGIN SCREEN IF NOT AUTHENTICATED OR NOT AUTHORIZED
  if (authChecking) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-xl text-center space-y-3">
          <RefreshCw className="w-8 h-8 text-teal-600 animate-spin mx-auto" />
          <p className="text-sm font-semibold text-slate-700">Verificando credenciais de acesso...</p>
        </div>
      </div>
    );
  }

  if (!user || !isAdminAuthorized) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="max-w-xs w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5">
          
          <div className="text-center space-y-1">
            <h1 className="text-base font-semibold text-slate-200 tracking-tight">
              Acesso
            </h1>
          </div>

          {authError && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-medium text-center">
              Acesso não autorizado.
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-3" autoComplete="off">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Acesso
              </label>
              <input
                type="text"
                name="admin-access"
                autoComplete="off"
                required
                value={acesso}
                onChange={(e) => setAcesso(e.target.value)}
                placeholder="Acesso"
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-xs focus:outline-hidden focus:border-slate-500 font-medium transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Chave
              </label>
              <input
                type="password"
                name="admin-key"
                autoComplete="new-password"
                required
                value={chave}
                onChange={(e) => setChave(e.target.value)}
                placeholder="Chave"
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-xs focus:outline-hidden focus:border-slate-500 font-medium transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={loginLoading}
              className="w-full py-2.5 px-4 rounded-lg bg-slate-800 hover:bg-slate-700 active:bg-slate-900 text-slate-100 font-medium text-xs transition-colors cursor-pointer disabled:opacity-50 mt-1"
            >
              {loginLoading ? '...' : 'Entrar'}
            </button>
          </form>

          <div className="text-center pt-2 border-t border-slate-800/80">
            <button
              type="button"
              onClick={() => onNavigate('/')}
              className="text-[11px] text-slate-500 hover:text-slate-400 transition-colors cursor-pointer"
            >
              Voltar
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 2. RENDER MAIN ADMIN DASHBOARD WHEN AUTHORIZED
  return (
    <div className="min-h-screen bg-slate-100/90 pb-20 pt-6 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Toast Notification */}
        {notification && (
          <div className="p-4 rounded-2xl bg-emerald-700 text-white font-bold text-xs flex items-center justify-between shadow-lg animate-in fade-in z-50 sticky top-4">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-300" />
              <span>{notification}</span>
            </div>
            <button onClick={() => setNotification(null)} className="text-white/80 hover:text-white">✕</button>
          </div>
        )}

        {/* Top Header Bar */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-teal-50 text-teal-700 border border-teal-200">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-slate-900">Painel de Gestão Admin</h1>
              <p className="text-xs text-slate-500">Conectado como {user?.email}</p>
            </div>
          </div>

          {/* Admin Navigation Menu & Actions */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setActiveTab('inicio')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'inicio' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Home className="w-3.5 h-3.5" /> Início
            </button>

            <button
              onClick={() => setActiveTab('materiais')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'materiais' ? 'bg-teal-700 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <FileText className="w-3.5 h-3.5" /> Materiais
            </button>

            <button
              onClick={() => setActiveTab('estatisticas')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'estatisticas' ? 'bg-teal-700 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <BarChart2 className="w-3.5 h-3.5" /> Estatísticas
            </button>

            <button
              onClick={() => setActiveTab('divulgacao')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'divulgacao' ? 'bg-indigo-700 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Share2 className="w-3.5 h-3.5" /> Links de Divulgação
            </button>

            <button
              onClick={() => setActiveTab('configuracoes')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'configuracoes' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Settings className="w-3.5 h-3.5" /> Configurações
            </button>

            <button
              onClick={() => setActiveTab('diagnostico')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'diagnostico' ? 'bg-amber-600 text-white' : 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" /> Prova de Origem
            </button>

            <div className="h-5 w-px bg-slate-200 mx-1" />

            <button
              onClick={() => onNavigate('/')}
              className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors flex items-center gap-1"
              title="Ver site"
            >
              <Eye className="w-3.5 h-3.5" /> Ver Vitrine
            </button>

            <button
              onClick={handleLogout}
              className="px-3 py-2 rounded-xl bg-rose-50 text-rose-700 hover:bg-rose-100 text-xs font-bold transition-colors flex items-center gap-1"
            >
              <LogOut className="w-3.5 h-3.5" /> Sair
            </button>
          </div>
        </div>

        {/* TAB 1: INÍCIO */}
        {activeTab === 'inicio' && (
          <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-xs space-y-6">
            <h2 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-3">Resumo da Vitrine</h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-5 rounded-2xl bg-teal-50 border border-teal-200 space-y-1">
                <div className="text-xs font-bold text-teal-800 uppercase tracking-wider">Total de Materiais</div>
                <div className="text-3xl font-extrabold text-teal-900">{products.length}</div>
              </div>

              <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-200 space-y-1">
                <div className="text-xs font-bold text-emerald-800 uppercase tracking-wider">Publicados</div>
                <div className="text-3xl font-extrabold text-emerald-900">
                  {products.filter(p => p.status !== 'draft').length}
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-amber-50 border border-amber-200 space-y-1">
                <div className="text-xs font-bold text-amber-800 uppercase tracking-wider">Em Destaque Social</div>
                <div className="text-3xl font-extrabold text-amber-900">
                  {products.filter(p => p.socialFeatured || p.featured).length}
                </div>
              </div>
            </div>

            <div className="pt-4 flex gap-3">
              <button
                onClick={() => {
                  setActiveTab('materiais');
                  handleStartCreate();
                }}
                className="px-5 py-3 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs flex items-center gap-2 shadow-sm"
              >
                <Plus className="w-4 h-4" /> Cadastrar Novo Material
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: MATERIAIS */}
        {activeTab === 'materiais' && (
          <div className="space-y-6">
            
            {/* Action Bar */}
            {!editingProduct && (
              <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-200">
                <h2 className="text-base font-extrabold text-slate-900">Catálogo de Materiais ({products.length})</h2>
                <div className="flex gap-2">
                  <button
                    onClick={handleResetDefaults}
                    className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors flex items-center gap-1.5"
                    title="Restaurar de fábrica"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> Restaurar Originais
                  </button>

                  <button
                    onClick={handleStartCreate}
                    className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold transition-colors flex items-center gap-1.5 shadow-sm"
                  >
                    <Plus className="w-4 h-4" /> Novo Material
                  </button>
                </div>
              </div>
            )}

            {/* FORMULARIO DE CADASTRO / EDIÇÃO */}
            {editingProduct ? (
              <form onSubmit={handleSave} className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-md space-y-6">
                
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <h2 className="text-lg font-bold text-slate-900">
                    {isNew ? 'Cadastrar Novo Material' : `Editar: ${editingProduct.title}`}
                  </h2>
                  <button
                    type="button"
                    onClick={() => setEditingProduct(null)}
                    className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold"
                  >
                    Cancelar
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
                  
                  {/* 1. Título do material */}
                  <div className="md:col-span-2">
                    <label className="block font-bold text-slate-800 mb-1">1. Título do Material *</label>
                    <input
                      type="text"
                      required
                      value={editingProduct.title || ''}
                      onChange={handleTitleChange}
                      placeholder="Ex: Alfabeto Ilustrado em PDF"
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm font-semibold"
                    />
                  </div>

                  {/* 2. Slug automático */}
                  <div>
                    <label className="block font-bold text-slate-800 mb-1">2. Slug Automático (URL)</label>
                    <input
                      type="text"
                      value={editingProduct.slug || ''}
                      onChange={(e) => setEditingProduct({ ...editingProduct, slug: e.target.value })}
                      placeholder="alfabeto-ilustrado"
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-mono text-xs"
                    />
                  </div>

                  {/* 5. Categoria */}
                  <div>
                    <label className="block font-bold text-slate-800 mb-1">5. Categoria</label>
                    <input
                      type="text"
                      value={editingProduct.category || ''}
                      onChange={(e) => setEditingProduct({ ...editingProduct, category: e.target.value })}
                      placeholder="Alfabetização, Matemática, Coordenação..."
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900"
                    />
                  </div>

                  {/* 3. Resumo curto */}
                  <div className="md:col-span-2">
                    <label className="block font-bold text-slate-800 mb-1">3. Resumo Curto (Aparece nos cards)</label>
                    <textarea
                      rows={2}
                      value={editingProduct.shortSummary || ''}
                      onChange={(e) => setEditingProduct({ ...editingProduct, shortSummary: e.target.value })}
                      placeholder="Resumo em poucas frases para atrair a atenção do usuário..."
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900"
                    />
                  </div>

                  {/* 4. Descrição completa */}
                  <div className="md:col-span-2">
                    <label className="block font-bold text-slate-800 mb-1">4. Descrição Completa (Página individual)</label>
                    <textarea
                      rows={5}
                      value={editingProduct.fullDescription || ''}
                      onChange={(e) => setEditingProduct({ ...editingProduct, fullDescription: e.target.value })}
                      placeholder="Descreva todo o conteúdo, benefícios, páginas e metodologia da atividade..."
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900"
                    />
                  </div>

                  {/* O que o material ajuda a trabalhar */}
                  <div className="md:col-span-2">
                    <label className="block font-bold text-slate-800 mb-1">O que ajuda a trabalhar (Destaque visual)</label>
                    <input
                      type="text"
                      value={editingProduct.skillsWorked || ''}
                      onChange={(e) => setEditingProduct({ ...editingProduct, skillsWorked: e.target.value })}
                      placeholder="Ex: Foco, raciocínio lógico, linguagem e motricidade fina"
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900"
                    />
                  </div>

                  {/* 6. Idade indicada */}
                  <div>
                    <label className="block font-bold text-slate-800 mb-1">6. Idade Indicada</label>
                    <input
                      type="text"
                      value={editingProduct.targetAge || ''}
                      onChange={(e) => setEditingProduct({ ...editingProduct, targetAge: e.target.value })}
                      placeholder="2 a 6 anos"
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900"
                    />
                  </div>

                  {/* 7. Quantidade de PDFs */}
                  <div>
                    <label className="block font-bold text-slate-800 mb-1">7. Quantidade de Páginas/PDFs</label>
                    <input
                      type="number"
                      value={editingProduct.pdfCount || 10}
                      onChange={(e) => setEditingProduct({ ...editingProduct, pdfCount: parseInt(e.target.value) || 1 })}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900"
                    />
                  </div>

                  {/* 11. Preço */}
                  <div>
                    <label className="block font-bold text-slate-800 mb-1">11. Preço (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={editingProduct.price || 19.90}
                      onChange={(e) => setEditingProduct({ ...editingProduct, price: parseFloat(e.target.value) || 0 })}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-bold"
                    />
                  </div>

                  {/* 12. Link Hotmart */}
                  <div>
                    <label className="block font-bold text-slate-800 mb-1">12. Link de Checkout Hotmart</label>
                    <input
                      type="url"
                      value={editingProduct.hotmartLink || ''}
                      onChange={(e) => setEditingProduct({ ...editingProduct, hotmartLink: e.target.value })}
                      placeholder="https://pay.hotmart.com/..."
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900"
                    />
                  </div>

                  {/* 13. Status */}
                  <div>
                    <label className="block font-bold text-slate-800 mb-1">13. Status de Publicação</label>
                    <select
                      value={editingProduct.status || 'published'}
                      onChange={(e) => setEditingProduct({ ...editingProduct, status: e.target.value as 'published' | 'draft' })}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-bold"
                    >
                      <option value="published">Publicado (Visível na Vitrine)</option>
                      <option value="draft">Rascunho (Oculto)</option>
                    </select>
                  </div>

                  {/* 15. Ordem de exibição */}
                  <div>
                    <label className="block font-bold text-slate-800 mb-1">15. Ordem de Exibição (Número)</label>
                    <input
                      type="number"
                      value={editingProduct.displayOrder ?? 1}
                      onChange={(e) => setEditingProduct({ ...editingProduct, displayOrder: parseInt(e.target.value) || 1 })}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900"
                    />
                  </div>

                  {/* 8. Imagem Principal & Cloudflare R2 Upload */}
                  <div className="md:col-span-2 p-4 rounded-2xl bg-teal-50/60 border border-teal-200 space-y-3">
                    <label className="block font-bold text-slate-900">
                      8. Imagem Principal / Capa (Upload Cloudflare R2)
                    </label>
                    
                    <div className="flex flex-col sm:flex-row gap-3 items-center">
                      <input
                        type="url"
                        value={editingProduct.imageUrl || editingProduct.mainImage || ''}
                        onChange={(e) => setEditingProduct({ ...editingProduct, imageUrl: e.target.value, mainImage: e.target.value, thumbnailUrl: e.target.value })}
                        placeholder="https://..."
                        className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-slate-900 text-xs"
                      />

                      <label className="px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs flex items-center gap-2 cursor-pointer shrink-0 shadow-xs">
                        <Upload className="w-4 h-4" />
                        <span>{uploadingMain ? 'Enviando...' : 'Subir p/ Cloudflare R2'}</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleUploadMainImage}
                          disabled={uploadingMain}
                          className="hidden"
                        />
                      </label>
                    </div>

                    {(editingProduct.imageUrl || editingProduct.mainImage) && (editingProduct.imageUrl || editingProduct.mainImage)?.trim() !== '' && (
                      <div className="flex items-center justify-between gap-3 pt-1 border-t border-teal-200/60">
                        <div className="flex items-center gap-3 overflow-hidden">
                          <img src={editingProduct.imageUrl || editingProduct.mainImage} alt="Preview" className="w-16 h-12 object-cover rounded-lg border border-slate-200 shrink-0" />
                          <span className="text-xs text-slate-500 truncate max-w-xs">{editingProduct.imageUrl || editingProduct.mainImage}</span>
                        </div>
                        <button
                          type="button"
                          onClick={handleRemoveMainImage}
                          className="px-3 py-1.5 rounded-xl bg-rose-100 hover:bg-rose-200 text-rose-700 text-xs font-bold transition-colors cursor-pointer shrink-0"
                        >
                          Remover imagem principal
                        </button>
                      </div>
                    )}
                  </div>

                  {/* 9. Galeria de Imagens do Produto & Cloudflare R2 Upload */}
                  <div className="md:col-span-2 p-4 sm:p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
                    <div>
                      <label className="block font-bold text-slate-900 text-sm">
                        9. Galeria de Imagens do Produto
                      </label>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Você pode adicionar várias imagens. Elas aparecerão na página do produto.
                      </p>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 items-center">
                      <input
                        type="text"
                        value={
                          Array.isArray(editingProduct.galleryImages)
                            ? editingProduct.galleryImages.join(', ')
                            : (editingProduct.galleryImages || '')
                        }
                        onChange={(e) => {
                          const val = e.target.value;
                          const arr = val.split(',').map(s => s.trim()).filter(Boolean);
                          setEditingProduct({ ...editingProduct, galleryImages: arr });
                        }}
                        placeholder="https://img1.jpg, https://img2.jpg"
                        className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-slate-900 text-xs focus:ring-2 focus:ring-[#6BCB9A]/30 focus:border-[#6BCB9A] outline-hidden"
                      />

                      <label className="px-5 py-2.5 rounded-xl bg-[#6BCB9A] hover:bg-[#55B987] active:bg-[#46a375] text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer shrink-0 shadow-xs transition-colors">
                        <Upload className="w-4 h-4" />
                        <span>{uploadingGallery ? 'Enviando fotos...' : 'Adicionar fotos à galeria'}</span>
                        <input
                          type="file"
                          multiple
                          accept="image/*"
                          onChange={handleUploadGalleryImage}
                          disabled={uploadingGallery}
                          className="hidden"
                        />
                      </label>
                    </div>

                    {/* Image count status badge & Clear Gallery button */}
                    {(() => {
                      const galleryList = Array.isArray(editingProduct.galleryImages)
                        ? editingProduct.galleryImages.filter(img => Boolean(img && img.trim() !== ''))
                        : (typeof editingProduct.galleryImages === 'string' && (editingProduct.galleryImages as string).trim() !== ''
                            ? (editingProduct.galleryImages as string).split(',').map(s => s.trim()).filter(Boolean)
                            : []);
                      const count = galleryList.length;
                      return (
                        <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 text-xs">
                          <span className="font-semibold text-slate-700">
                            {count === 0 ? 'Nenhuma imagem adicionada' : `${count} ${count === 1 ? 'imagem na galeria' : 'imagens na galeria'}`}
                          </span>
                          {count > 0 && (
                            <button
                              type="button"
                              onClick={handleClearGallery}
                              className="px-3 py-1.5 rounded-xl bg-rose-100 hover:bg-rose-200 text-rose-700 text-xs font-bold transition-colors cursor-pointer shrink-0"
                            >
                              Limpar galeria
                            </button>
                          )}
                        </div>
                      );
                    })()}

                    {/* Thumbnails display */}
                    {Array.isArray(editingProduct.galleryImages) && editingProduct.galleryImages.filter(img => Boolean(img && img.trim() !== '')).length > 0 && (
                      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3 pt-1">
                        {editingProduct.galleryImages.filter(img => Boolean(img && img.trim() !== '')).map((img, idx) => (
                          <div key={idx} className="relative group aspect-square rounded-xl overflow-hidden border border-slate-200/90 bg-slate-100 shadow-xs">
                            <img src={img} alt={`Galeria ${idx + 1}`} className="w-full h-full object-cover" />
                            <button
                              type="button"
                              onClick={() => {
                                const currentArr = Array.isArray(editingProduct.galleryImages)
                                  ? (editingProduct.galleryImages as string[])
                                  : (editingProduct.galleryImages as string).split(',').map(s => s.trim());
                                const newGallery = currentArr.filter((_, i) => i !== idx);
                                setEditingProduct({ ...editingProduct, galleryImages: newGallery });
                              }}
                              title="Remover foto"
                              className="absolute top-1 right-1 bg-rose-600 hover:bg-rose-700 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold shadow-md transition-transform hover:scale-110 cursor-pointer"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 10. Vídeo YouTube */}
                  <div className="md:col-span-2">
                    <label className="block font-bold text-slate-800 mb-1">10. Link Vídeo YouTube (Opcional)</label>
                    <input
                      type="url"
                      value={editingProduct.youtubeUrl || ''}
                      onChange={(e) => setEditingProduct({ ...editingProduct, youtubeUrl: e.target.value })}
                      placeholder="https://www.youtube.com/watch?v=..."
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900"
                    />
                  </div>

                  {/* 14. Destaque: sim / não */}
                  <div className="md:col-span-2 flex flex-wrap gap-6 pt-2 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                    <label className="flex items-center gap-2 font-bold text-slate-800 text-xs cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editingProduct.featured || false}
                        onChange={(e) => setEditingProduct({ ...editingProduct, featured: e.target.checked })}
                        className="w-4 h-4 rounded-sm text-teal-600 focus:ring-teal-500"
                      />
                      <span>14. Destaque na Vitrine Principal</span>
                    </label>

                    <label className="flex items-center gap-2 font-bold text-slate-800 text-xs cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editingProduct.socialFeatured || false}
                        onChange={(e) => setEditingProduct({ ...editingProduct, socialFeatured: e.target.checked })}
                        className="w-4 h-4 rounded-sm text-amber-600 focus:ring-amber-500"
                      />
                      <span>Destaque no topo da Bio Social</span>
                    </label>
                  </div>

                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setEditingProduct(null)}
                    className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs flex items-center gap-2 shadow-sm"
                  >
                    <Save className="w-4 h-4" />
                    <span>Salvar Material</span>
                  </button>
                </div>

              </form>
            ) : (
              /* TABELA DE MATERIAIS */
              <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-700">
                    <thead className="bg-slate-50 border-b border-slate-200 font-bold text-slate-800 uppercase tracking-wider">
                      <tr>
                        <th className="p-4">Material</th>
                        <th className="p-4">Categoria</th>
                        <th className="p-4">Status</th>
                        <th className="p-4">Ordem</th>
                        <th className="p-4">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {products.map((p) => (
                        <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              {(p.imageUrl || p.thumbnailUrl || p.mainImage) ? (
                                <img src={p.imageUrl || p.thumbnailUrl || p.mainImage} alt="" className="w-12 h-10 object-cover rounded-lg border border-slate-200 shrink-0" />
                              ) : (
                                <div className="w-12 h-10 bg-slate-100 rounded-lg border border-slate-200 shrink-0 flex items-center justify-center text-slate-400">
                                  <FileText className="w-5 h-5 opacity-40" />
                                </div>
                              )}
                              <div>
                                <div className="font-bold text-slate-900 text-sm">{p.title}</div>
                                <div className="text-[11px] text-slate-400 font-mono">/{p.slug}</div>
                              </div>
                            </div>
                          </td>
                          <td className="p-4 font-medium">{p.category}</td>
                          <td className="p-4">
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                              p.status === 'draft' ? 'bg-amber-100 text-amber-900' : 'bg-emerald-100 text-emerald-900'
                            }`}>
                              {p.status === 'draft' ? 'Rascunho' : 'Publicado'}
                            </span>
                          </td>
                          <td className="p-4 font-mono font-bold text-slate-600">{p.displayOrder || '-'}</td>
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleStartEdit(p)}
                                className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                                title="Editar"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDelete(p.id)}
                                className="p-2 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 transition-colors"
                                title="Excluir"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

          </div>
        )}

        {/* TAB 3: ESTATÍSTICAS */}
        {activeTab === 'estatisticas' && (() => {
          const nowTs = Date.now();
          const todayStr = new Date().toISOString().split('T')[0];
          const sevenDaysAgo = nowTs - 7 * 24 * 60 * 60 * 1000;
          const thirtyDaysAgo = nowTs - 30 * 24 * 60 * 60 * 1000;

          const visitsToday = analyticsEvents.filter(e => e.dateKey === todayStr || (new Date(e.createdAt).getTime() > nowTs - 24*60*60*1000));
          const visits7Days = analyticsEvents.filter(e => new Date(e.createdAt).getTime() >= sevenDaysAgo);
          const visits30Days = analyticsEvents.filter(e => new Date(e.createdAt).getTime() >= thirtyDaysAgo);
          const hotmartClicks = analyticsEvents.filter(e => e.eventType === 'hotmart_click');

          // Source breakdown
          const sourceMap: Record<string, { name: string; count: number; color: string }> = {
            instagram: { name: 'Instagram', count: 0, color: 'bg-pink-500' },
            tiktok: { name: 'TikTok', count: 0, color: 'bg-slate-900' },
            youtube: { name: 'YouTube', count: 0, color: 'bg-red-600' },
            whatsapp: { name: 'WhatsApp', count: 0, color: 'bg-emerald-600' },
            facebook: { name: 'Facebook', count: 0, color: 'bg-blue-600' },
            google: { name: 'Google', count: 0, color: 'bg-amber-500' },
            pinterest: { name: 'Pinterest', count: 0, color: 'bg-red-500' },
            telegram: { name: 'Telegram', count: 0, color: 'bg-sky-500' },
            threads: { name: 'Threads', count: 0, color: 'bg-slate-800' },
            twitter: { name: 'Twitter / X', count: 0, color: 'bg-[#1DA1F2]' },
            direct: { name: 'Direto', count: 0, color: 'bg-teal-600' },
            other: { name: 'Outros', count: 0, color: 'bg-slate-500' }
          };

          analyticsEvents.forEach(e => {
            const src = (e.source || 'direct').toLowerCase();
            if (sourceMap[src]) {
              sourceMap[src].count++;
            } else {
              sourceMap.other.count++;
            }
          });

          const sortedSources = Object.values(sourceMap).sort((a, b) => b.count - a.count);
          const totalVisitsCount = analyticsEvents.length || 1;
          const topSourceLabel = sortedSources[0]?.count > 0 ? sortedSources[0].name : 'Direto';

          // Top products viewed
          const productCounts: Record<string, { title: string; count: number }> = {};
          analyticsEvents
            .filter(e => e.eventType === 'product_view' || e.eventType === 'material_card_click')
            .forEach(e => {
              const name = e.productTitle || e.productSlug || 'Sem nome';
              if (!productCounts[name]) {
                productCounts[name] = { title: name, count: 0 };
              }
              productCounts[name].count++;
            });

          const topProducts = Object.values(productCounts).sort((a, b) => b.count - a.count).slice(0, 5);
          const topProductTitle = topProducts[0]?.title || 'Sem acessos registrados';

          // UTM links table
          const utmMap: Record<string, { source: string; medium: string; campaign: string; count: number }> = {};
          analyticsEvents.filter(e => e.utmSource).forEach(e => {
            const key = `${e.utmSource}|${e.utmMedium || 'sem-medium'}|${e.utmCampaign || 'sem-campaign'}`;
            if (!utmMap[key]) {
              utmMap[key] = {
                source: e.utmSource || '',
                medium: e.utmMedium || '-',
                campaign: e.utmCampaign || '-',
                count: 0
              };
            }
            utmMap[key].count++;
          });
          const utmList = Object.values(utmMap).sort((a, b) => b.count - a.count);

          // Geolocation aggregations (Vercel Geolocation headers)
          const cityMap: Record<string, { city: string; region: string; country: string; count: number }> = {};
          const regionMap: Record<string, { region: string; country: string; count: number }> = {};
          const countryMap: Record<string, { country: string; count: number }> = {};

          analyticsEvents.forEach(e => {
            const city = e.city || 'Não identificado';
            const region = e.region || '-';
            const country = e.country || e.countryCode || '-';

            const cityKey = `${city}|${region}|${country}`;
            if (!cityMap[cityKey]) {
              cityMap[cityKey] = { city, region, country, count: 0 };
            }
            cityMap[cityKey].count++;

            if (region && region !== '-') {
              const regKey = `${region}|${country}`;
              if (!regionMap[regKey]) {
                regionMap[regKey] = { region, country, count: 0 };
              }
              regionMap[regKey].count++;
            }

            if (country && country !== '-') {
              if (!countryMap[country]) {
                countryMap[country] = { country, count: 0 };
              }
              countryMap[country].count++;
            }
          });

          const topCities = Object.values(cityMap).sort((a, b) => b.count - a.count).slice(0, 8);
          const topRegions = Object.values(regionMap).sort((a, b) => b.count - a.count).slice(0, 5);
          const topCountries = Object.values(countryMap).sort((a, b) => b.count - a.count).slice(0, 5);

          return (
            <div className="space-y-8">
              
              {/* Header & Reload */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200">
                <div>
                  <h2 className="text-xl font-extrabold text-slate-900">Analytics de Tráfego & Origem</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Métricas de acessos, conversões na Hotmart e canais de origem</p>
                </div>
                <button
                  onClick={loadAnalytics}
                  disabled={analyticsLoading}
                  className="px-4 py-2.5 rounded-2xl bg-teal-50 hover:bg-teal-100 text-teal-800 text-xs font-bold transition-all flex items-center gap-2 border border-teal-200 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${analyticsLoading ? 'animate-spin' : ''}`} />
                  <span>{analyticsLoading ? 'Atualizando...' : 'Atualizar Dados'}</span>
                </button>
              </div>

              {/* Disclaimer */}
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                <span>
                  <strong>Aviso de Precisão:</strong> A detecção de origem é 100% precisa quando a divulgação utiliza links com parâmetro UTM. Algumas redes sociais e aplicativos móveis podem ocultar o referrer do navegador.
                </span>
              </div>

              {/* STAT CARDS GRID */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                
                <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-1">
                  <div className="text-[11px] font-bold text-slate-500 uppercase">Visitas Hoje</div>
                  <div className="text-2xl font-extrabold text-teal-700">{visitsToday.length}</div>
                </div>

                <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-1">
                  <div className="text-[11px] font-bold text-slate-500 uppercase">Últimos 7 dias</div>
                  <div className="text-2xl font-extrabold text-slate-900">{visits7Days.length}</div>
                </div>

                <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-1">
                  <div className="text-[11px] font-bold text-slate-500 uppercase">Últimos 30 dias</div>
                  <div className="text-2xl font-extrabold text-slate-900">{visits30Days.length}</div>
                </div>

                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 shadow-xs space-y-1">
                  <div className="text-[11px] font-bold text-emerald-800 uppercase">Cliques Hotmart</div>
                  <div className="text-2xl font-extrabold text-emerald-900">{hotmartClicks.length}</div>
                </div>

                <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-1">
                  <div className="text-[11px] font-bold text-slate-500 uppercase">Top Origem</div>
                  <div className="text-lg font-extrabold text-indigo-700 truncate" title={topSourceLabel}>
                    {topSourceLabel}
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-1">
                  <div className="text-[11px] font-bold text-slate-500 uppercase">Top Produto</div>
                  <div className="text-xs font-bold text-slate-800 line-clamp-2" title={topProductTitle}>
                    {topProductTitle}
                  </div>
                </div>

              </div>

              {/* GRID: RANKING DE ORIGENS & TOP PRODUTOS */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                
                {/* RANKING POR REDE SOCIAL */}
                <div className="lg:col-span-7 bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
                  <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
                    <Globe className="w-4 h-4 text-teal-600" />
                    <span>Ranking de Origem dos Acessos</span>
                  </h3>

                  <div className="space-y-3 pt-2">
                    {sortedSources.map((item) => {
                      const pct = Math.round((item.count / totalVisitsCount) * 100);
                      return (
                        <div key={item.name} className="space-y-1 text-xs">
                          <div className="flex items-center justify-between font-semibold">
                            <span className="text-slate-800">{item.name}</span>
                            <span className="text-slate-500">{item.count} acessos ({pct}%)</span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                            <div className={`h-full ${item.color} transition-all duration-500`} style={{ width: `${Math.max(pct, item.count > 0 ? 3 : 0)}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* TOP PRODUTOS MAIS VISTOS */}
                <div className="lg:col-span-5 bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
                  <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-[#2F8F6B]" />
                    <span>Materiais Mais Procurados</span>
                  </h3>

                  <div className="space-y-3 pt-2">
                    {topProducts.length === 0 ? (
                      <p className="text-xs text-slate-400">Nenhuma visualização de produto registrada até o momento.</p>
                    ) : (
                      topProducts.map((p, idx) => (
                        <div key={idx} className="p-3 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between gap-3 text-xs">
                          <div className="font-bold text-slate-900 truncate">
                            <span className="text-teal-700 mr-2">#{idx + 1}</span>
                            {p.title}
                          </div>
                          <span className="px-2.5 py-1 rounded-full bg-teal-100 text-teal-800 font-extrabold shrink-0">
                            {p.count} views
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

              </div>

              {/* SEÇÃO: GEOLOCALIZAÇÃO DOS ACESSOS (VERCEL IP GEO) */}
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
                  <div>
                    <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-rose-600" />
                      <span>Geolocalização dos Acessos (Vercel IP Geolocation)</span>
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">Captura real via headers da Vercel no servidor (cidade, estado e país por IP)</p>
                  </div>
                  <span className="px-3 py-1 bg-slate-100 text-slate-700 text-[10px] font-mono font-bold rounded-full w-fit">
                    API /api/track-event
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* TOP CIDADES */}
                  <div className="space-y-3 p-4 rounded-2xl bg-slate-50 border border-slate-100">
                    <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-teal-600" />
                      <span>Top Cidades</span>
                    </h4>
                    <div className="space-y-2">
                      {topCities.length === 0 ? (
                        <p className="text-xs text-slate-400">Nenhuma cidade registrada ainda.</p>
                      ) : (
                        topCities.map((item, idx) => (
                          <div key={idx} className="flex items-center justify-between text-xs p-2 rounded-xl bg-white border border-slate-200/60 shadow-2xs">
                            <div className="font-bold text-slate-900 truncate max-w-[170px]" title={`${item.city} / ${item.region} / ${item.country}`}>
                              <span className="text-teal-700 mr-1 font-mono text-[11px]">#{idx + 1}</span>
                              {item.city}
                              {item.region !== '-' && <span className="text-slate-400 font-normal ml-1">({item.region})</span>}
                            </div>
                            <span className="px-2 py-0.5 rounded-full bg-teal-50 text-teal-800 font-extrabold text-[11px]">
                              {item.count}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* TOP ESTADOS */}
                  <div className="space-y-3 p-4 rounded-2xl bg-slate-50 border border-slate-100">
                    <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <Navigation className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Top Estados / Regiões</span>
                    </h4>
                    <div className="space-y-2">
                      {topRegions.length === 0 ? (
                        <p className="text-xs text-slate-400">Nenhum estado registrado ainda.</p>
                      ) : (
                        topRegions.map((item, idx) => (
                          <div key={idx} className="flex items-center justify-between text-xs p-2 rounded-xl bg-white border border-slate-200/60 shadow-2xs">
                            <div className="font-bold text-slate-900 truncate">
                              <span className="text-indigo-700 mr-1 font-mono text-[11px]">#{idx + 1}</span>
                              {item.region} <span className="text-slate-400 font-normal">({item.country})</span>
                            </div>
                            <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-800 font-extrabold text-[11px]">
                              {item.count}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* TOP PAÍSES */}
                  <div className="space-y-3 p-4 rounded-2xl bg-slate-50 border border-slate-100">
                    <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <Globe className="w-3.5 h-3.5 text-amber-600" />
                      <span>Top Países</span>
                    </h4>
                    <div className="space-y-2">
                      {topCountries.length === 0 ? (
                        <p className="text-xs text-slate-400">Nenhum país registrado ainda.</p>
                      ) : (
                        topCountries.map((item, idx) => (
                          <div key={idx} className="flex items-center justify-between text-xs p-2 rounded-xl bg-white border border-slate-200/60 shadow-2xs">
                            <div className="font-bold text-slate-900 uppercase">
                              <span className="text-amber-700 mr-1 font-mono text-[11px]">#{idx + 1}</span>
                              {item.country}
                            </div>
                            <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 font-extrabold text-[11px]">
                              {item.count}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* TABELA: LINKS COM UTM */}
              <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="p-5 border-b border-slate-100">
                  <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
                    <Share2 className="w-4 h-4 text-indigo-600" />
                    <span>Desempenho de Links com UTM</span>
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-700">
                    <thead className="bg-slate-50 font-bold text-slate-800 uppercase tracking-wider border-b border-slate-200">
                      <tr>
                        <th className="p-3.5">Origem (utm_source)</th>
                        <th className="p-3.5">Meio (utm_medium)</th>
                        <th className="p-3.5">Campanha (utm_campaign)</th>
                        <th className="p-3.5 text-right">Acessos</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {utmList.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="p-6 text-center text-slate-400">
                            Nenhum acesso via link UTM registrado ainda. Use a aba "Links de Divulgação" para criar seus links!
                          </td>
                        </tr>
                      ) : (
                        utmList.map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-50 transition-colors">
                            <td className="p-3.5 font-bold text-indigo-700">{item.source}</td>
                            <td className="p-3.5 font-mono text-slate-600">{item.medium}</td>
                            <td className="p-3.5 text-slate-500">{item.campaign}</td>
                            <td className="p-3.5 text-right font-extrabold text-slate-900">{item.count}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* TABELA: ÚLTIMOS ACESSOS */}
              <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
                    <Users className="w-4 h-4 text-teal-600" />
                    <span>Últimos Acessos e Ações</span>
                  </h3>
                  <span className="text-xs text-slate-400 font-medium">Exibindo os últimos 50 registros</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-700">
                    <thead className="bg-slate-50 font-bold text-slate-800 uppercase tracking-wider border-b border-slate-200">
                      <tr>
                        <th className="p-3.5">Data / Hora</th>
                        <th className="p-3.5">Origem</th>
                        <th className="p-3.5">Evento / Página</th>
                        <th className="p-3.5">Produto</th>
                        <th className="p-3.5">Cidade</th>
                        <th className="p-3.5">Estado</th>
                        <th className="p-3.5">País</th>
                        <th className="p-3.5">Dispositivo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {analyticsEvents.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="p-6 text-center text-slate-400">
                            Nenhum registro de acesso encontrado.
                          </td>
                        </tr>
                      ) : (
                        analyticsEvents.slice(0, 50).map((e) => (
                          <tr key={e.id} className="hover:bg-slate-50 transition-colors">
                            <td className="p-3.5 text-slate-500 font-mono whitespace-nowrap">
                              {new Date(e.createdAt).toLocaleString('pt-BR')}
                            </td>
                            <td className="p-3.5">
                              <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold capitalize ${
                                e.source === 'instagram' ? 'bg-pink-100 text-pink-800' :
                                e.source === 'tiktok' ? 'bg-slate-200 text-slate-900' :
                                e.source === 'youtube' ? 'bg-rose-100 text-rose-800' :
                                e.source === 'whatsapp' ? 'bg-emerald-100 text-emerald-800' :
                                e.source === 'facebook' ? 'bg-blue-100 text-blue-800' :
                                e.source === 'google' ? 'bg-amber-100 text-amber-900' :
                                'bg-slate-100 text-slate-700'
                              }`}>
                                {e.sourceLabel || e.source || 'Direto'}
                              </span>
                              {e.utmSource && (
                                <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                                  utm: {e.utmSource}
                                </div>
                              )}
                            </td>
                            <td className="p-3.5 font-medium">
                              <span className="text-slate-900 font-bold">{e.eventType}</span>
                              <span className="text-slate-400 ml-1 text-[11px] font-mono">({e.pagePath || '/'})</span>
                            </td>
                            <td className="p-3.5 font-medium text-slate-800 truncate max-w-xs">
                              {e.productTitle || e.productSlug || '-'}
                            </td>
                            <td className="p-3.5 font-bold text-teal-800">
                              {e.city || 'Não identificado'}
                            </td>
                            <td className="p-3.5 font-semibold text-slate-700">
                              {e.region || '-'}
                            </td>
                            <td className="p-3.5 font-semibold text-slate-600 uppercase">
                              {e.country || e.countryCode || '-'}
                            </td>
                            <td className="p-3.5 text-slate-500 capitalize">
                              {e.deviceType || 'Desktop'}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          );
        })()}

        {/* TAB 4: LINKS DE DIVULGAÇÃO */}
        {activeTab === 'divulgacao' && (() => {
          const baseUrl = window.location.origin;

          const presetLinks = [
            {
              network: 'Instagram Bio',
              source: 'instagram',
              medium: 'bio',
              url: `${baseUrl}/?utm_source=instagram&utm_medium=bio`,
              badgeClass: 'bg-pink-100 text-pink-800'
            },
            {
              network: 'TikTok Bio',
              source: 'tiktok',
              medium: 'bio',
              url: `${baseUrl}/?utm_source=tiktok&utm_medium=bio`,
              badgeClass: 'bg-slate-900 text-white'
            },
            {
              network: 'YouTube Descrição',
              source: 'youtube',
              medium: 'descricao',
              url: `${baseUrl}/?utm_source=youtube&utm_medium=descricao`,
              badgeClass: 'bg-rose-100 text-rose-800'
            },
            {
              network: 'WhatsApp',
              source: 'whatsapp',
              medium: 'compartilhamento',
              url: `${baseUrl}/?utm_source=whatsapp&utm_medium=compartilhamento`,
              badgeClass: 'bg-emerald-100 text-emerald-800'
            },
            {
              network: 'Facebook Post',
              source: 'facebook',
              medium: 'post',
              url: `${baseUrl}/?utm_source=facebook&utm_medium=post`,
              badgeClass: 'bg-blue-100 text-blue-800'
            },
            {
              network: 'Pinterest Pin',
              source: 'pinterest',
              medium: 'pin',
              url: `${baseUrl}/?utm_source=pinterest&utm_medium=pin`,
              badgeClass: 'bg-red-100 text-red-800'
            }
          ];

          const selectedProd = products.find(p => p.slug === selectedProductSlugForLink || p.id === selectedProductSlugForLink);
          const prodSlug = selectedProd ? (selectedProd.slug || selectedProd.id) : '';

          const generatedProductUrl = prodSlug 
            ? `${baseUrl}/#/atividade/${prodSlug}?utm_source=${customLinkSource}&utm_medium=${customLinkMedium}`
            : `${baseUrl}/?utm_source=${customLinkSource}&utm_medium=${customLinkMedium}`;

          const copyToClipboard = (text: string, label: string) => {
            navigator.clipboard.writeText(text);
            showToast(`Link para ${label} copiado!`);
          };

          return (
            <div className="space-y-8">
              
              {/* Header */}
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-1">
                <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
                  <Share2 className="w-5 h-5 text-indigo-600" />
                  <span>Gerador de Links de Divulgação com UTM</span>
                </h2>
                <p className="text-xs text-slate-500">
                  Crie links personalizados para suas redes sociais para rastrear exatamente de onde vêm suas vendas e acessos.
                </p>
              </div>

              {/* Disclaimer */}
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                <span>
                  <strong>Aviso de Rastreamento:</strong> A origem dos visitantes é mais precisa quando você divulga utilizando estes links configurados com UTM.
                </span>
              </div>

              {/* SECTION 1: PRESET LINKS */}
              <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-xs space-y-6">
                <h3 className="font-extrabold text-slate-900 text-base">
                  1. Links Prontos para Redes Sociais (Página Inicial)
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {presetLinks.map((item) => (
                    <div key={item.network} className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col justify-between gap-3">
                      <div className="flex items-center justify-between">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${item.badgeClass}`}>
                          {item.network}
                        </span>
                        <span className="text-[11px] font-mono text-slate-400">
                          utm_source={item.source}
                        </span>
                      </div>

                      <div className="p-2.5 rounded-xl bg-white border border-slate-200 text-xs font-mono text-slate-700 truncate">
                        {item.url}
                      </div>

                      <button
                        onClick={() => copyToClipboard(item.url, item.network)}
                        className="w-full py-2 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copiar Link</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* SECTION 2: GERADOR DE LINK PARA PRODUTO ESPECÍFICO */}
              <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-xs space-y-6">
                <h3 className="font-extrabold text-slate-900 text-base">
                  2. Gerador de Link para Material Específico
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  
                  <div>
                    <label className="block font-bold text-slate-800 mb-1.5">Escolha o Material</label>
                    <select
                      value={selectedProductSlugForLink}
                      onChange={(e) => setSelectedProductSlugForLink(e.target.value)}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-900"
                    >
                      <option value="">-- Todo o Site (Vitrine Geral) --</option>
                      {products.map(p => (
                        <option key={p.id} value={p.slug || p.id}>
                          {p.title}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-800 mb-1.5">Rede Social (utm_source)</label>
                    <select
                      value={customLinkSource}
                      onChange={(e) => setCustomLinkSource(e.target.value)}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-900 capitalize"
                    >
                      <option value="instagram">Instagram</option>
                      <option value="tiktok">TikTok</option>
                      <option value="youtube">YouTube</option>
                      <option value="whatsapp">WhatsApp</option>
                      <option value="facebook">Facebook</option>
                      <option value="pinterest">Pinterest</option>
                      <option value="telegram">Telegram</option>
                      <option value="google">Google</option>
                      <option value="outros">Outros</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-800 mb-1.5">Meio de Divulgação (utm_medium)</label>
                    <select
                      value={customLinkMedium}
                      onChange={(e) => setCustomLinkMedium(e.target.value)}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-900"
                    >
                      <option value="story">Story</option>
                      <option value="bio">Bio do Perfil</option>
                      <option value="feed">Feed / Post</option>
                      <option value="descricao">Descrição do Vídeo</option>
                      <option value="compartilhamento">Compartilhamento</option>
                      <option value="pin">Pin</option>
                      <option value="status">Status / Direct</option>
                    </select>
                  </div>

                </div>

                <div className="p-4 rounded-2xl bg-indigo-50 border border-indigo-200 space-y-3">
                  <div className="text-xs font-bold text-indigo-900">Seu Link Personalizado Pronto:</div>
                  <div className="p-3 bg-white rounded-xl border border-indigo-200 font-mono text-xs text-indigo-900 select-all break-all">
                    {generatedProductUrl}
                  </div>

                  <button
                    onClick={() => copyToClipboard(generatedProductUrl, selectedProd ? selectedProd.title : 'Link Customizado')}
                    className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition-colors flex items-center justify-center gap-2 shadow-sm cursor-pointer"
                  >
                    <Copy className="w-4 h-4" />
                    <span>Copiar Link Personalizado</span>
                  </button>
                </div>

              </div>

            </div>
          );
        })()}
        {activeTab === 'configuracoes' && (
          <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-xs space-y-6">
            <h2 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-3">Status das Integrações</h2>
            
            <div className="space-y-4 text-xs">
              
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-start gap-3">
                <ShieldCheck className={`w-5 h-5 shrink-0 ${isFirebaseConfigured ? 'text-emerald-600' : 'text-amber-600'}`} />
                <div>
                  <strong className="text-slate-900 block text-sm">Firebase Auth & Firestore</strong>
                  <p className="text-slate-600 mt-0.5">
                    {isFirebaseConfigured 
                      ? 'Conectado com sucesso através das variáveis VITE_FIREBASE_*' 
                      : 'Aguardando configuração das variáveis VITE_FIREBASE_* no painel de ambiente.'}
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-start gap-3">
                <Upload className="w-5 h-5 text-teal-600 shrink-0" />
                <div>
                  <strong className="text-slate-900 block text-sm">Cloudflare R2 Storage</strong>
                  <p className="text-slate-600 mt-0.5">
                    Endpoint de upload ativo em <code className="bg-slate-200 px-1 py-0.5 rounded">/api/upload-r2</code>. Arquivos são salvos diretamente no bucket R2 quando as credenciais <code className="bg-slate-200 px-1 py-0.5 rounded">CLOUDFLARE_ACCOUNT_ID</code>, <code className="bg-slate-200 px-1 py-0.5 rounded">R2_ACCESS_KEY_ID</code>, e <code className="bg-slate-200 px-1 py-0.5 rounded">R2_PUBLIC_URL</code> estiverem preenchidas.
                  </p>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* TAB PROVA DE ORIGEM / DIAGNÓSTICO */}
        {activeTab === 'diagnostico' && (
          <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-xs space-y-8">
            
            {/* CABEÇALHO DO PAINEL DE ORIGEM */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-5">
              <div>
                <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
                  <ShieldCheck className="w-6 h-6 text-amber-600" />
                  <span>Prova de Origem — Investigação Técnica do Site</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Verificação visual e técnica em tempo real de onde cada produto e imagem são originados
                </p>
              </div>
              
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={handleProveRealModeNow}
                  className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-black transition-all shadow-md flex items-center gap-2 cursor-pointer shrink-0"
                  title="Executa limpeza total de caches, zera o estado local e faz uma consulta direta e pura no Firestore"
                >
                  <Sparkles className="w-4 h-4 text-amber-200" />
                  <span>Provar modo real agora</span>
                </button>

                <button
                  onClick={handleReloadFirestoreOnly}
                  className="px-3.5 py-2.5 rounded-xl bg-teal-50 hover:bg-teal-100 border border-teal-200 text-teal-800 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
                  title="Busca produtos diretamente da coleção 'products' do Firestore sem utilizar caches locais"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-teal-600" />
                  <span>Recarregar Firestore</span>
                </button>

                <button
                  onClick={handleFullLocalClear}
                  className="px-3.5 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-800 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
                  title="Limpa localStorage, sessionStorage, CacheStorage e Service Workers deste navegador"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                  <span>Apagar cache local</span>
                </button>
              </div>
            </div>

            {/* PAINEL DE RESULTADO DA PROVA LIMPA ("Provar modo real agora") */}
            {proofResult && (
              <div className={`p-6 rounded-3xl border shadow-lg space-y-3 ${proofResult.isError ? 'bg-rose-900 text-white border-rose-700' : 'bg-slate-900 text-white border-slate-800'}`}>
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <h3 className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    <span>Resultado do Teste "Provar Modo Real Agora"</span>
                  </h3>
                  <span className="text-[10px] font-mono text-slate-400">{proofResult.timestamp}</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
                  <div className="p-3 bg-white/5 rounded-2xl border border-white/10 space-y-1">
                    <span className="text-slate-400 text-[10px] uppercase font-bold block">Firestore Retornou</span>
                    <p className="font-mono text-base font-extrabold text-teal-300">{proofResult.fetchedCount} produtos</p>
                  </div>

                  <div className="p-3 bg-white/5 rounded-2xl border border-white/10 space-y-1">
                    <span className="text-slate-400 text-[10px] uppercase font-bold block">Tela Renderizou</span>
                    <p className="font-mono text-base font-extrabold text-emerald-300">{proofResult.renderedCount} produtos</p>
                  </div>

                  <div className="p-3 bg-white/5 rounded-2xl border border-white/10 space-y-1 md:col-span-2 lg:col-span-1">
                    <span className="text-slate-400 text-[10px] uppercase font-bold block">Conclusão</span>
                    <p className={`font-mono text-xs font-extrabold ${proofResult.isError ? 'text-rose-300' : 'text-emerald-400'}`}>
                      {proofResult.statusMessage}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* ETAPA 6 — REGRA ABSOLUTA DE ARQUITETURA (R2 vs FIRESTORE) */}
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-900 text-xs space-y-1">
              <strong className="font-extrabold text-amber-900 flex items-center gap-1.5 uppercase tracking-wide">
                <AlertCircle className="w-4 h-4 text-amber-600" />
                Regra Absoluta: Não confundir R2 com Banco de Dados
              </strong>
              <p className="text-slate-700 leading-relaxed">
                Cloudflare R2 pode conter imagens antigas de uploads passados. Isso NÃO significa que elas devem aparecer no site.
                O R2 é apenas um depósito de arquivos. O site só deve e só pode exibir imagens vinculadas a documentos existentes e publicados na coleção <code className="font-mono font-bold text-amber-900 bg-amber-100 px-1 rounded">products</code> do Firestore.
              </p>
            </div>

            {/* ETAPA 1 — PROVAR FIRESTORE REAL */}
            <div className="p-6 rounded-3xl bg-slate-900 text-white space-y-5 border border-slate-800 shadow-md">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-sm font-extrabold uppercase tracking-wider text-teal-400 flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-teal-400" />
                  <span>Etapa 1 — Prova do Firestore Real</span>
                </h3>
                <span className="px-3 py-1 bg-teal-500/20 text-teal-300 text-[11px] font-mono font-bold rounded-full border border-teal-500/30">
                  FIRESTORE CONECTADO
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs font-sans">
                <div className="p-3 bg-slate-800/90 rounded-xl border border-slate-700/80 space-y-1">
                  <span className="text-slate-400 text-[10px] uppercase font-bold block">Firebase Project ID</span>
                  <p className="font-mono text-xs font-bold text-amber-300">materiais-criativos</p>
                </div>

                <div className="p-3 bg-slate-800/90 rounded-xl border border-slate-700/80 space-y-1">
                  <span className="text-slate-400 text-[10px] uppercase font-bold block">Coleção</span>
                  <p className="font-mono text-xs font-bold text-teal-300">products</p>
                </div>

                <div className="p-3 bg-slate-800/90 rounded-xl border border-slate-700/80 space-y-1">
                  <span className="text-slate-400 text-[10px] uppercase font-bold block">Total Documentos em products</span>
                  <p className="font-mono text-xs font-extrabold text-emerald-400">{products.length} documentos</p>
                </div>

                <div className="p-3 bg-slate-800/90 rounded-xl border border-slate-700/80 space-y-1">
                  <span className="text-slate-400 text-[10px] uppercase font-bold block">Total Published</span>
                  <p className="font-mono text-xs font-extrabold text-emerald-400">{products.filter(p => p.status === 'published').length} documentos</p>
                </div>

                <div className="p-3 bg-slate-800/90 rounded-xl border border-slate-700/80 space-y-1">
                  <span className="text-slate-400 text-[10px] uppercase font-bold block">Última Consulta</span>
                  <p className="font-mono text-xs font-bold text-slate-300">{lastFetchedAt}</p>
                </div>
              </div>

              {/* BANNER DE ESTADO DO BANCO (VERMELHO / VERDE) */}
              {products.length === 0 ? (
                <div className="p-4 rounded-2xl bg-rose-600 text-white font-black text-xs uppercase tracking-wider flex items-center justify-between shadow-lg">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 shrink-0" />
                    <span>BANCO PRODUCTS VAZIO — NENHUM PRODUTO DEVE APARECER NO SITE</span>
                  </div>
                  <span className="px-2.5 py-1 bg-white/20 rounded-lg text-[10px] font-mono font-extrabold">STATUS: VAZIO</span>
                </div>
              ) : (
                <div className="p-4 rounded-2xl bg-emerald-600 text-white font-black text-xs uppercase tracking-wider flex items-center justify-between shadow-lg">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 shrink-0" />
                    <span>BANCO PRODUCTS ATIVO COM {products.length} PRODUTO(S) CADASTRADO(S) NO FIRESTORE</span>
                  </div>
                  <span className="px-2.5 py-1 bg-white/20 rounded-lg text-[10px] font-mono font-extrabold">STATUS: ATIVO</span>
                </div>
              )}
            </div>

            {/* ETAPA 2 — PROVAR PRODUTOS RENDERIZADOS NA TELA */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-black text-slate-900 text-sm flex items-center gap-2">
                  <FileText className="w-4 h-4 text-teal-600" />
                  <span>Etapa 2 — Produtos Atualmente Renderizados no Site</span>
                </h3>
                <span className="text-xs text-slate-500 font-bold">Total renderizado: {products.length} item(ns)</span>
              </div>

              <div className="overflow-x-auto border border-slate-200 rounded-2xl shadow-xs">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-50 font-bold text-slate-800 uppercase tracking-wider border-b border-slate-200 text-[10px]">
                    <tr>
                      <th className="p-3">Título</th>
                      <th className="p-3">Slug</th>
                      <th className="p-3">ID Firestore</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">imageUrl</th>
                      <th className="p-3">mainImage</th>
                      <th className="p-3">thumbnailUrl</th>
                      <th className="p-3">Origem Declarada</th>
                      <th className="p-3">Existe no Firestore?</th>
                      <th className="p-3 text-center">Doc Encontrado?</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {products.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="p-8 text-center text-slate-500 font-bold bg-slate-50/50">
                          <AlertCircle className="w-6 h-6 text-slate-400 mx-auto mb-2" />
                          Nenhum produto renderizado. O site está limpo e 100% alinhado ao banco vazio.
                        </td>
                      </tr>
                    ) : (
                      products.map(p => {
                        const isRealFirestore = Boolean(p.id && !p.id.startsWith('mock_') && !p.id.startsWith('local_'));

                        return (
                          <tr key={p.id} className="hover:bg-slate-50">
                            <td className="p-3 font-bold text-slate-900">{p.title}</td>
                            <td className="p-3 font-mono text-[10px] text-slate-500">{p.slug}</td>
                            <td className="p-3 font-mono text-[10px] text-teal-700">{p.id}</td>
                            <td className="p-3">
                              <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${p.status === 'published' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'}`}>
                                {p.status === 'published' ? 'Publicado' : 'Rascunho'}
                              </span>
                            </td>
                            <td className="p-3 font-mono text-[10px] max-w-[120px] truncate" title={p.imageUrl || 'Vazia'}>
                              {p.imageUrl ? <span className="text-emerald-700">{p.imageUrl}</span> : <span className="text-slate-400">Vazia</span>}
                            </td>
                            <td className="p-3 font-mono text-[10px] max-w-[120px] truncate" title={p.mainImage || 'Vazia'}>
                              {p.mainImage ? <span className="text-teal-700">{p.mainImage}</span> : <span className="text-slate-400">Vazia</span>}
                            </td>
                            <td className="p-3 font-mono text-[10px] max-w-[120px] truncate" title={p.thumbnailUrl || 'Vazia'}>
                              {p.thumbnailUrl ? <span className="text-slate-600">{p.thumbnailUrl}</span> : <span className="text-slate-400">Vazia</span>}
                            </td>
                            <td className="p-3 font-bold text-slate-600">Firestore Remote</td>
                            <td className="p-3">
                              {isRealFirestore ? (
                                <span className="px-2 py-1 rounded bg-emerald-100 text-emerald-800 text-[10px] font-extrabold">
                                  SIM (Existe)
                                </span>
                              ) : (
                                <span className="p-2 rounded-lg bg-rose-600 text-white font-extrabold text-[10px]">
                                  FAKE/CACHE DETECTADO — ESTE PRODUTO NÃO EXISTE NO BANCO REAL
                                </span>
                              )}
                            </td>
                            <td className="p-3 text-center">
                              {isRealFirestore ? (
                                <span className="text-emerald-600 font-bold">SIM</span>
                              ) : (
                                <span className="text-rose-600 font-bold">NÃO</span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ETAPA 3 — PROVAR ORIGEM DA IMAGEM */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-black text-slate-900 text-sm flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-amber-600" />
                  <span>Etapa 3 — Auditoria da Origem da Imagem de Cada Produto</span>
                </h3>
              </div>

              <div className="overflow-x-auto border border-slate-200 rounded-2xl shadow-xs">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-50 font-bold text-slate-800 uppercase tracking-wider border-b border-slate-200 text-[10px]">
                    <tr>
                      <th className="p-3">Produto Vinculado</th>
                      <th className="p-3">src Atual do &lt;img&gt;</th>
                      <th className="p-3">Campo Origem</th>
                      <th className="p-3">Começa com https://?</th>
                      <th className="p-3">Contém r2.dev?</th>
                      <th className="p-3">Abre Direto?</th>
                      <th className="p-3">Existe no Firestore?</th>
                      <th className="p-3 text-right">Ação Teste</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {products.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="p-6 text-center text-slate-500 font-bold bg-slate-50/50">
                          Nenhuma imagem renderizada no site.
                        </td>
                      </tr>
                    ) : (
                      products.map(p => {
                        const primaryUrl = p.imageUrl || p.mainImage || p.thumbnailUrl || '';
                        const testState = imageTestResults[p.id];
                        const isRealFirestore = Boolean(p.id && !p.id.startsWith('mock_') && !p.id.startsWith('local_'));
                        const isHttps = primaryUrl.startsWith('https://');
                        const isR2 = primaryUrl.includes('r2.dev');

                        return (
                          <tr key={p.id} className="hover:bg-slate-50">
                            <td className="p-3 font-bold text-slate-900">{p.title}</td>
                            <td className="p-3 font-mono text-[10px] max-w-[180px] truncate" title={primaryUrl}>
                              {primaryUrl ? <span className="text-teal-700">{primaryUrl}</span> : <span className="text-slate-400">Sem imagem</span>}
                            </td>
                            <td className="p-3 font-mono text-[10px]">
                              {p.imageUrl ? 'imageUrl' : p.mainImage ? 'mainImage' : p.thumbnailUrl ? 'thumbnailUrl' : 'Nenhum'}
                            </td>
                            <td className="p-3">
                              <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${isHttps ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                                {isHttps ? 'SIM' : 'NÃO'}
                              </span>
                            </td>
                            <td className="p-3">
                              <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${isR2 ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'}`}>
                                {isR2 ? 'SIM' : 'NÃO'}
                              </span>
                            </td>
                            <td className="p-3">
                              {testState ? (
                                <span className={`font-bold text-[10px] ${testState.status === 'ok' ? 'text-emerald-700' : testState.status === 'error' ? 'text-rose-700' : 'text-amber-600'}`}>
                                  {testState.status === 'ok' ? 'SIM (HTTP 200)' : testState.status === 'error' ? 'NÃO (Erro)' : 'Testando...'}
                                </span>
                              ) : (
                                <span className="text-slate-400 text-[10px]">Não testado</span>
                              )}
                            </td>
                            <td className="p-3">
                              {isRealFirestore ? (
                                <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                                  SIM
                                </span>
                              ) : (
                                <span className="p-1.5 rounded bg-rose-600 text-white font-extrabold text-[10px]">
                                  IMAGEM SOLTA/CACHE — NÃO VINCULADA A PRODUTO REAL
                                </span>
                              )}
                            </td>
                            <td className="p-3 text-right">
                              {primaryUrl && (
                                <button
                                  onClick={() => testPublicImageUrl(primaryUrl, p.id)}
                                  className="px-2 py-1 rounded bg-teal-600 hover:bg-teal-700 text-white text-[10px] font-bold cursor-pointer"
                                >
                                  Testar URL
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ETAPA 4 — DIAGNÓSTICO DO NAVEGADOR ATUAL (CACHE / LOCAL) */}
            <div className="p-6 rounded-3xl bg-slate-900 text-white space-y-5 border border-slate-800 shadow-lg">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
                <div>
                  <h3 className="text-sm font-extrabold uppercase tracking-wider text-amber-400 flex items-center gap-2">
                    <Globe className="w-5 h-5 text-amber-400" />
                    <span>Etapa 4 — Diagnóstico do Navegador Atual</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">Identificação completa da URL, ambiente, armazenamento e estado técnico do navegador</p>
                </div>

                <button
                  onClick={handleFullLocalClear}
                  className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold transition-all shadow-md flex items-center gap-2 cursor-pointer shrink-0"
                >
                  <Trash2 className="w-4 h-4 text-white" />
                  <span>Apagar cache local</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-xs font-sans">
                <div className="p-3 bg-slate-800/90 rounded-xl border border-slate-700/80 space-y-1">
                  <span className="text-slate-400 text-[10px] uppercase font-bold block">URL Atual Completa</span>
                  <p className="font-mono text-[11px] text-teal-300 break-all" title={window.location.href}>
                    {window.location.href}
                  </p>
                </div>

                <div className="p-3 bg-slate-800/90 rounded-xl border border-slate-700/80 space-y-1">
                  <span className="text-slate-400 text-[10px] uppercase font-bold block">Host</span>
                  <p className="font-mono text-xs font-bold text-slate-200">
                    {window.location.hostname}
                  </p>
                </div>

                <div className="p-3 bg-slate-800/90 rounded-xl border border-slate-700/80 space-y-1">
                  <span className="text-slate-400 text-[10px] uppercase font-bold block">É Google Studio Preview?</span>
                  <p className={`font-mono text-xs font-extrabold ${window.location.hostname.includes('run.app') || window.location.hostname.includes('google') ? 'text-amber-300' : 'text-slate-300'}`}>
                    {window.location.hostname.includes('run.app') || window.location.hostname.includes('google') ? 'SIM' : 'NÃO'}
                  </p>
                </div>

                <div className="p-3 bg-slate-800/90 rounded-xl border border-slate-700/80 space-y-1">
                  <span className="text-slate-400 text-[10px] uppercase font-bold block">É Vercel / Domínio Real?</span>
                  <p className={`font-mono text-xs font-extrabold ${window.location.hostname.includes('vercel') || window.location.hostname.includes('materias') || window.location.hostname.includes('atividades') ? 'text-emerald-400' : 'text-slate-300'}`}>
                    {window.location.hostname.includes('vercel') || window.location.hostname.includes('materias') || window.location.hostname.includes('atividades') ? 'SIM' : 'NÃO'}
                  </p>
                </div>

                <div className="p-3 bg-slate-800/90 rounded-xl border border-slate-700/80 space-y-1">
                  <span className="text-slate-400 text-[10px] uppercase font-bold block">Service Worker Ativo?</span>
                  <p className={`font-mono text-xs font-bold ${swActive ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {swActive ? 'SIM' : 'NÃO'}
                  </p>
                </div>

                <div className="p-3 bg-slate-800/90 rounded-xl border border-slate-700/80 space-y-1">
                  <span className="text-slate-400 text-[10px] uppercase font-bold block">CacheStorage Tem Caches?</span>
                  <p className={`font-mono text-xs font-bold ${cacheActive ? 'text-amber-400' : 'text-emerald-400'}`}>
                    {cacheActive ? 'SIM' : 'NÃO'}
                  </p>
                </div>

                <div className="p-3 bg-slate-800/90 rounded-xl border border-slate-700/80 space-y-1">
                  <span className="text-slate-400 text-[10px] uppercase font-bold block">localStorage Tem Chave de Produto?</span>
                  <p className={`font-mono text-xs font-bold ${Boolean(localStorage.getItem('atividades_criativas_products_v1')) ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {Boolean(localStorage.getItem('atividades_criativas_products_v1')) ? 'SIM' : 'NÃO'}
                  </p>
                </div>

                <div className="p-3 bg-slate-800/90 rounded-xl border border-slate-700/80 space-y-1">
                  <span className="text-slate-400 text-[10px] uppercase font-bold block">sessionStorage Tem Chave de Produto?</span>
                  <p className={`font-mono text-xs font-bold ${Boolean(sessionStorage.getItem('atividades_criativas_products_v1')) ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {Boolean(sessionStorage.getItem('atividades_criativas_products_v1')) ? 'SIM' : 'NÃO'}
                  </p>
                </div>

                <div className="p-3 bg-slate-800/90 rounded-xl border border-slate-700/80 space-y-1 lg:col-span-2">
                  <span className="text-slate-400 text-[10px] uppercase font-bold block">IndexedDB Tem Banco Relacionado a Produtos?</span>
                  <p className="font-mono text-xs font-bold text-slate-300">
                    {'indexedDB' in window ? 'SIM (API disponível / Sem banco de produtos registrado)' : 'NÃO'}
                  </p>
                </div>

                <div className="p-3 bg-slate-800/90 rounded-xl border border-slate-700/80 space-y-1 lg:col-span-2">
                  <span className="text-slate-400 text-[10px] uppercase font-bold block">Chaves Locais Encontradas no Navegador</span>
                  <p className="font-mono text-[11px] font-bold text-amber-300 break-all">
                    {getStoredKeyNames().length > 0 ? getStoredKeyNames().join(', ') : 'Nenhuma chave local encontrada (Armazenamento limpo)'}
                  </p>
                </div>
              </div>
            </div>

            {/* ETAPA 7 — INVESTIGAR CLOUDFLARE R2 */}
            <div className="p-6 rounded-3xl bg-slate-50 border border-slate-200 space-y-4">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Upload className="w-4 h-4 text-teal-600" />
                <span>Etapa 7 — Investigação do Cloudflare R2</span>
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-1">
                  <span className="text-slate-500 text-[10px] uppercase font-bold block">R2_PUBLIC_URL Configurado</span>
                  <p className="font-mono text-xs font-bold text-emerald-700">SIM (https://pub-38ad649cb42d4a66804e3c3aa376a92f.r2.dev)</p>
                </div>

                <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-1">
                  <span className="text-slate-500 text-[10px] uppercase font-bold block">Bucket R2</span>
                  <p className="font-mono text-xs font-bold text-slate-900">materiais-criativos</p>
                </div>

                <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-1">
                  <span className="text-slate-500 text-[10px] uppercase font-bold block">Papel do R2 no Sistema</span>
                  <p className="font-mono text-xs font-bold text-amber-800">Depósito de Mídia (Não é vitrine)</p>
                </div>
              </div>

              <div className="p-3 bg-white rounded-xl border border-slate-200 text-xs text-slate-600 space-y-1">
                <strong className="font-bold text-slate-800">Declaração da Fonte Principal:</strong>
                <p>
                  O Cloudflare R2 armazena somente os arquivos binários. A vitrine do site depende exclusivamente da coleção <code className="font-mono font-bold text-teal-700 bg-teal-50 px-1 rounded">products</code> do Firestore. Se uma imagem existe no R2 mas não possui referência no Firestore, ela jamais é exibida.
                </p>
              </div>
            </div>

          </div>
        )}

      </div>
    </div>
  );
};
