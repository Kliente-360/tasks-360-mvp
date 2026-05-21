'use server';

import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';

export async function arquivarCliente(id: string) {
  await db.update(schema.clientes).set({ arquivadoEm: new Date() }).where(eq(schema.clientes.id, id));
  revalidatePath('/cadastros');
}
export async function desarquivarCliente(id: string) {
  await db.update(schema.clientes).set({ arquivadoEm: null }).where(eq(schema.clientes.id, id));
  revalidatePath('/cadastros');
}
export async function arquivarProjeto(id: string) {
  await db.update(schema.projetos).set({ arquivadoEm: new Date() }).where(eq(schema.projetos.id, id));
  revalidatePath('/cadastros');
}
export async function desarquivarProjeto(id: string) {
  await db.update(schema.projetos).set({ arquivadoEm: null }).where(eq(schema.projetos.id, id));
  revalidatePath('/cadastros');
}
