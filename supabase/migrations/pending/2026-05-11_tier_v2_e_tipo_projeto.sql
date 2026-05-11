-- Renomeia vocabulários:
--   cliente.tier:  recorrente → potencial,  spot → descoberta
--   projeto.tipo:  implantacao removido (migra pra 'projeto')
--
-- Novos conjuntos:
--   cliente.tier: estrategico | potencial | descoberta
--   projeto.tipo: sustentacao | projeto | discovery
--
-- Idempotente.

-- ============ CLIENTE.TIER ============
update clientes set tier = 'potencial'  where tier = 'recorrente';
update clientes set tier = 'descoberta' where tier = 'spot';

alter table clientes drop constraint if exists clientes_tier_check;
alter table clientes add constraint clientes_tier_check
  check (tier is null or tier in ('estrategico','potencial','descoberta'));

-- ============ PROJETO.TIPO ============
-- implantação vira "projeto" (escopo fechado, similar conceitualmente).
update projetos set tipo = 'projeto' where tipo = 'implantacao';

alter table projetos drop constraint if exists projetos_tipo_check;
alter table projetos add constraint projetos_tipo_check
  check (tipo is null or tipo in ('sustentacao','projeto','discovery'));
