import { Product } from '../types';
import { initialProducts } from '../data/initialProducts';
import { generateSlug } from '../utils/slug';
import { isFirebaseConfigured } from './firebase';

const STORAGE_KEY = 'atividades_criativas_products_v1';

export function getProducts(): Product[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      if (isFirebaseConfigured) return [];
      saveProducts(initialProducts);
      return initialProducts.map((p, idx) => ({
        ...p,
        status: p.status || 'published',
        socialFeatured: p.socialFeatured ?? p.featured ?? false,
        displayOrder: p.displayOrder ?? idx + 1
      }));
    }
    const parsed: Product[] = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      if (isFirebaseConfigured) return [];
      saveProducts(initialProducts);
      return initialProducts.map((p, idx) => ({
        ...p,
        status: p.status || 'published',
        socialFeatured: p.socialFeatured ?? p.featured ?? false,
        displayOrder: p.displayOrder ?? idx + 1
      }));
    }
    // Ensure all items have a valid slug, status, displayOrder
    return parsed.map((item, idx) => ({
      ...item,
      slug: item.slug || generateSlug(item.title),
      status: item.status || 'published',
      socialFeatured: item.socialFeatured ?? item.featured ?? false,
      displayOrder: item.displayOrder ?? idx + 1
    }));
  } catch (e) {
    if (isFirebaseConfigured) return [];
    return initialProducts;
  }
}

export function saveProducts(products: Product[]): void {
  try {
    const cleanUrl = (url?: string) => {
      if (!url) return '';
      if (url.startsWith('data:') && url.length > 2000) {
        return '';
      }
      return url;
    };

    const sanitized = products.map((item, idx) => {
      const mainImg = cleanUrl(item.mainImage) || '';
      const thumbImg = cleanUrl(item.thumbnailUrl) || mainImg;
      const gallery = Array.isArray(item.galleryImages)
        ? item.galleryImages.map(img => cleanUrl(img)).filter(Boolean)
        : [];

      return {
        ...item,
        mainImage: mainImg,
        thumbnailUrl: thumbImg,
        galleryImages: gallery,
        slug: item.slug || generateSlug(item.title),
        status: item.status || 'published',
        socialFeatured: item.socialFeatured ?? item.featured ?? false,
        displayOrder: item.displayOrder ?? idx + 1
      };
    });

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitized));
    } catch (quotaError) {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch (innerError) {}
    }
  } catch (e) {}
}

export function getProductBySlug(slug: string): Product | undefined {
  const products = getProducts();
  const normalizedSearch = slug.toLowerCase().trim();
  
  return products.find(p => 
    (p.slug && p.slug.toLowerCase() === normalizedSearch) ||
    generateSlug(p.title) === normalizedSearch ||
    p.id.toLowerCase() === normalizedSearch
  );
}

export function addOrUpdateProduct(product: Partial<Product> & { title: string }): Product {
  const products = getProducts();
  const slug = product.slug || generateSlug(product.title);
  
  const existingIndex = products.findIndex(p => p.id === product.id || (p.slug && p.slug === slug));
  
  const fullProduct: Product = {
    id: product.id || `prod-${Date.now()}`,
    title: product.title,
    slug: slug,
    shortSummary: product.shortSummary || '',
    fullDescription: product.fullDescription || '',
    skillsWorked: product.skillsWorked || '',
    mainImage: product.mainImage || '',
    thumbnailUrl: product.thumbnailUrl || product.mainImage || '',
    galleryImages: Array.isArray(product.galleryImages) ? product.galleryImages : [],
    youtubeUrl: product.youtubeUrl || '',
    price: product.price || 19.90,
    formattedPrice: product.formattedPrice || `R$ ${(product.price || 19.90).toFixed(2).replace('.', ',')}`,
    hotmartLink: product.hotmartLink || '',
    category: product.category || 'Educação Infantil',
    targetAge: product.targetAge || '2 a 6 anos',
    pdfCount: product.pdfCount || 10,
    pageSize: product.pageSize || 'A4',
    featured: product.featured ?? false,
    socialFeatured: product.socialFeatured ?? product.featured ?? false,
    status: product.status || 'published',
    displayOrder: product.displayOrder ?? (existingIndex >= 0 ? existingIndex + 1 : products.length + 1),
    createdAt: product.createdAt || new Date().toISOString()
  };

  if (existingIndex >= 0) {
    products[existingIndex] = fullProduct;
  } else {
    products.unshift(fullProduct);
  }

  saveProducts(products);
  return fullProduct;
}

export function deleteProduct(id: string): void {
  const products = getProducts().filter(p => p.id !== id);
  saveProducts(products);
}

export function resetToDefaults(): void {
  saveProducts(initialProducts);
}
