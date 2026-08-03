import React, { useEffect } from 'react';

export interface SEOProps {
  title?: string;
  description?: string;
  keywords?: string;
  canonicalUrl?: string;
  ogImage?: string;
  ogType?: 'website' | 'product' | 'article';
  schemaData?: object;
  googleSiteVerification?: string;
}

const DEFAULT_TITLE = 'Materiais Criativos | Atividades Pedagógicas em PDF para Imprimir';
const DEFAULT_DESCRIPTION = 'Encontre atividades pedagógicas em PDF para imprimir e aplicar com crianças. Materiais criativos para educação infantil, coordenação motora, alfabetização, números, cores, formas e atividades lúdicas.';
const DEFAULT_KEYWORDS = 'atividades pedagógicas, atividades para imprimir, atividades educação infantil, atividades em PDF, materiais pedagógicos, atividades lúdicas, coordenação motora, alfabetização infantil, atividades com tampinhas, atividades de matemática infantil, atividades de cores, formas geométricas, números educação infantil, atividades para professores, atividades para sala de aula, materiais para imprimir, PDF pedagógico';
const DEFAULT_URL = 'https://www.materiaiscriativos.com.br';
const DEFAULT_IMAGE = 'https://www.materiaiscriativos.com.br/og-image.png';

export const SEO: React.FC<SEOProps> = ({
  title,
  description,
  keywords,
  canonicalUrl,
  ogImage,
  ogType = 'website',
  schemaData,
  googleSiteVerification,
}) => {
  useEffect(() => {
    const pageTitle = title ? title : DEFAULT_TITLE;
    const pageDesc = description ? description : DEFAULT_DESCRIPTION;
    const pageKeywords = keywords ? keywords : DEFAULT_KEYWORDS;
    const pageUrl = canonicalUrl ? canonicalUrl : DEFAULT_URL;
    const pageImage = ogImage ? ogImage : DEFAULT_IMAGE;

    // 1. Title
    document.title = pageTitle;

    // Helper function for meta tags
    const setMetaTag = (attribute: 'name' | 'property', key: string, content: string) => {
      let element = document.querySelector(`meta[${attribute}="${key}"]`);
      if (!element) {
        element = document.createElement('meta');
        element.setAttribute(attribute, key);
        document.head.appendChild(element);
      }
      element.setAttribute('content', content);
    };

    // Helper function for link tags
    const setCanonicalTag = (url: string) => {
      let link = document.querySelector('link[rel="canonical"]');
      if (!link) {
        link = document.createElement('link');
        link.setAttribute('rel', 'canonical');
        document.head.appendChild(link);
      }
      link.setAttribute('href', url);
    };

    // 2. Primary Meta Tags
    setMetaTag('name', 'description', pageDesc);
    setMetaTag('name', 'keywords', pageKeywords);

    if (googleSiteVerification) {
      setMetaTag('name', 'google-site-verification', googleSiteVerification);
    }

    // 3. Open Graph
    setMetaTag('property', 'og:title', pageTitle);
    setMetaTag('property', 'og:description', pageDesc);
    setMetaTag('property', 'og:image', pageImage);
    setMetaTag('property', 'og:url', pageUrl);
    setMetaTag('property', 'og:type', ogType);
    setMetaTag('property', 'og:site_name', 'Materiais Criativos');

    // 4. Twitter Card
    setMetaTag('name', 'twitter:card', 'summary_large_image');
    setMetaTag('name', 'twitter:title', pageTitle);
    setMetaTag('name', 'twitter:description', pageDesc);
    setMetaTag('name', 'twitter:image', pageImage);

    // 5. Canonical Link
    setCanonicalTag(pageUrl);

    // 6. Schema.org JSON-LD Script
    let scriptElement = document.querySelector('#schema-jsonld') as HTMLScriptElement;
    if (schemaData) {
      if (!scriptElement) {
        scriptElement = document.createElement('script');
        scriptElement.id = 'schema-jsonld';
        scriptElement.type = 'application/ld+json';
        document.head.appendChild(scriptElement);
      }
      scriptElement.textContent = JSON.stringify(schemaData);
    } else if (scriptElement) {
      scriptElement.remove();
    }
  }, [title, description, keywords, canonicalUrl, ogImage, ogType, schemaData, googleSiteVerification]);

  return null;
};
