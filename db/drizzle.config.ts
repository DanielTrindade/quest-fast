import { defineConfig } from 'drizzle-kit';

// O padrão repete `CAMINHO_DB_PADRAO` de propósito: o drizzle-kit carrega este
// arquivo sozinho, e importar o cliente traria o driver nativo junto.
export default defineConfig({
  dialect: 'sqlite',
  schema: './src/schema.ts',
  out: './migrations',
  dbCredentials: { url: process.env.DB_FILE ?? 'quest-fast.db' },
});
