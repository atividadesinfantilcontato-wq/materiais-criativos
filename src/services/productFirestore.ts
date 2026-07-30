import { collection, getDocs, doc, setDoc, deleteDoc, query } from 'firebase/firestore';
import { db, isFirebaseConfigured } from './firebase';
import { Product } from '../types';
import { getProducts, saveProducts } from './productStorage';

const COLLECTION_NAME = 'products';

// Helper to convert Firestore doc to Product
export function docToProduct(id: string, data: any): Product {
  const mainImg = data.imageUrl || data.mainImage || '';
  const priceNum = Number(data.price) || 19.90;

  return {
    id,
    title: data.title || '',
    slug: data.slug || '',
    shortSummary: data.summary || data.shortSummary || '',
    fullDescription: data.description || data.fullDescription || '',
    skillsWorked: data.skillsWorked || '',
    mainImage: mainImg,
    thumbnailUrl: data.thumbnailUrl || mainImg,
    galleryImages: Array.isArray(data.galleryImages) 
      ? data.galleryImages.filter((img: any) => typeof img === 'string') 
      : (data.galleryImages ? [String(data.galleryImages)] : []),
    youtubeUrl: data.youtubeUrl || '',
    price: priceNum,
    formattedPrice: `R$ ${priceNum.toFixed(2).replace('.', ',')}`,
    hotmartLink: data.hotmartUrl || data.hotmartLink || 'https://pay.hotmart.com/',
    category: data.category || 'Geral',
    targetAge: data.ageRange || data.targetAge || '2 a 6 anos',
    pdfCount: Number(data.pdfCount) || 10,
    pageSize: data.pageSize || 'A4',
    featured: Boolean(data.featured),
    socialFeatured: Boolean(data.socialFeatured ?? data.featured),
    status: (data.status === 'draft' ? 'draft' : 'published'),
    displayOrder: Number(data.displayOrder) || 1,
    createdAt: data.createdAt || new Date().toISOString()
  };
}

// Helper to ensure image URLs stay within Firestore document size limits (< 1MB)
function sanitizeFirestoreUrl(url?: string): string {
  if (!url) return '';
  // If image is a large inline base64 string, keep empty string to prevent Firestore document size limit issues
  if (url.startsWith('data:') && url.length > 2000) {
    return '';
  }
  return url;
}

// Helper to convert Product to Firestore doc payload
export function productToDoc(product: Product): Record<string, any> {
  const mainImg = sanitizeFirestoreUrl(product.mainImage);
  const thumbImg = sanitizeFirestoreUrl(product.thumbnailUrl) || mainImg;
  const gallery = Array.isArray(product.galleryImages)
    ? product.galleryImages.map(img => sanitizeFirestoreUrl(img)).filter(img => typeof img === 'string' && img.trim() !== '')
    : [];

  return {
    title: product.title || '',
    slug: product.slug || '',
    summary: product.shortSummary || '',
    shortSummary: product.shortSummary || '',
    description: product.fullDescription || '',
    fullDescription: product.fullDescription || '',
    skillsWorked: product.skillsWorked || '',
    category: product.category || 'Geral',
    ageRange: product.targetAge || '2 a 6 anos',
    targetAge: product.targetAge || '2 a 6 anos',
    pdfCount: Number(product.pdfCount) || 10,
    pageSize: product.pageSize || 'A4',
    imageUrl: mainImg,
    mainImage: mainImg,
    thumbnailUrl: thumbImg,
    galleryImages: gallery,
    youtubeUrl: product.youtubeUrl || '',
    price: Number(product.price) || 19.90,
    hotmartUrl: product.hotmartLink || '',
    hotmartLink: product.hotmartLink || '',
    status: product.status || 'published',
    featured: Boolean(product.featured),
    socialFeatured: Boolean(product.socialFeatured),
    displayOrder: Number(product.displayOrder) || 1,
    createdAt: product.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

// Fetch all products (Firestore if configured, fallback to localStorage only if Firebase not configured)
export async function fetchProductsAsync(): Promise<Product[]> {
  if (isFirebaseConfigured && db) {
    try {
      const q = query(collection(db, COLLECTION_NAME));
      const snapshot = await getDocs(q);
      const firestoreProducts: Product[] = [];
      snapshot.forEach(docSnap => {
        firestoreProducts.push(docToProduct(docSnap.id, docSnap.data()));
      });
      firestoreProducts.sort((a, b) => (a.displayOrder || 99) - (b.displayOrder || 99));
      
      // Remove any legacy local storage cache so old mock items never leak in
      try {
        localStorage.removeItem('atividades_criativas_products_v1');
      } catch (e) {}

      return firestoreProducts;
    } catch (err) {
      console.warn('Failed to fetch from Firestore:', err);
      return [];
    }
  }
  return getProducts();
}

// Save/Update product in Firestore + localStorage
export async function saveProductAsync(product: Partial<Product> & { id: string; title: string }): Promise<void> {
  if (isFirebaseConfigured && db) {
    try {
      const docRef = doc(db, COLLECTION_NAME, product.id);
      const payload = productToDoc(product as Product);
      // Set without merge so empty strings/arrays completely replace previous field values in Firestore
      await setDoc(docRef, payload);
    } catch (err) {
      console.error('Error saving product to Firestore:', err);
    }
  }
}

// Delete product from Firestore + localStorage
export async function deleteProductAsync(productId: string): Promise<void> {
  if (isFirebaseConfigured && db) {
    try {
      await deleteDoc(doc(db, COLLECTION_NAME, productId));
    } catch (err) {
      console.error('Error deleting product from Firestore:', err);
    }
  }
}
