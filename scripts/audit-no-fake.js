import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const FORBIDDEN_TERMS = [
  'initialProducts',
  'productStorage',
  'mockProducts',
  'demoProducts',
  'sampleProducts',
  'fallbackProducts',
  'staticProducts',
  'defaultProducts',
  'hardcodedProducts',
  'productsBackup',
  'oldProducts',
  'cachedProducts',
  'localProducts',
  'atividades_criativas_products_v1',
  'Atividade os Dentes do Hipo',
  '5 Modelos de Bonecos',
  'Cachorrinho para Rosquear',
  'Bonecas Articuladas',
  'TESTE REAL FIRESTORE',
  'TESTE CONEXAO FIRESTORE R2'
];

function scanDirectory(dirPath, violations = []) {
  if (!fs.existsSync(dirPath)) return violations;
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      if (['node_modules', '.git', 'dist', 'build', 'coverage', '.vite'].includes(entry.name)) {
        continue;
      }
      scanDirectory(fullPath, violations);
    } else if (entry.isFile()) {
      if (fullPath === __filename || entry.name.endsWith('.png') || entry.name.endsWith('.jpg') || entry.name.endsWith('.ico') || entry.name.endsWith('.svg')) {
        continue;
      }

      const content = fs.readFileSync(fullPath, 'utf8');
      FORBIDDEN_TERMS.forEach(term => {
        if (content.includes(term)) {
          violations.push({
            file: path.relative(rootDir, fullPath),
            term
          });
        }
      });
    }
  }

  return violations;
}

console.log('🔍 Executando auditoria rigorosa de zero dados/produtos fake...');
const targetDir = path.join(rootDir, 'src');
const violations = scanDirectory(targetDir);

if (violations.length > 0) {
  console.error('❌ ERRO GRAVE DE AUDITORIA: Encontradas referências proibidas a produtos/dados fakes!');
  violations.forEach(v => {
    console.error(`  - Arquivo: ${v.file} | Termo proibido: "${v.term}"`);
  });
  process.exit(1);
} else {
  console.log('✅ AUDITORIA CONCLUÍDA COM SUCESSO: Nenhum produto fake, mock, array local ou termo restrito foi encontrado.');
  process.exit(0);
}
