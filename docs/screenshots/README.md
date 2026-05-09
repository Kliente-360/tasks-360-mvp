# Screenshots — current state

> Prints do app no estado atual, pra o agente de design ter referência visual concreta de "ANTES".
>
> Capturar com **estado realista** (não vazio): cliente Pão e Talho selecionado no Portal, alguns filtros ativos no Backlog, etc.

## Convenção de arquivos

Formato: `<aba>-<viewport>.png`

- **Desktop**: viewport 1440×900, browser Chrome no light mode
- **Mobile**: iPhone Pro (393×852) — Safari ou DevTools simular

## Lista a capturar (16 arquivos)

### Desktop (1440×900)

| Arquivo | Aba / contexto | Estado sugerido |
|---|---|---|
| `01-foco-desktop.png` | Meu foco | Pessoa "Karen" selecionada, com tasks em todas as 4 listas |
| `02-backlog-desktop.png` | Backlog | Tabela cheia (~100 linhas), sem filtro, sem agrupamento |
| `03-backlog-grouped-desktop.png` | Backlog agrupado por Cliente | Pelo menos 2 grupos expandidos, 1 colapsado |
| `04-kanban-op-desktop.png` | Kanban operacional | 11 colunas com tasks em pelo menos 5 delas |
| `05-kanban-exec-desktop.png` | Kanban executiva | 4 colunas macro |
| `06-calendar-desktop.png` | Calendário | Mês com tasks em vários dias, 1 dia selecionado mostrando cards abaixo |
| `07-dashboard-desktop.png` | Dashboard | KPIs + 4 charts renderizados |
| `08-portal-desktop.png` | Portal cliente | Pão e Talho selecionado, 4 cards com conteúdo, ideal: 1 task em "Aguardando você" |

### Mobile (iPhone Pro, 393×852)

| Arquivo | Aba | Estado sugerido |
|---|---|---|
| `09-foco-mobile.png` | Meu foco | Pessoa selecionada |
| `10-backlog-mobile.png` | Backlog | Tabela mobile, filtros expandidos |
| `11-kanban-mobile.png` | Kanban (executivo, default mobile) | Carrossel horizontal das 4 macros |
| `12-calendar-mobile.png` | Calendário | Grid com dots, 1 dia selecionado mostrando cards |
| `13-dashboard-mobile.png` | Dashboard | KPIs + charts |
| `14-portal-mobile.png` | Portal cliente | Pão e Talho |
| `15-modal-task-mobile.png` | Modal de edição de tarefa aberto | Task com comentários e histórico |
| `16-cmdk-mobile.png` | Command palette aberto (⌘K) | Input com query e resultados |

## Bonus (opcionais)

- `bonus-pdf-report.png` — print do PDF executivo gerado (página 1 ou ambas)
- `bonus-cadastros-pessoa-modal.png` — modal de editar pessoa com perfil = cliente externo
- `bonus-bulk-actions.png` — bulk bar visível com 3+ tasks selecionadas

## Como capturar

### Desktop
- Chrome em janela 1440×900 (não fullscreen)
- DevTools fechado pra não quebrar layout
- Light mode

### Mobile (DevTools)
1. F12 → toggle device toolbar (Ctrl+Shift+M)
2. Selecionar "iPhone 14 Pro" ou similar (393×852)
3. Garantir que está em "responsive" e não escala

### Mobile (real)
- iPhone com app aberto via Safari
- Usar print nativo do iOS (Power + Volume Up)
- Salvar como PNG e renomear conforme tabela

## Após capturar

```bash
# Da raiz do repo:
git add docs/screenshots/*.png
git commit -m "docs: screenshots do estado atual pra design handoff"
git push
```

O `DESIGN_HANDOFF.md` já referencia esses arquivos pelo nome — o agente vai abrir cada um automaticamente.
