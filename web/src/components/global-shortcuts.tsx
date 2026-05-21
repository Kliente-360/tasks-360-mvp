'use client';

/**
 * Atalhos globais — Onda 0 · 4.H
 *
 *  ⌘K / Ctrl+K   — Command Palette
 *  n             — Nova tarefa (modal completo)
 *  /             — Foca busca do backlog (se na aba) ou abre palette
 *  g + letra     — Navega abas:
 *                  f foco · b backlog · k kanban · c calendário ·
 *                  d dashboard · t triagem
 *
 * Quick capture é acessível pelo Command Palette → "Captura rápida"
 * (atalho ⌘⇧N foi removido — conflita com aba anônima do Chrome).
 *
 * Atalhos de uma letra são ignorados quando o foco está em INPUT/TEXTAREA/
 * SELECT/contenteditable.
 */

import { useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useCommandPalette } from '@/components/command-palette';
import { useTaskModal } from '@/components/task-modal';

const TAB_BY_LETTER: Record<string, string> = {
  f: '/foco',
  b: '/backlog',
  k: '/kanban',
  c: '/calendario',
  d: '/dashboard',
  t: '/triagem',
};

export function GlobalShortcuts() {
  const router = useRouter();
  const pathname = usePathname();
  const palette = useCommandPalette();
  const { openNew } = useTaskModal();
  const gPrefix = useRef<number>(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName ?? '';
      const isTyping =
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(tag) || target?.isContentEditable;

      // ⌘K / Ctrl+K — sempre disponível, mesmo digitando
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        if (palette.isOpen) palette.close();
        else palette.open();
        return;
      }
      // Letras simples — bloqueia se está digitando ou com modifier
      if (isTyping || e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key;
      // Sequência "g + letra" — janela de 1.5s
      if (k === 'g') {
        gPrefix.current = Date.now();
        return;
      }
      const inGSeq = gPrefix.current && Date.now() - gPrefix.current < 1500;
      if (inGSeq) {
        gPrefix.current = 0;
        const href = TAB_BY_LETTER[k];
        if (href) {
          e.preventDefault();
          router.push(href);
        }
        return;
      }
      // n → nova task
      if (k === 'n') {
        e.preventDefault();
        openNew();
        return;
      }
      // / → foca busca do backlog se na aba; senão abre palette
      if (k === '/') {
        e.preventDefault();
        if (pathname.startsWith('/backlog')) {
          const inp = document.querySelector<HTMLInputElement>(
            'input[placeholder^="Buscar"]',
          );
          inp?.focus();
        } else {
          palette.open();
        }
        return;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [router, pathname, palette, openNew]);

  return null;
}
