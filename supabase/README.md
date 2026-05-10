# `supabase/` — banco e edge functions

```
supabase/
├── README.md                  ← este arquivo
├── schema.sql                 baseline original (rodar UMA vez ao criar projeto)
├── seed.sql                   dados de exemplo opcionais
├── realtime.sql               configuração de Realtime (pré-requisito)
├── functions/                 Edge Functions ativas
│   ├── ingest-task/
│   ├── ingest-comment/
│   └── delete-task/
├── migrations/
│   ├── README.md              regras de migration
│   ├── applied/               patches já rodados em produção (histórico)
│   └── pending/               novas migrations aguardando execução
└── seeds/                     scripts de import de dados pontuais
    └── import_2026-05-09.sql  carga inicial via CSV
```

## Setup do zero (projeto novo)

Ordem de execução no SQL Editor:
1. `schema.sql` — cria tabelas-núcleo
2. `realtime.sql` — habilita Realtime nas tabelas
3. `migrations/applied/*` — todos em ordem cronológica
4. `seed.sql` ou `seeds/import_*.sql` — dados (opcional)
5. Deploy das edge functions em `functions/`

## Manutenção contínua

- Mudanças no schema → criar arquivo em `migrations/pending/<data>_<nome>.sql`
- Rodar no SQL Editor
- Mover pra `migrations/applied/` ao confirmar que rodou OK
- Commit
