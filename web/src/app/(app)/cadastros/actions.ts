'use server';

import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';

// ============ Cliente ============

export type ClientePayload = {
  id?: string | null;
  nome: string;
  tier: string; // '' | 'estrategico' | 'potencial' | 'descoberta'
  dominios: string[];
};

function normalizeDominio(s: string): string {
  const v = String(s || '').trim().toLowerCase().replace(/^@+/, '').replace(/\s+/g, '');
  if (!v || !v.includes('.')) return '';
  return v;
}

export async function saveCliente(p: ClientePayload): Promise<{ ok: boolean; error?: string }> {
  const nome = (p.nome || '').trim();
  if (!nome) return { ok: false, error: 'Nome obrigatório.' };

  // Dedupe + normalize na hora de salvar.
  const dominios = Array.from(
    new Set((p.dominios || []).map((d) => normalizeDominio(d)).filter(Boolean)),
  );
  const tier = p.tier || null;

  if (p.id) {
    await db
      .update(schema.clientes)
      .set({ nome, tier, dominios })
      .where(eq(schema.clientes.id, p.id));
  } else {
    // ehInterno é gerenciado direto no banco (bucket de gestão), nunca via UI.
    await db.insert(schema.clientes).values({ nome, tier, dominios, ehInterno: false });
  }
  revalidatePath('/cadastros');
  return { ok: true };
}

export async function arquivarCliente(id: string) {
  await db.update(schema.clientes).set({ arquivadoEm: new Date() }).where(eq(schema.clientes.id, id));
  revalidatePath('/cadastros');
}

export async function desarquivarCliente(id: string) {
  await db.update(schema.clientes).set({ arquivadoEm: null }).where(eq(schema.clientes.id, id));
  revalidatePath('/cadastros');
}

// ============ Projeto ============

export type ProjetoPayload = {
  id?: string | null;
  nome: string;
  clienteId: string;
  tipo: string; // '' | 'sustentacao' | 'projeto' | 'discovery'
  slaRespostaHoras: string; // string vazia = null
  slaEntregaDias: string;
  orcamentoHoras: string;
};

const numOrNull = (v: string): number | null =>
  v === '' || v == null ? null : Number(v);

export async function saveProjeto(p: ProjetoPayload): Promise<{ ok: boolean; error?: string }> {
  const nome = (p.nome || '').trim();
  if (!nome) return { ok: false, error: 'Nome obrigatório.' };
  if (!p.clienteId) return { ok: false, error: 'Cliente obrigatório.' };

  const values = {
    nome,
    clienteId: p.clienteId,
    tipo: p.tipo || null,
    slaRespostaHoras: numOrNull(p.slaRespostaHoras),
    slaEntregaDias: numOrNull(p.slaEntregaDias),
    orcamentoHoras:
      p.orcamentoHoras === '' || p.orcamentoHoras == null
        ? null
        : String(numOrNull(p.orcamentoHoras)), // numeric column = string in Drizzle
  };

  if (p.id) {
    await db.update(schema.projetos).set(values).where(eq(schema.projetos.id, p.id));
  } else {
    await db.insert(schema.projetos).values(values);
  }
  revalidatePath('/cadastros');
  return { ok: true };
}

export async function arquivarProjeto(id: string) {
  await db.update(schema.projetos).set({ arquivadoEm: new Date() }).where(eq(schema.projetos.id, id));
  revalidatePath('/cadastros');
}

export async function desarquivarProjeto(id: string) {
  await db.update(schema.projetos).set({ arquivadoEm: null }).where(eq(schema.projetos.id, id));
  revalidatePath('/cadastros');
}

// ============ Pessoa ============

export type PessoaPayload = {
  id?: string | null;
  nome: string;
  email: string;
  role: 'admin' | 'interno' | 'cliente';
  clienteId: string; // só pra role=cliente
  clientePrincipalId: string; // só pra role !== cliente
  clienteSecundarioId: string;
  capacidadeHorasSemana: string; // string '' = 40
  skills: string[];
  senioridade: string; // junior | pleno | senior | lead
};

export async function savePessoa(p: PessoaPayload): Promise<{ ok: boolean; error?: string }> {
  const nome = (p.nome || '').trim();
  const email = (p.email || '').trim().toLowerCase();
  if (!nome) return { ok: false, error: 'Dê um nome à pessoa.' };
  if (p.role === 'cliente' && !p.clienteId) {
    return { ok: false, error: 'Cliente externo precisa de um cliente vinculado.' };
  }

  const cap = p.capacidadeHorasSemana === '' || p.capacidadeHorasSemana == null
    ? 40
    : Number(p.capacidadeHorasSemana) || 40;

  const values = {
    nome,
    email: email || null,
    role: p.role || 'interno',
    clienteId: p.role === 'cliente' ? p.clienteId || null : null,
    clientePrincipalId: p.role !== 'cliente' ? p.clientePrincipalId || null : null,
    clienteSecundarioId: p.role !== 'cliente' ? p.clienteSecundarioId || null : null,
    capacidadeHorasSemana: p.role !== 'cliente' ? String(cap) : '40',
    skills: p.role !== 'cliente' ? p.skills : [],
    senioridade: p.role !== 'cliente' ? p.senioridade || null : null,
  };

  if (p.id) {
    await db.update(schema.pessoas).set(values).where(eq(schema.pessoas.id, p.id));
  } else {
    await db.insert(schema.pessoas).values(values);
  }
  revalidatePath('/cadastros');
  return { ok: true };
}
