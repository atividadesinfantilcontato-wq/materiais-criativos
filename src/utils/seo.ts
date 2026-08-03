import { Product } from '../types';
import { generateSlug } from './slug';

export interface ProductSchema {
  '@context': string;
  '@type': string;
  name: string;
  description: string;
  image: string[];
  url: string;
  brand: {
    '@type': string;
    name: string;
  };
  category: string;
  offers: {
    '@type': string;
    price: string;
    priceCurrency: string;
    availability: string;
    seller: {
      '@type': string;
      name: string;
    };
  };
}

export function generateProductSchema(product: Product, canonicalUrl: string): ProductSchema {
  const images = [
    product.imageUrl,
    product.mainImage,
    product.thumbnailUrl,
    ...(product.galleryImages || [])
  ].filter((url): url is string => Boolean(url && url.startsWith('https://')));

  const rawPrice = product.price ?? 19.90;
  const formattedPriceNum = typeof rawPrice === 'number' ? rawPrice.toFixed(2) : String(rawPrice).replace('R$', '').replace(',', '.').trim();

  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.title,
    description: product.shortSummary || product.fullDescription?.slice(0, 200) || `Atividade pedagógica em PDF ${product.title} para imprimir.`,
    image: images.length > 0 ? images : ['https://www.materiaiscriativos.com.br/og-image.png'],
    url: canonicalUrl,
    brand: {
      '@type': 'Brand',
      name: 'Materiais Criativos'
    },
    category: `Atividade pedagógica em PDF - ${product.category || 'Educação Infantil'}`,
    offers: {
      '@type': 'Offer',
      price: formattedPriceNum || '19.90',
      priceCurrency: 'BRL',
      availability: 'https://schema.org/InStock',
      seller: {
        '@type': 'Organization',
        name: 'Materiais Criativos'
      }
    }
  };
}

export function generateWebSiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Materiais Criativos',
    url: 'https://www.materiaiscriativos.com.br',
    description: 'Encontre atividades pedagógicas em PDF para imprimir e aplicar com crianças na educação infantil.',
    publisher: {
      '@type': 'Organization',
      name: 'Materiais Criativos',
      url: 'https://www.materiaiscriativos.com.br'
    }
  };
}

export function generateBreadcrumbSchema(items: { name: string; url: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url
    }))
  };
}
