import React, { useState, useEffect } from 'react';
import { Product } from '../types';
import { extractYoutubeEmbedId, generateSlug } from '../utils/slug';
import { trackProductView, trackHotmartClick, trackYoutubeClick } from '../services/analyticsService';
import { SEO } from '../components/SEO';
import { generateProductSchema } from '../utils/seo';
import { 
  FileText, 
  Printer, 
  Sparkles, 
  HelpCircle, 
  ChevronDown, 
  ChevronUp, 
  ShieldCheck, 
  ArrowDown, 
  ExternalLink, 
  CheckCircle2, 
  Video, 
  Image as ImageIcon, 
  BookOpen,
  AlertCircle
} from 'lucide-react';

interface ProductDetailPageProps {
  product: Product;
  onNavigate: (path: string) => void;
}

export const ProductDetailPage: React.FC<ProductDetailPageProps> = ({ product, onNavigate }) => {
  if (product._source !== 'firestore') {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-8 text-center space-y-4">
        <h2 className="text-2xl font-bold text-rose-700">Material bloqueado</h2>
        <p className="text-slate-600 max-w-md">Este produto não veio do Firestore real de produção.</p>
        <button
          onClick={() => onNavigate('/materiais')}
          className="px-6 py-2.5 rounded-xl bg-[#6BCB9A] hover:bg-[#55B987] text-white font-semibold text-sm transition-colors cursor-pointer shadow-xs"
        >
          Voltar para materiais
        </button>
      </div>
    );
  }

  const candidateImages = [
    product.imageUrl,
    product.mainImage,
    product.thumbnailUrl,
    ...(product.galleryImages || [])
  ].filter((url, idx, arr): url is string => Boolean(url && url.startsWith('https://')) && arr.indexOf(url) === idx);

  const [selectedImage, setSelectedImage] = useState<string>(candidateImages[0] || '');
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());
  const [imageError, setImageError] = useState<boolean>(false);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

  useEffect(() => {
    if (product) {
      setFailedImages(new Set());
      setImageError(false);
      setSelectedImage(candidateImages[0] || '');
      trackProductView(product);
    }
  }, [product?.id]);

  const handleMainImgError = () => {
    setFailedImages(prev => {
      const next = new Set(prev);
      if (selectedImage) next.add(selectedImage);
      const nextWorking = candidateImages.find(img => !next.has(img));
      if (nextWorking) {
        setSelectedImage(nextWorking);
      } else {
        setImageError(true);
      }
      return next;
    });
  };

  const youtubeEmbedId = extractYoutubeEmbedId(product.youtubeUrl);

  const scrollToDetails = () => {
    const el = document.getElementById('sobre-o-material');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const faqItems = [
    {
      q: 'O material é físico ou digital?',
      a: 'O produto é 100% digital em formato PDF. Você receberá o arquivo pronto para imprimir em sua própria impressora ou em uma gráfica.'
    },
    {
      q: 'Como recebo o PDF após a compra?',
      a: 'Assim que o pagamento for aprovado pela Hotmart, os links para download são enviados imediatamente para o seu e-mail cadastrado.'
    },
    {
      q: 'Posso imprimir em casa?',
      a: 'Sim! Os arquivos são formatados no padrão A4 e podem ser impressos em impressoras domésticas simples ou coloridas.'
    },
    {
      q: 'A compra é feita por onde?',
      a: 'A transação é realizada no ambiente seguro da Hotmart, que processa seu pagamento e garante a liberação do download imediato.'
    },
    {
      q: 'Posso falar com a loja antes de comprar?',
      a: 'Claro! Você pode tirar dúvidas enviando e-mail para atividadesinfantilcontato@gmail.com ou pelo suporte na página da bio.'
    }
  ];

  const productSlug = product.slug || generateSlug(product.title) || product.id;
  const canonicalUrl = `https://www.materiaiscriativos.com.br/atividade/${productSlug}`;
  const pageTitle = `${product.title} | Atividade Pedagógica em PDF para Imprimir`;
  const pageDescription = `${product.shortSummary || product.fullDescription?.slice(0, 150) || 'Atividade pedagógica em PDF'} Baixe atividade pedagógica em PDF para imprimir e aplicar com crianças.`;
  const ogImg = candidateImages[0] || 'https://www.materiaiscriativos.com.br/og-image.png';
  const schemaObj = generateProductSchema(product, canonicalUrl);

  return (
    <div className="min-h-screen bg-slate-50/50 pb-24">
      <SEO
        title={pageTitle}
        description={pageDescription}
        canonicalUrl={canonicalUrl}
        ogImage={ogImg}
        ogType="product"
        schemaData={schemaObj}
      />
      
      {/* Breadcrumb Header */}
      <div className="bg-white border-b border-slate-200/80 py-3 px-4 sm:px-6 lg:px-8 text-xs font-medium text-slate-500">
        <div className="max-w-6xl mx-auto flex items-center gap-2">
          <button onClick={() => onNavigate('/materiais')} className="hover:text-teal-700">
            Vitrine
          </button>
          <span>/</span>
          <span className="text-slate-800 font-semibold truncate max-w-xs sm:max-w-md">
            {product.title}
          </span>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-12 sm:space-y-16">
        
        {/* 1. HERO SECTION */}
        <section className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-8 md:p-10 shadow-xs">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            
            {/* Main Image View */}
            <div className="lg:col-span-6 space-y-4">
              <div className="aspect-4/3 rounded-2xl overflow-hidden bg-slate-100 border border-slate-200 shadow-inner relative flex items-center justify-center text-slate-400">
                {selectedImage && !imageError ? (
                  <img
                    src={selectedImage}
                    alt={`Atividade ${product.title} em PDF para imprimir`}
                    referrerPolicy="no-referrer"
                    onError={handleMainImgError}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Sparkles className="w-12 h-12 opacity-30" />
                )}
                <span className="absolute top-3 left-3 px-3 py-1 bg-white/95 text-slate-800 rounded-full text-xs font-bold shadow-xs">
                  {product.category}
                </span>
              </div>

              {/* Gallery Thumbnails */}
              {candidateImages.filter(img => !failedImages.has(img)).length > 1 && (
                <div className="flex items-center gap-3 overflow-x-auto pb-2">
                  {candidateImages.filter(img => !failedImages.has(img)).map((img, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setSelectedImage(img);
                        setImageError(false);
                      }}
                      className={`w-16 h-16 rounded-xl overflow-hidden border-2 transition-all shrink-0 ${
                        selectedImage === img ? 'border-teal-600 scale-105' : 'border-slate-200 opacity-70 hover:opacity-100'
                      }`}
                    >
                      <img 
                        src={img} 
                        alt={`Preview ${idx + 1}`} 
                        referrerPolicy="no-referrer"
                        onError={() => {
                          setFailedImages(prev => new Set(prev).add(img));
                        }}
                        className="w-full h-full object-cover" 
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Hero Details Header */}
            <div className="lg:col-span-6 space-y-6">
              
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-3 py-1 rounded-full bg-softgreen-bg text-[#2F8F6B] text-xs font-bold border border-softgreen-border flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-[#2F8F6B]" />
                  Material digital em PDF
                </span>
                {product.targetAge && (
                  <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold">
                    Indicação: {product.targetAge}
                  </span>
                )}
              </div>

              <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight leading-tight">
                {product.title}
              </h1>

              <p className="text-slate-600 text-base sm:text-lg leading-relaxed">
                {product.shortSummary}
              </p>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2 text-xs text-slate-600">
                <div className="flex items-center gap-2 font-medium text-slate-800">
                  <Printer className="w-4 h-4 text-[#2F8F6B]" />
                  <span>Pronto para baixar e imprimir em formato A4</span>
                </div>
                <p className="text-slate-500">
                  Nenhum produto físico será enviado pelos correios. Acesso instantâneo via Hotmart.
                </p>
              </div>

              {/* Scroll Button to Details (NO Hotmart buy button here) */}
              <button
                onClick={scrollToDetails}
                className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-[#6BCB9A] hover:bg-[#55B987] text-white font-bold text-sm transition-all shadow-md shadow-[#6BCB9A]/20 flex items-center justify-center gap-2"
              >
                <span>Ver detalhes do material</span>
                <ArrowDown className="w-4 h-4" />
              </button>

            </div>

          </div>
        </section>


        {/* 2. SOBRE ESTE MATERIAL (FULL DESCRIPTION) */}
        <section id="sobre-o-material" className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-8 md:p-10 shadow-xs space-y-6">
          <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
            <div className="p-2.5 rounded-2xl bg-softgreen-bg text-[#2F8F6B]">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900">Sobre este material</h2>
              <p className="text-xs text-slate-500">Conheça todos os detalhes da atividade</p>
            </div>
          </div>

          <div className="prose prose-slate max-w-none text-slate-700 text-sm sm:text-base leading-relaxed whitespace-pre-line font-normal">
            {product.fullDescription}
          </div>
        </section>


        {/* 3. VÍDEO (SE EXISTIR YOUTUBE) */}
        {youtubeEmbedId && (
          <section className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-8 md:p-10 shadow-xs space-y-6">
            <div className="flex items-center gap-3 pb-2">
              <div className="p-2.5 rounded-2xl bg-rose-50 text-rose-600">
                <Video className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">Veja o material na prática</h2>
                <p className="text-xs text-slate-500">Demonstração em vídeo do recurso em PDF</p>
              </div>
            </div>

            <div className="aspect-video w-full rounded-2xl overflow-hidden bg-slate-900 shadow-md">
              <iframe
                src={`https://www.youtube.com/embed/${youtubeEmbedId}`}
                title="Vídeo de apresentação do material"
                className="w-full h-full border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          </section>
        )}


        {/* 4. GALERIA DE IMAGENS */}
        {product.galleryImages && product.galleryImages.filter(img => Boolean(img && img.trim() !== '')).length > 0 && (
          <section className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-8 md:p-10 shadow-xs space-y-6">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
              <div className="p-2.5 rounded-2xl bg-softgreen-bg text-[#2F8F6B]">
                <ImageIcon className="w-6 h-6 text-[#2F8F6B]" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">Galeria de fotos do PDF</h2>
                <p className="text-xs text-slate-500">Veja amostras das páginas e atividades impressas</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
              {product.galleryImages.filter(img => Boolean(img && img.trim() !== '')).map((img, idx) => (
                <div
                  key={idx}
                  onClick={() => {
                    setSelectedImage(img);
                    window.scrollTo({ top: 120, behavior: 'smooth' });
                  }}
                  className="group aspect-square w-full rounded-2xl overflow-hidden bg-slate-100 border border-slate-200/90 shadow-xs hover:shadow-lg hover:border-[#6BCB9A] transition-all duration-300 cursor-pointer relative"
                >
                  <img
                    src={img}
                    alt={`Amostra da atividade ${idx + 1}`}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-black/25 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center p-2">
                    <span className="px-3 py-1.5 rounded-full bg-white/95 text-slate-900 text-xs font-bold shadow-md">
                      Ampliar no topo 🔍
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}


        {/* 5. O QUE O MATERIAL AJUDA A TRABALHAR (SE HOUVER) */}
        {product.skillsWorked && (
          <section className="bg-[#2F8F6B] text-white rounded-3xl p-6 sm:p-8 md:p-10 shadow-xl space-y-4">
            <div className="flex items-center gap-3">
              <Sparkles className="w-6 h-6 text-amber-300" />
              <h2 className="text-xl font-bold">O que este material ajuda a trabalhar:</h2>
            </div>
            <p className="text-emerald-50 text-sm sm:text-base leading-relaxed bg-white/10 p-5 rounded-2xl border border-white/20">
              {product.skillsWorked}
            </p>
          </section>
        )}


        {/* 6. INFORMAÇÕES DO MATERIAL (CARDS DETALHADOS) */}
        <section className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-8 md:p-10 shadow-xs space-y-6">
          <h2 className="text-xl font-bold text-slate-900 border-b border-slate-100 pb-4">
            Informações do material
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs sm:text-sm">
            
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-[#2F8F6B] shrink-0 mt-0.5" />
              <div>
                <strong className="text-slate-900 block">Produto Digital</strong>
                Arquivo em formato PDF
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-start gap-3">
              <Printer className="w-5 h-5 text-[#2F8F6B] shrink-0 mt-0.5" />
              <div>
                <strong className="text-slate-900 block">Pronto para imprimir</strong>
                Formatado em tamanho A4
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-start gap-3">
              <FileText className="w-5 h-5 text-[#2F8F6B] shrink-0 mt-0.5" />
              <div>
                <strong className="text-slate-900 block">Conteúdo completo</strong>
                {product.pdfCount || 10} páginas/arquivos digitais
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-[#2F8F6B] shrink-0 mt-0.5" />
              <div>
                <strong className="text-slate-900 block">Entrega imediata</strong>
                Acesso por e-mail pela Hotmart
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-start gap-3">
              <ExternalLink className="w-5 h-5 text-[#2F8F6B] shrink-0 mt-0.5" />
              <div>
                <strong className="text-slate-900 block">Compra pela Hotmart</strong>
                Plataforma 100% protegida
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
              <div className="text-amber-900">
                <strong className="block">Sem envio físico</strong>
                Nenhum produto enviado via correios
              </div>
            </div>

          </div>
        </section>


        {/* 7. COMO FUNCIONA A ENTREGA */}
        <section className="bg-softgreen-bg border border-softgreen-border rounded-3xl p-6 sm:p-8 space-y-3">
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-6 h-6 text-[#2F8F6B] shrink-0" />
            <h3 className="font-bold text-slate-900 text-lg">Como funciona a entrega</h3>
          </div>
          <p className="text-sm text-slate-700 leading-relaxed font-medium">
            Após a compra, o acesso ao material digital é enviado pela Hotmart para o seu e-mail cadastrado. Nenhum produto físico será enviado pelos correios. Você pode imprimir as folhas em casa ou em uma gráfica quantas vezes desejar.
          </p>
        </section>


        {/* 8. DÚVIDAS FREQUENTES (FAQ) */}
        <section className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-8 md:p-10 shadow-xs space-y-6">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
            <HelpCircle className="w-6 h-6 text-[#2F8F6B]" />
            <h2 className="text-xl font-bold text-slate-900">Dúvidas frequentes</h2>
          </div>

          <div className="space-y-3">
            {faqItems.map((item, idx) => (
              <div
                key={idx}
                className="border border-slate-200 rounded-2xl overflow-hidden transition-all"
              >
                <button
                  onClick={() => setOpenFaqIndex(openFaqIndex === idx ? null : idx)}
                  className="w-full text-left p-4 bg-slate-50 hover:bg-slate-100 font-bold text-slate-900 text-sm flex items-center justify-between gap-4 transition-colors"
                >
                  <span>{item.q}</span>
                  {openFaqIndex === idx ? <ChevronUp className="w-4 h-4 text-[#2F8F6B]" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                </button>
                {openFaqIndex === idx && (
                  <div className="p-4 bg-white text-xs sm:text-sm text-slate-600 leading-relaxed border-t border-slate-100">
                    {item.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>


        {/* 9. BLOCO FINAL DE COMPRA (HOTMART BUTTON HERE ONLY) */}
        <section className="bg-slate-900 text-white rounded-3xl p-8 sm:p-12 shadow-2xl text-center space-y-6 border border-slate-800">
          <div className="max-w-xl mx-auto space-y-3">
            <span className="px-3 py-1 rounded-full bg-softgreen-bg text-[#6BCB9A] text-xs font-bold border border-softgreen-border">
              Pronto para utilizar
            </span>

            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Adquira o material digital
            </h2>

            <p className="text-slate-300 text-sm leading-relaxed">
              Tenha acesso imediato ao arquivo PDF de "{product.title}" e comece a aplicar com as crianças hoje mesmo.
            </p>

            <div className="pt-2">
              <div className="text-xs text-slate-400 uppercase tracking-wider">Valor do arquivo digital:</div>
              <div className="text-3xl sm:text-4xl font-extrabold text-[#6BCB9A] mt-1">
                {product.formattedPrice || `R$ ${product.price.toFixed(2).replace('.', ',')}`}
              </div>
            </div>
          </div>

          {/* Hotmart Purchase Button */}
          <div className="pt-2 max-w-md mx-auto space-y-3">
            <a
              href={product.hotmartLink || 'https://pay.hotmart.com'}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackHotmartClick(product, product.hotmartLink || 'https://pay.hotmart.com')}
              className="w-full py-4 px-8 rounded-2xl bg-[#6BCB9A] hover:bg-[#55B987] active:bg-[#46a375] text-slate-950 font-extrabold text-lg transition-all duration-200 flex items-center justify-center gap-3 shadow-lg shadow-[#6BCB9A]/20 hover:scale-[1.02]"
            >
              <span>Comprar pela Hotmart</span>
              <ExternalLink className="w-5 h-5" />
            </a>

            <div className="flex items-center justify-center gap-2 text-xs text-slate-400 font-medium">
              <ShieldCheck className="w-4 h-4 text-[#6BCB9A]" />
              <span>Pagamento e entrega processados pela Hotmart</span>
            </div>
          </div>

          <p className="text-xs text-slate-500 pt-2 max-w-md mx-auto">
            Atividades Criativas Oficial • Arquivo digital em PDF para imprimir. Requer supervisão de adulto durante o manuseio de materiais por crianças.
          </p>
        </section>

      </div>

    </div>
  );
};
