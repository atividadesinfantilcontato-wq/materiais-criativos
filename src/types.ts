export interface Product {
  id: string;
  title: string;
  slug: string;
  shortSummary: string;
  fullDescription: string;
  skillsWorked?: string; // "O que o material ajuda a trabalhar"
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
  pageSize?: string; // default "A4"
  featured?: boolean;
  socialFeatured?: boolean;
  status?: 'published' | 'draft';
  displayOrder?: number;
  createdAt: string;
}

export interface FAQItem {
  question: string;
  answer: string;
}
