export const APP_BUILD_ID = "secure-clean-real-2026-07-31";

export interface Product {
  id: string;
  _source: 'firestore';
  _firestoreId: string;
  title: string;
  slug: string;
  shortSummary: string;
  fullDescription: string;
  skillsWorked?: string;
  imageUrl: string;
  mainImage: string;
  thumbnailUrl?: string;
  galleryImages: string[];
  youtubeUrl?: string;
  price: number;
  formattedPrice: string;
  hotmartLink: string;
  category: string;
  targetAge: string;
  pdfCount: number;
  pageSize?: string;
  featured?: boolean;
  socialFeatured?: boolean;
  status: 'published' | 'draft';
  displayOrder?: number;
  createdAt: string;
}


export interface FAQItem {
  question: string;
  answer: string;
}

