/**
 * db/seed/seed.ts
 * Popula o banco com dados iniciais:
 *  - 1 organization: Grupo Lauxen
 *  - 5 companies: BlueLight, Industrias Neon, Atacado Neon, Engagge Placas, RYU Biotech
 *  - Categorias padrão (receitas e despesas)
 *  - Formas de pagamento (PIX, Boleto, TED, Cartão, Dinheiro)
 *  - Contas bancárias (Sicoob, Olist Digital, Conta Simples, AppMax)
 *
 * Idempotente: usa ON CONFLICT para evitar duplicatas.
 */
import { config } from 'dotenv';
import { Client } from 'pg';

import { CATEGORIAS_SEED } from './categorias';
import { COMPANIES_SEED } from './companies';
import { CONTAS_BANCARIAS_SEED } from './contas-bancarias';
import { FORMAS_PAGAMENTO_SEED } from './formas-pagamento';

config();

const ORG_SLUG = 'grupo-lauxen';
const ORG_NAME = 'Grupo Lauxen';

async function main(): Promise<void> {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
  });
  await client.connect();
  console.log('[seed] Conectado ao banco.');

  try {
    await client.query('BEGIN');

    // ---------- Organization ----------
    const orgRes = await client.query(
      `INSERT INTO organizations (name, slug, plan, primary_color, settings)
       VALUES ($1, $2, 'business', '#2563EB', '{"timezone":"America/Sao_Paulo","locale":"pt-BR"}')
       ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
      [ORG_NAME, ORG_SLUG],
    );
    const orgId: string = orgRes.rows[0].id;
    console.log(`[seed] organization ${ORG_NAME} -> ${orgId}`);

    // Setar session var para RLS funcionar nas inserções seguintes
    await client.query(`SELECT set_config('app.current_org_id', $1, true)`, [orgId]);

    // ---------- Companies ----------
    const companyMap: Record<string, string> = {};
    for (const c of COMPANIES_SEED) {
      const r = await client.query(
        `INSERT INTO companies (org_id, name, nome_fantasia, cnpj, slug, color)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (org_id, slug) DO UPDATE SET name = EXCLUDED.name, color = EXCLUDED.color
         RETURNING id`,
        [orgId, c.name, c.nome_fantasia, c.cnpj, c.slug, c.color],
      );
      companyMap[c.slug] = r.rows[0].id;
      console.log(`[seed] company ${c.name} -> ${r.rows[0].id}`);
    }

    // ---------- Categorias (hierárquico) ----------
    const catMap: Record<string, string> = {};
    for (const cat of CATEGORIAS_SEED) {
      const parentId = cat.parent_codigo ? catMap[cat.parent_codigo] : null;
      const r = await client.query(
        `INSERT INTO categorias (org_id, parent_id, nivel, path, codigo, nome, tipo, natureza, dre_grupo, is_system)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true)
         ON CONFLICT (org_id, codigo) DO UPDATE SET nome = EXCLUDED.nome
         RETURNING id`,
        [
          orgId,
          parentId,
          cat.nivel,
          cat.path,
          cat.codigo,
          cat.nome,
          cat.tipo,
          cat.natureza ?? null,
          cat.dre_grupo ?? null,
        ],
      );
      catMap[cat.codigo] = r.rows[0].id;
    }
    console.log(`[seed] categorias: ${Object.keys(catMap).length}`);

    // ---------- Formas de pagamento ----------
    for (const fp of FORMAS_PAGAMENTO_SEED) {
      await client.query(
        `INSERT INTO formas_pagamento (org_id, nome, tipo, icone, cor, taxa_percentual,
                                       taxa_fixa, prazo_recebimento_dias, is_system)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)
         ON CONFLICT (org_id, nome) DO UPDATE SET tipo = EXCLUDED.tipo`,
        [
          orgId,
          fp.nome,
          fp.tipo,
          fp.icone,
          fp.cor,
          fp.taxa_percentual,
          fp.taxa_fixa,
          fp.prazo_recebimento_dias,
        ],
      );
    }
    console.log(`[seed] formas de pagamento: ${FORMAS_PAGAMENTO_SEED.length}`);

    // ---------- Marcadores padrão ----------
    const marcadoresDefault = [
      { descricao: 'CLAUDE', cor: '#E91E63' },
      { descricao: 'REVISAR', cor: '#F59E0B' },
      { descricao: 'INTERCOMPANY', cor: '#8B5CF6' },
      { descricao: 'URGENTE', cor: '#EF4444' },
    ];
    for (const m of marcadoresDefault) {
      await client.query(
        `INSERT INTO marcadores (org_id, descricao, cor, is_system)
         VALUES ($1, $2, $3, true)
         ON CONFLICT (org_id, descricao) DO UPDATE SET cor = EXCLUDED.cor`,
        [orgId, m.descricao, m.cor],
      );
    }
    console.log(`[seed] marcadores: ${marcadoresDefault.length}`);

    // ---------- Contas bancárias ----------
    for (const cb of CONTAS_BANCARIAS_SEED) {
      const companyId = companyMap[cb.company_slug];
      if (!companyId) {
        console.warn(`[seed] conta bancária ignorada: company ${cb.company_slug} não encontrada`);
        continue;
      }
      await client.query(
        `INSERT INTO contas_bancarias (org_id, company_id, banco_codigo, banco_nome, agencia,
           conta_numero, tipo, nome, tiny_conta_origem, source_type, gateway_provider, cor)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         ON CONFLICT DO NOTHING`,
        [
          orgId,
          companyId,
          cb.banco_codigo,
          cb.banco_nome,
          cb.agencia,
          cb.conta_numero,
          cb.tipo,
          cb.nome,
          cb.tiny_conta_origem,
          cb.source_type,
          cb.gateway_provider ?? null,
          cb.cor,
        ],
      );
    }
    console.log(`[seed] contas bancárias: ${CONTAS_BANCARIAS_SEED.length}`);

    await client.query('COMMIT');
    console.log('[seed] OK — dados iniciais populados.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[seed] FALHOU:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
