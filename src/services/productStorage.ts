import { Product } from '../types';

export function getProducts(): Product[] {
  return [];
}

export function saveProducts(products: Product[]): void {
  // Disabled in production
}

export function getProductBySlug(slug: string): Product | undefined {
  return undefined;
}

export function addOrUpdateProduct(product: Partial<Product> & { title: string }): Product {
  throw new Error('Use saveProductAsync de productFirestore.ts');
}

export function deleteProduct(id: string): void {
  // Disabled
}

export function resetToDefaults(): void {
  // Disabled
}

