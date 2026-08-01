import { collection, getDocs, doc, setDoc, deleteDoc, query, where, getDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from './firebase';
import { Product } from '../types';

const COLLECTION_NAME = 'products';

// Convert Firestore doc snapshot data to Product object
export function docToProduct(id: string, data: any): Product {
  const mainImg = typeof data.imageUrl === 'string' && data.imageUrl.startsWith('https://') 
    ? data.imageUrl 
    : (typeof data.mainImage === 'string' && data.mainImage.startsWith('https://') ? data.mainImage : '');
  
  const priceNum = Number(data.price) || 19.90;

  return {
    id,
    _firestoreId: id,
    _source: 'firestore',
    title: String(data.title || ''),
    slug: String(data.slug || ''),
    shortSummary: String(data.summary || data.shortSummary || ''),
    fullDescription: String(data.description || data.fullDescription || ''),
    skillsWorked: String(data.skillsWorked || ''),
    imageUrl: mainImg,
    mainImage: mainImg,
    thumbnailUrl: typeof data.thumbnailUrl === 'string' && data.thumbnailUrl.startsWith('https://') ? data.thumbnailUrl : mainImg,
    galleryImages: Array.isArray(data.galleryImages) 
      ? data.galleryImages.filter((img: any) => typeof img === 'string' && img.startsWith('https://')) 
      : [],
    youtubeUrl: String(data.youtubeUrl || ''),
    price: priceNum,
    formattedPrice: `R$ ${priceNum.toFixed(2).replace('.', ',')}`,
    hotmartLink: String(data.hotmartUrl || data.hotmartLink || 'https://pay.hotmart.com/'),
    category: String(data.category || 'Geral'),
    targetAge: String(data.ageRange || data.targetAge || '2 a 6 anos'),
    pdfCount: Number(data.pdfCount) || 10,
    pageSize: String(data.pageSize || 'A4'),
    featured: Boolean(data.featured),
    socialFeatured: Boolean(data.socialFeatured ?? data.featured),
    status: data.status === 'draft' ? 'draft' : 'published',
    displayOrder: Number(data.displayOrder) || 1,
    createdAt: String(data.createdAt || new Date().toISOString())
  };
}

// Convert Product object to Firestore document payload
export function productToDoc(product: Product): Record<string, any> {
  const mainImg = (product.imageUrl || product.mainImage || '').trim();
  const validMainImg = mainImg.startsWith('https://') ? mainImg : '';

  const thumbImg = (product.thumbnailUrl || validMainImg).trim();
  const validThumbImg = thumbImg.startsWith('https://') ? thumbImg : validMainImg;

  const gallery = Array.isArray(product.galleryImages)
    ? product.galleryImages
        .map(img => (typeof img === 'string' ? img.trim() : ''))
        .filter(img => img.startsWith('https://'))
    : [];

  return {
    title: String(product.title || ''),
    slug: String(product.slug || ''),
    summary: String(product.shortSummary || ''),
    shortSummary: String(product.shortSummary || ''),
    description: String(product.fullDescription || ''),
    fullDescription: String(product.fullDescription || ''),
    skillsWorked: String(product.skillsWorked || ''),
    category: String(product.category || 'Geral'),
    ageRange: String(product.targetAge || '2 a 6 anos'),
    targetAge: String(product.targetAge || '2 a 6 anos'),
    pdfCount: Number(product.pdfCount) || 10,
    pageSize: String(product.pageSize || 'A4'),
    imageUrl: validMainImg,
    mainImage: validMainImg,
    thumbnailUrl: validThumbImg,
    galleryImages: gallery,
    youtubeUrl: String(product.youtubeUrl || ''),
    price: Number(product.price) || 19.90,
    hotmartUrl: String(product.hotmartLink || ''),
    hotmartLink: String(product.hotmartLink || ''),
    status: product.status || 'published',
    featured: Boolean(product.featured),
    socialFeatured: Boolean(product.socialFeatured),
    displayOrder: Number(product.displayOrder) || 1,
    createdAt: String(product.createdAt || new Date().toISOString()),
    updatedAt: new Date().toISOString()
  };
}

// 1. Fetch all products strictly from Firestore collection 'products'
export async function fetchProductsAsync(): Promise<Product[]> {
  if (!isFirebaseConfigured || !db) {
    return [];
  }

  try {
    let snapshot;
    try {
      const q = query(collection(db, COLLECTION_NAME));
      snapshot = await getDocs(q);
    } catch (permissionErr) {
      try {
        const qPub = query(collection(db, COLLECTION_NAME), where('status', '==', 'published'));
        snapshot = await getDocs(qPub);
      } catch (innerErr) {
        return [];
      }
    }

    const products: Product[] = [];
    snapshot.forEach(docSnap => {
      products.push(docToProduct(docSnap.id, docSnap.data()));
    });

    return products.sort((a, b) => (a.displayOrder || 999) - (b.displayOrder || 999) || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (err) {
    return [];
  }
}

// 2. Fetch published products strictly from Firestore collection 'products'
export async function fetchPublishedProductsAsync(): Promise<Product[]> {
  if (!isFirebaseConfigured || !db) {
    return [];
  }

  try {
    const qPub = query(collection(db, COLLECTION_NAME), where('status', '==', 'published'));
    const snapshot = await getDocs(qPub);
    const products: Product[] = [];
    snapshot.forEach(docSnap => {
      products.push(docToProduct(docSnap.id, docSnap.data()));
    });
    return products.sort((a, b) => (a.displayOrder || 999) - (b.displayOrder || 999) || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (err) {
    return [];
  }
}

// 3. Save product strictly in Firestore collection 'products'
export async function saveProductAsync(product: Partial<Product> & { id: string; title: string }): Promise<Product> {
  if (!isFirebaseConfigured || !db) {
    throw new Error('Firebase Firestore não está configurado.');
  }

  const docRef = doc(db, COLLECTION_NAME, product.id);
  const payload = productToDoc(product as Product);
  await setDoc(docRef, payload);

  const verifySnap = await getDoc(docRef);
  if (!verifySnap.exists()) {
    throw new Error('O documento não pôde ser verificado no Firestore após gravação.');
  }

  return docToProduct(verifySnap.id, verifySnap.data());
}

// 4. Delete product strictly from Firestore collection 'products'
export async function deleteProductAsync(productId: string): Promise<void> {
  if (!isFirebaseConfigured || !db) {
    throw new Error('Firebase Firestore não está configurado.');
  }

  await deleteDoc(doc(db, COLLECTION_NAME, productId));
}

// 5. Get product by slug strictly from Firestore collection 'products'
export async function getProductBySlugAsync(slug: string): Promise<Product | null> {
  if (!isFirebaseConfigured || !db || !slug) {
    return null;
  }

  try {
    const qSlug = query(collection(db, COLLECTION_NAME), where('slug', '==', slug.trim()));
    const snapshot = await getDocs(qSlug);
    if (!snapshot.empty) {
      const docSnap = snapshot.docs[0];
      return docToProduct(docSnap.id, docSnap.data());
    }
    return null;
  } catch (err) {
    return null;
  }
}

// Helper to purge all products (used strictly in technical routes)
export async function purgeAllProductsAsync(): Promise<{ beforeCount: number; deletedIds: string[]; deletedTitles: string[]; afterCount: number }> {
  if (!isFirebaseConfigured || !db) {
    return { beforeCount: 0, deletedIds: [], deletedTitles: [], afterCount: 0 };
  }

  const q = query(collection(db, COLLECTION_NAME));
  const snapshot = await getDocs(q);
  const beforeCount = snapshot.size;
  const deletedIds: string[] = [];
  const deletedTitles: string[] = [];
  const deletePromises: Promise<void>[] = [];

  snapshot.forEach(docSnap => {
    deletedIds.push(docSnap.id);
    deletedTitles.push(docSnap.data().title || 'Sem título');
    deletePromises.push(deleteDoc(doc(db, COLLECTION_NAME, docSnap.id)));
  });

  await Promise.all(deletePromises);

  const snapshotAfter = await getDocs(q);
  return {
    beforeCount,
    deletedIds,
    deletedTitles,
    afterCount: snapshotAfter.size
  };
}
