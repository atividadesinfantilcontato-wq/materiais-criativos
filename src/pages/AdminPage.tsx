import React, { useState, useEffect } from 'react';
import { Product } from '../types';
import { addOrUpdateProduct, deleteProduct, resetToDefaults } from '../services/productStorage';
import { saveProductAsync, deleteProductAsync } from '../services/productFirestore';
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
  BarChart2, Share2, Copy, TrendingUp, Users, MousePointer, Smartphone, Globe, Link as LinkIcon, CheckCircle2
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
    if (confirm('Tem certeza que deseja excluir este produto?')) {
      deleteProduct(id);
      await deleteProductAsync(id);
      await onProductsUpdated();
      showToast('Produto excluído com sucesso!');
    }
  };

  const handleRemoveMainImage = () => {
    setEditingProduct(prev => prev ? { ...prev, mainImage: '', thumbnailUrl: '' } : null);
    showToast('Imagem principal removida.');
  };

  const handleClearGallery = () => {
    setEditingProduct(prev => prev ? { ...prev, galleryImages: [] } : null);
    showToast('Galeria de imagens esvaziada.');
  };

  const handleResetDefaults = () => {
    if (confirm('Deseja restaurar os produtos originais de fábrica?')) {
      resetToDefaults();
      onProductsUpdated();
      showToast('Produtos originais restaurados!');
    }
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
      setEditingProduct(prev => prev ? { ...prev, mainImage: url, thumbnailUrl: url } : null);
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

    if (!isValidHttpsUrl(editingProduct.mainImage) || !isValidHttpsUrl(editingProduct.thumbnailUrl)) {
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
      mainImage: editingProduct.mainImage || '',
      thumbnailUrl: editingProduct.thumbnailUrl || editingProduct.mainImage || '',
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

    // Save to LocalStorage
    addOrUpdateProduct(fullProduct);

    // Save to Firestore asynchronously
    await saveProductAsync(fullProduct);

    await onProductsUpdated();
    setEditingProduct(null);
    showToast(isNew ? 'Novo produto cadastrado com sucesso!' : 'Produto atualizado com sucesso!');
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
              <ImageIcon className="w-3.5 h-3.5" /> Diagnóstico de Imagens
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
                        value={editingProduct.mainImage || ''}
                        onChange={(e) => setEditingProduct({ ...editingProduct, mainImage: e.target.value, thumbnailUrl: e.target.value })}
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

                    {editingProduct.mainImage && editingProduct.mainImage.trim() !== '' && (
                      <div className="flex items-center justify-between gap-3 pt-1 border-t border-teal-200/60">
                        <div className="flex items-center gap-3 overflow-hidden">
                          <img src={editingProduct.mainImage} alt="Preview" className="w-16 h-12 object-cover rounded-lg border border-slate-200 shrink-0" />
                          <span className="text-xs text-slate-500 truncate max-w-xs">{editingProduct.mainImage}</span>
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
                              {(p.thumbnailUrl || p.mainImage) ? (
                                <img src={p.thumbnailUrl || p.mainImage} alt="" className="w-12 h-10 object-cover rounded-lg border border-slate-200 shrink-0" />
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
                        <th className="p-3.5">Dispositivo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {analyticsEvents.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="p-6 text-center text-slate-400">
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
                              <span className="text-slate-400 ml-1 text-[11px] font-mono">({e.path})</span>
                            </td>
                            <td className="p-3.5 font-medium text-slate-800 truncate max-w-xs">
                              {e.productTitle || e.productSlug || '-'}
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

        {/* TAB DIAGNÓSTICO DE IMAGENS */}
        {activeTab === 'diagnostico' && (
          <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-xs space-y-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
                  <ImageIcon className="w-5 h-5 text-amber-600" />
                  <span>Diagnóstico de Imagens</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">Auditoria técnica em tempo real de infraestrutura e integridade de imagens</p>
              </div>
              <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
                Modo: Somente Admin
              </span>
            </div>

            {/* STATUS DA INFRAESTRUTURA */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                <span className="text-slate-500 font-bold uppercase text-[10px]">Firebase Project ID</span>
                <div className="text-sm font-extrabold text-slate-900 font-mono">materiais-criativos</div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                <span className="text-slate-500 font-bold uppercase text-[10px]">Coleção do Firestore</span>
                <div className="text-sm font-extrabold text-slate-900 font-mono">products</div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                <span className="text-slate-500 font-bold uppercase text-[10px]">Total de Produtos Publicados</span>
                <div className="text-sm font-extrabold text-teal-700">
                  {products.filter(p => p.status === 'published').length} produtos
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                <span className="text-slate-500 font-bold uppercase text-[10px]">R2 Bucket Name</span>
                <div className="text-sm font-extrabold text-slate-900 font-mono">materiais-criativos</div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                <span className="text-slate-500 font-bold uppercase text-[10px]">Status do Último Upload R2</span>
                <div className={`text-sm font-extrabold ${lastR2UploadStatus === 'Sucesso' ? 'text-emerald-700' : lastR2UploadStatus === 'Erro' ? 'text-rose-700' : 'text-slate-600'}`}>
                  {lastR2UploadStatus}
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                <span className="text-slate-500 font-bold uppercase text-[10px]">Modo de Dados</span>
                <div className="text-sm font-extrabold text-indigo-700">
                  {isFirebaseConfigured ? 'Firestore Real (Ativo)' : 'Local State (Sem Firebase)'}
                </div>
              </div>
            </div>

            {/* ÚLTIMO ERRO OU SUCESSO DE UPLOAD */}
            {lastR2UploadError && (
              <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-900 space-y-1">
                <strong className="font-bold flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-rose-600" />
                  Último Erro de Upload R2:
                </strong>
                <p className="font-mono text-[11px]">{lastR2UploadError}</p>
              </div>
            )}

            {lastR2UploadUrl && (
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 space-y-1">
                <strong className="font-bold">Última URL Pública Gerada pelo R2:</strong>
                <div className="font-mono text-[11px] select-all break-all bg-white p-2 rounded-xl border border-emerald-200">
                  {lastR2UploadUrl}
                </div>
              </div>
            )}

            {/* AUDITORIA INDIVIDUAL DE PRODUTOS */}
            <div className="space-y-4">
              <h3 className="font-extrabold text-slate-900 text-sm">Auditoria de URLs nos Produtos Cadastrados</h3>
              <div className="overflow-x-auto border border-slate-200 rounded-2xl">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-50 font-bold text-slate-800 uppercase tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="p-3">Produto</th>
                      <th className="p-3">Imagem Principal</th>
                      <th className="p-3">Tipo da URL</th>
                      <th className="p-3">Galeria</th>
                      <th className="p-3 text-right">Status URL</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {products.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-4 text-center text-slate-400">Nenhum produto encontrado.</td>
                      </tr>
                    ) : (
                      products.map(p => {
                        const img = p.mainImage || p.thumbnailUrl || '';
                        const isHttps = img.startsWith('https://');
                        const isDataOrBlob = img.startsWith('data:') || img.startsWith('blob:');
                        const galleryValid = Array.isArray(p.galleryImages) && p.galleryImages.every(g => typeof g === 'string' && g.startsWith('https://'));

                        return (
                          <tr key={p.id} className="hover:bg-slate-50">
                            <td className="p-3 font-bold text-slate-900">{p.title}</td>
                            <td className="p-3 font-mono text-[11px] max-w-xs truncate" title={img || 'Sem imagem'}>
                              {img || <span className="text-slate-400">Vazia</span>}
                            </td>
                            <td className="p-3">
                              {isHttps ? (
                                <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-bold">HTTPS / R2</span>
                              ) : isDataOrBlob ? (
                                <span className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 text-[10px] font-bold">Base64 / Blob (Inválido)</span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px]">Sem URL</span>
                              )}
                            </td>
                            <td className="p-3 text-slate-600">
                              {Array.isArray(p.galleryImages) ? `${p.galleryImages.length} foto(s)` : '0'}
                            </td>
                            <td className="p-3 text-right">
                              {isHttps && galleryValid ? (
                                <span className="text-emerald-700 font-extrabold">VÁLIDO</span>
                              ) : (
                                <span className="text-amber-700 font-bold">VERIFICAR</span>
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

          </div>
        )}

      </div>
    </div>
  );
};
