import { db, isFirebaseConfigured } from './firebase';
import { collection, addDoc, getDocs, deleteDoc, doc, query, orderBy, limit } from 'firebase/firestore';

export interface AnalyticsOrigin {
  source: string;
  sourceLabel: string;
  medium: string;
  referrer: string;
  referrerDomain: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmContent: string;
  utmTerm: string;
}

export interface AnalyticsEventPayload {
  eventType: 'page_view' | 'product_view' | 'product_card_click' | 'material_card_click' | 'bio_button_click' | 'hotmart_click' | 'youtube_click';
  pagePath?: string;
  pageTitle?: string;
  productId?: string;
  productSlug?: string;
  productTitle?: string;
  buttonLabel?: string;
  hotmartUrl?: string;
}

export interface AnalyticsEventRecord extends AnalyticsOrigin {
  id?: string;
  eventType: string;
  visitorId: string;
  sessionId: string;
  pagePath: string;
  pageTitle: string;
  productId: string;
  productSlug: string;
  productTitle: string;
  buttonLabel: string;
  hotmartUrl: string;
  deviceType: string;
  browser: string;
  browserLanguage: string;
  userAgent: string;
  city?: string;
  region?: string;
  country?: string;
  countryCode?: string;
  latitude?: string;
  longitude?: string;
  postalCode?: string;
  geoStatus?: string;
  geoSource?: string;
  createdAt: string;
  dateKey: string;
  hour: number;
  isProduction?: boolean;
}

const SOURCE_LABELS: Record<string, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  whatsapp: 'WhatsApp',
  google: 'Google',
  pinterest: 'Pinterest',
  telegram: 'Telegram',
  threads: 'Threads',
  'x-twitter': 'Twitter / X',
  twitter: 'Twitter / X',
  direct: 'Direto',
  other: 'Outro site',
  unknown: 'Desconhecido',
};

export function isRealProductionDomain(): boolean {
  if (typeof window === 'undefined') return false;

  const hostname = (window.location.hostname || '').toLowerCase();
  const href = (window.location.href || '').toLowerCase();
  const hash = (window.location.hash || '').toLowerCase();
  const pathname = (window.location.pathname || '').toLowerCase();

  // 1. Block dev & preview environments
  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname.includes('ais-dev') ||
    hostname.includes('us-west1.run.app') ||
    hostname.includes('aistudio.google.com') ||
    href.includes('ais-dev') ||
    href.includes('us-west1')
  ) {
    return false;
  }

  // 2. Block admin and technical routes
  if (
    hash.startsWith('#/admin') ||
    hash.startsWith('#/prova-zero') ||
    hash.startsWith('#/prova-real') ||
    hash.startsWith('#/check-conexao') ||
    hash.startsWith('#/versao') ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/prova-zero') ||
    pathname.startsWith('/prova-real') ||
    pathname.startsWith('/check-conexao') ||
    pathname.startsWith('/versao')
  ) {
    return false;
  }

  // 3. Allowed official domains
  const ALLOWED_HOSTNAMES = [
    'www.materiaiscriativos.com.br',
    'materiaiscriativos.com.br',
    'materiais-criativos.vercel.app',
  ];

  return ALLOWED_HOSTNAMES.includes(hostname);
}

function getVisitorId(): string {
  try {
    let vid = localStorage.getItem('mc_visitor_id');
    if (!vid) {
      vid = 'v_' + Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
      localStorage.setItem('mc_visitor_id', vid);
    }
    return vid;
  } catch (e) {
    return 'v_anon_' + Date.now();
  }
}

function getSessionId(): string {
  try {
    let sid = sessionStorage.getItem('mc_session_id');
    if (!sid) {
      sid = 's_' + Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
      sessionStorage.setItem('mc_session_id', sid);
    }
    return sid;
  } catch (e) {
    return 's_anon_' + Date.now();
  }
}

function isDuplicateEvent(eventType: string, keyIdentifier: string): boolean {
  try {
    const historyRaw = sessionStorage.getItem('mc_event_history');
    const history: Record<string, number> = historyRaw ? JSON.parse(historyRaw) : {};
    const dedupeKey = `${eventType}_${keyIdentifier}`;
    const now = Date.now();
    const lastTime = history[dedupeKey] || 0;

    // 30 minutes window = 30 * 60 * 1000 = 1,800,000 ms
    if (now - lastTime < 30 * 60 * 1000) {
      return true;
    }

    history[dedupeKey] = now;
    sessionStorage.setItem('mc_event_history', JSON.stringify(history));
    return false;
  } catch (e) {
    return false;
  }
}

export function getAnalyticsOrigin(): AnalyticsOrigin {
  try {
    const cached = sessionStorage.getItem('mc_analytics_origin');
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (e) {}

  const urlParams = new URLSearchParams(window.location.search);
  const utmSource = urlParams.get('utm_source') || '';
  const utmMedium = urlParams.get('utm_medium') || '';
  const utmCampaign = urlParams.get('utm_campaign') || '';
  const utmContent = urlParams.get('utm_content') || '';
  const utmTerm = urlParams.get('utm_term') || '';

  const fbclid = urlParams.get('fbclid');
  const gclid = urlParams.get('gclid');
  const ttclid = urlParams.get('ttclid');
  const igshid = urlParams.get('igshid');
  const si = urlParams.get('si');

  const rawReferrer = document.referrer || '';
  let referrerDomain = '';
  if (rawReferrer) {
    try {
      referrerDomain = new URL(rawReferrer).hostname.toLowerCase();
    } catch (e) {
      referrerDomain = rawReferrer.toLowerCase();
    }
  }

  let source = '';
  let medium = utmMedium || '';

  // 1. UTM
  if (utmSource) {
    source = utmSource.toLowerCase().trim();
    if (!medium) medium = 'paid';
  }
  // 2. Click tracking IDs
  else if (fbclid) { source = 'facebook'; medium = 'social'; }
  else if (gclid) { source = 'google'; medium = 'search'; }
  else if (ttclid) { source = 'tiktok'; medium = 'social'; }
  else if (igshid) { source = 'instagram'; medium = 'social'; }
  else if (si) { source = 'youtube'; medium = 'social'; }
  // 3. Referrer domain mapping
  else if (referrerDomain) {
    if (referrerDomain.includes('instagram.com')) { source = 'instagram'; medium = 'social'; }
    else if (referrerDomain.includes('facebook.com') || referrerDomain.includes('fb.com')) { source = 'facebook'; medium = 'social'; }
    else if (referrerDomain.includes('tiktok.com')) { source = 'tiktok'; medium = 'social'; }
    else if (referrerDomain.includes('youtube.com') || referrerDomain.includes('youtu.be')) { source = 'youtube'; medium = 'social'; }
    else if (referrerDomain.includes('whatsapp.com') || referrerDomain.includes('wa.me')) { source = 'whatsapp'; medium = 'messaging'; }
    else if (referrerDomain.includes('google.com')) { source = 'google'; medium = 'search'; }
    else if (referrerDomain.includes('pinterest.com')) { source = 'pinterest'; medium = 'social'; }
    else if (referrerDomain.includes('telegram.org') || referrerDomain.includes('t.me')) { source = 'telegram'; medium = 'messaging'; }
    else if (referrerDomain.includes('threads.net')) { source = 'threads'; medium = 'social'; }
    else if (referrerDomain.includes('twitter.com') || referrerDomain.includes('x.com') || referrerDomain.includes('t.co')) { source = 'x-twitter'; medium = 'social'; }
    else { source = 'other'; medium = 'referral'; }
  }
  // 4. Direct
  else {
    source = 'direct';
    medium = 'direct';
  }

  const sourceLabel = SOURCE_LABELS[source] || (source ? source.charAt(0).toUpperCase() + source.slice(1) : 'Desconhecido');

  const origin: AnalyticsOrigin = {
    source,
    sourceLabel,
    medium,
    referrer: rawReferrer,
    referrerDomain,
    utmSource,
    utmMedium,
    utmCampaign,
    utmContent,
    utmTerm,
  };

  try {
    sessionStorage.setItem('mc_analytics_origin', JSON.stringify(origin));
  } catch (e) {}

  return origin;
}

function getDeviceInfo() {
  const ua = navigator.userAgent || '';
  let deviceType = 'desktop';
  if (/Mobi|Android|iPhone/i.test(ua)) {
    deviceType = 'mobile';
  } else if (/iPad|Tablet/i.test(ua)) {
    deviceType = 'tablet';
  }

  let browser = 'Other';
  if (ua.includes('Firefox')) browser = 'Firefox';
  else if (ua.includes('SamsungBrowser')) browser = 'Samsung';
  else if (ua.includes('Opera') || ua.includes('OPR')) browser = 'Opera';
  else if (ua.includes('Trident')) browser = 'IE';
  else if (ua.includes('Edge') || ua.includes('Edg')) browser = 'Edge';
  else if (ua.includes('Chrome')) browser = 'Chrome';
  else if (ua.includes('Safari')) browser = 'Safari';

  return {
    deviceType,
    browser,
    browserLanguage: navigator.language || '',
    userAgent: ua,
  };
}

export async function trackEventAsync(payload: AnalyticsEventPayload): Promise<void> {
  // STRICT RULE: Only record real production domain events
  if (!isRealProductionDomain()) {
    return;
  }

  // Deduplication check for view events (30 minutes)
  if (payload.eventType === 'page_view') {
    const key = payload.pagePath || window.location.hash || '/';
    if (isDuplicateEvent('page_view', key)) return;
  } else if (payload.eventType === 'product_view') {
    const key = payload.productSlug || payload.productId || 'prod_unknown';
    if (isDuplicateEvent('product_view', key)) return;
  }

  try {
    const origin = getAnalyticsOrigin();
    const device = getDeviceInfo();
    const now = new Date();
    const dateKey = now.toISOString().split('T')[0];

    const eventDoc = {
      eventType: payload.eventType,
      visitorId: getVisitorId(),
      sessionId: getSessionId(),
      source: origin.source,
      sourceLabel: origin.sourceLabel,
      medium: origin.medium,
      referrer: origin.referrer,
      referrerDomain: origin.referrerDomain,
      utmSource: origin.utmSource,
      utmMedium: origin.utmMedium,
      utmCampaign: origin.utmCampaign,
      utmContent: origin.utmContent,
      utmTerm: origin.utmTerm,
      pagePath: payload.pagePath || window.location.pathname,
      pageTitle: payload.pageTitle || document.title || 'Materiais Criativos',
      productId: payload.productId || '',
      productSlug: payload.productSlug || '',
      productTitle: payload.productTitle || '',
      buttonLabel: payload.buttonLabel || '',
      hotmartUrl: payload.hotmartUrl || '',
      deviceType: device.deviceType,
      browser: device.browser,
      browserLanguage: device.browserLanguage,
      userAgent: device.userAgent,
      isProduction: true,
      createdAt: now.toISOString(),
      dateKey,
      hour: now.getHours(),
    };

    let sentToApi = false;
    try {
      const response = await fetch('/api/track-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(eventDoc),
      });

      if (response.ok) {
        sentToApi = true;
      }
    } catch (apiErr) {}

    if (!sentToApi) {
      if (isFirebaseConfigured && db) {
        await addDoc(collection(db, 'analyticsEvents'), {
          ...eventDoc,
          city: 'Não identificado',
          geoStatus: 'fallback_client',
        });
      }
    }
  } catch (err) {
    console.warn('Analytics tracking error:', err);
  }
}

export function trackPageView(pagePath: string, pageTitle?: string) {
  trackEventAsync({ eventType: 'page_view', pagePath, pageTitle });
}

export function trackProductView(product: { id?: string; slug?: string; title?: string }) {
  trackEventAsync({
    eventType: 'product_view',
    productId: product.id,
    productSlug: product.slug,
    productTitle: product.title,
    pagePath: `/atividade/${product.slug}`
  });
}

export function trackMaterialCardClick(product: { id?: string; slug?: string; title?: string }) {
  trackEventAsync({
    eventType: 'product_card_click',
    productId: product.id,
    productSlug: product.slug,
    productTitle: product.title,
    pagePath: window.location.pathname
  });
}

export function trackBioButtonClick(buttonLabel: string) {
  trackEventAsync({
    eventType: 'bio_button_click',
    buttonLabel,
    pagePath: window.location.pathname
  });
}

export function trackHotmartClick(product: { id?: string; slug?: string; title?: string }, hotmartUrl: string) {
  trackEventAsync({
    eventType: 'hotmart_click',
    productId: product.id,
    productSlug: product.slug,
    productTitle: product.title,
    hotmartUrl,
    pagePath: window.location.pathname
  });
}

export function trackYoutubeClick(product?: { id?: string; slug?: string; title?: string }) {
  trackEventAsync({
    eventType: 'youtube_click',
    productId: product?.id,
    productSlug: product?.slug,
    productTitle: product?.title,
    pagePath: window.location.pathname
  });
}

export async function fetchAnalyticsEventsAsync(limitCount = 1000): Promise<AnalyticsEventRecord[]> {
  if (isFirebaseConfigured && db) {
    try {
      const q = query(
        collection(db, 'analyticsEvents'),
        orderBy('createdAt', 'desc'),
        limit(limitCount)
      );
      const snap = await getDocs(q);
      const records: AnalyticsEventRecord[] = [];
      snap.forEach(docSnap => {
        records.push({ id: docSnap.id, ...docSnap.data() } as AnalyticsEventRecord);
      });
      return records;
    } catch (err) {
      console.warn('Failed to fetch analytics from Firestore:', err);
    }
  }
  return [];
}

export async function purgeAllAnalyticsEventsAsync(): Promise<{ success: boolean; count: number }> {
  let count = 0;
  if (isFirebaseConfigured && db) {
    try {
      const snap = await getDocs(collection(db, 'analyticsEvents'));
      for (const docSnap of snap.docs) {
        await deleteDoc(doc(db, 'analyticsEvents', docSnap.id));
        count++;
      }
    } catch (err) {
      console.warn('Failed to purge Firestore analyticsEvents:', err);
    }
  }
  try {
    localStorage.removeItem('mc_local_analytics');
    sessionStorage.removeItem('mc_event_history');
  } catch (e) {}

  return { success: true, count };
}
