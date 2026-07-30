import { Product } from '../types';

export const initialProducts: Product[] = [
  {
    id: 'prod-dentes-hipo',
    title: 'Atividade os Dentes do Hipo',
    slug: 'atividade-os-dentes-do-hipo',
    shortSummary: 'Saúde bucal infantil em uma proposta lúdica e interativa para aprender brincando.',
    fullDescription: `A atividade "Os Dentes do Hipo" é um recurso pedagógico lúdico desenvolvido para trabalhar hábitos saudáveis e higiene bucal de forma divertida com crianças na educação infantil.

Através de ilustrações coloridas e um hipopótamo interativo para "escovar os dentes", a criança desenvolve a coordenação motora fina, aprende a importância da escovação correta e constrói hábitos saudáveis desde cedo.

O arquivo em PDF pronto para imprimir acompanha moldes, fichas interativas e guia de montagem passo a passo. Ideal para uso em sala de aula, consultórios odontopediátricos ou atividades em família.`,
    skillsWorked: 'Higiene e saúde bucal, coordenação motora fina, percepção visual, hábitos de autocuidado e ludicidade.',
    mainImage: 'https://images.unsplash.com/photo-1588072432836-e10032774350?auto=format&fit=crop&q=80&w=800',
    galleryImages: [
      'https://images.unsplash.com/photo-1588072432836-e10032774350?auto=format&fit=crop&q=80&w=800',
      'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&q=80&w=800',
      'https://images.unsplash.com/photo-1516627145497-ae6968895b74?auto=format&fit=crop&q=80&w=800'
    ],
    youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    price: 19.90,
    formattedPrice: 'R$ 19,90',
    hotmartLink: 'https://pay.hotmart.com/atividade-dentes-hipo',
    category: 'Saúde & Autocuidado',
    targetAge: '2 a 6 anos',
    pdfCount: 8,
    pageSize: 'A4',
    featured: true,
    createdAt: '2026-01-15T10:00:00Z'
  },
  {
    id: 'prod-raspadinha-fazendinha',
    title: 'Raspadinha da Fazendinha',
    slug: 'raspadinha-da-fazendinha',
    shortSummary: 'Atividade sensorial surpreendente para explorar os animais da fazenda e vocabulário.',
    fullDescription: `A "Raspadinha da Fazendinha" proporciona uma experiência mágica e tátil para as crianças! Ao raspar o guache mágico ou a película, novos animais da fazenda aparecem, estimulando a curiosidade e o foco.

O kit em PDF traz ilustrações exclusivas dos animais (vaquinha, porquinho, galinha, ovelha, cavalo e pintinho), receitas simples de tintas raspáveis caseiras e sugestões de dinâmicas pedagógicas.

Um material enriquecedor para momentos de concentração, exploração tátil e desenvolvimento da linguagem em casa ou na escola.`,
    skillsWorked: 'Exploração sensorial, pareamento visual, nomeação de animais, coordenação motora fina e paciência.',
    mainImage: 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&q=80&w=800',
    galleryImages: [
      'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&q=80&w=800',
      'https://images.unsplash.com/photo-1516627145497-ae6968895b74?auto=format&fit=crop&q=80&w=800'
    ],
    price: 17.90,
    formattedPrice: 'R$ 17,90',
    hotmartLink: 'https://pay.hotmart.com/raspadinha-fazendinha',
    category: 'Sensorial & Lúdico',
    targetAge: '3 a 7 anos',
    pdfCount: 12,
    pageSize: 'A4',
    featured: true,
    createdAt: '2026-02-01T10:00:00Z'
  },
  {
    id: 'prod-molde-boneco-greg',
    title: 'Molde Boneco Greg',
    slug: 'molde-boneco-greg',
    shortSummary: 'Recurso pedagógico estruturado para trabalhar expressões faciais, emoções e esquema corporal.',
    fullDescription: `O "Molde Boneco Greg" é uma ferramenta pedagógica visual para ajudar crianças a identificar e expressar sentimentos, emoções e partes do corpo.

O arquivo digital em PDF inclui o molde completo do boneco articulável, fichas de expressões trocáveis (alegria, tristeza, raiva, susto, calma) e elementos de vestuário pedagógico.

Muito utilizado por educadores infantis, psicopedagogos e pais para facilitar conversas sobre inteligência emocional de forma leve e acolhedora.`,
    skillsWorked: 'Socioemocional, identificação de sentimentos, esquema corporal, fala e linguagem, empatia.',
    mainImage: 'https://images.unsplash.com/photo-1516627145497-ae6968895b74?auto=format&fit=crop&q=80&w=800',
    galleryImages: [
      'https://images.unsplash.com/photo-1516627145497-ae6968895b74?auto=format&fit=crop&q=80&w=800',
      'https://images.unsplash.com/photo-1588072432836-e10032774350?auto=format&fit=crop&q=80&w=800'
    ],
    price: 22.90,
    formattedPrice: 'R$ 22,90',
    hotmartLink: 'https://pay.hotmart.com/molde-boneco-greg',
    category: 'Socioemocional & Linguagem',
    targetAge: '2 a 8 anos',
    pdfCount: 15,
    pageSize: 'A4',
    featured: true,
    createdAt: '2026-02-10T10:00:00Z'
  },
  {
    id: 'prod-coordenacao-motora',
    title: 'Caderno de Coordenação Motora e Traçados',
    slug: 'caderno-de-coordenacao-motora',
    shortSummary: 'Atividades gradativas de pontilhado e grafomotricidade para preparação da escrita.',
    fullDescription: `Caderno pedagógico completo com exercícios lúdicos de grafomotricidade para crianças em fase de pré-alfabetização.

O material avança progressivamente de linhas retas e curvas simples para traçados complexos, labirintos e formas geométricas.

Ideal para plastificar ou colocar em pastas com plástico reutilizável para treino contínuo com canetinha apagável.`,
    skillsWorked: 'Preensão correta do lápis, firmeza no traço, coordenação visomotora, orientação espacial e foco.',
    mainImage: 'https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&q=80&w=800',
    galleryImages: [
      'https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&q=80&w=800'
    ],
    price: 24.90,
    formattedPrice: 'R$ 24,90',
    hotmartLink: 'https://pay.hotmart.com/caderno-coordenacao-motora',
    category: 'Pré-Alfabetização',
    targetAge: '3 a 6 anos',
    pdfCount: 30,
    pageSize: 'A4',
    featured: false,
    createdAt: '2026-02-15T10:00:00Z'
  },
  {
    id: 'prod-formas-cores',
    title: 'Jogo das Formas e Cores Lúdico',
    slug: 'jogo-das-formas-e-cores-ludico',
    shortSummary: 'Fichas de associação e pareamento lúdico de formas geométricas e paleta de cores.',
    fullDescription: `Jogo de pareamento educativo em PDF para apresentar conceitos matemáticos e visuais básicos.

Acompanha tabuleiros de classificação, fichas de associação, dados montáveis e cartões de treino para classificação por cor e forma.`,
    skillsWorked: 'Raciocínio lógico, discriminação visual, classificação, seriação e concentração.',
    mainImage: 'https://images.unsplash.com/photo-1513542789411-b6a5d4f31634?auto=format&fit=crop&q=80&w=800',
    galleryImages: [
      'https://images.unsplash.com/photo-1513542789411-b6a5d4f31634?auto=format&fit=crop&q=80&w=800'
    ],
    price: 18.90,
    formattedPrice: 'R$ 18,90',
    hotmartLink: 'https://pay.hotmart.com/jogo-formas-cores',
    category: 'Raciocínio Lógico',
    targetAge: '2 a 5 anos',
    pdfCount: 10,
    pageSize: 'A4',
    featured: false,
    createdAt: '2026-02-20T10:00:00Z'
  }
];
