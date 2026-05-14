/* ============ tasks 360 · view do Briefing executivo ============
 * Getters do Briefing executivo (narrativa, capacidade semanal Onda D,
 * sugestões de redistribuição). Extraído de app.js. Métodos referenciam
 * `this.*` (Alpine proxy) e globals (STATUS, taskWeekIndex, effEsforco).
 *
 * Dependências em app() (permanecem lá):
 *   - this.tasks, this.pessoas, this.projetos
 *   - this.reportClientesExec, this.reportTeamLoad (em STATS)
 *   - this._visibleTasks, this._tasksSig, this._dataRev, this._memo (MEMOIZATION)
 *   - this.nomeCliente, this.nomeProjeto, this.atrasada, this.effEsforco (HELPERS)
 *
 * Dependências em window (helpers.js):
 *   - STATUS, ROLE, taskWeekIndex, effEsforco, cargaNivelFromPctCap
 *
 * exportPDF / buildPrintCharts / destroyPrintCharts ficam em app.js
 * (side effects de DOM/print).
 * ===============================================================
 */

(function () {
  'use strict';

  function makeBriefingView() {
    return {
      // ===================== BRIEFING EXECUTIVO =====================
      get briefingDate() {
        const d = new Date();
        const dias = ['domingo','segunda','terça','quarta','quinta','sexta','sábado'];
        return dias[d.getDay()] + ', ' + String(d.getDate()).padStart(2,'0') + '/' + String(d.getMonth()+1).padStart(2,'0') + '/' + d.getFullYear();
      },
      get briefingHeadline() {
        const cRisco = this.briefingClientesRisco.length;
        const tRisco = this.briefingTimeRisco.length;
        if (cRisco === 0 && tRisco === 0) return 'Nada crítico. Operação fluindo.';
        const parts = [];
        if (cRisco) parts.push(cRisco + ' cliente' + (cRisco === 1 ? '' : 's') + ' em risco');
        if (tRisco) parts.push(tRisco + ' pessoa' + (tRisco === 1 ? '' : 's') + ' precisando de conversa');
        return parts.join(' · ');
      },
      get briefingClientesRisco() {
        // Reutiliza reportClientesExec mas amplifica motivo + ação sugerida
        return this.reportClientesExec.filter(c => c.sinal !== 'verde').map(c => {
          let motivo = c.sinalReason;
          let acao = '';
          if (c.sinal === 'vermelho' && c.atrasadas > 0) {
            motivo = c.atrasadas + ' task' + (c.atrasadas === 1 ? '' : 's') + ' atrasada' + (c.atrasadas === 1 ? '' : 's');
            acao = 'Conversar hoje sobre prazo';
          } else if (c.sinal === 'vermelho' && c.bloqAguard > 0) {
            motivo = c.bloqAguard + ' task aguardando cliente há +5 dias';
            acao = 'Cobrar resposta hoje';
          } else if (c.sinal === 'amarelo' && c.bloqAguard > 0) {
            motivo = c.bloqAguard + ' task aguardando cliente';
            acao = 'Cobrar resposta esta semana';
          } else if (c.sinal === 'amarelo' && c.atrasadas > 0) {
            motivo = c.atrasadas + ' task atrasada';
            acao = 'Alinhar prazo';
          }
          // Sobreescreve com aviso de orçamento se for grave
          if (c.pctOrc != null && c.pctOrc > 100) {
            motivo = motivo + ' · orçamento de horas estourado (' + c.pctOrc + '%)';
            acao = 'Renegociar escopo ou cobrar adicional';
          }
          return { ...c, motivo, acao };
        });
      },
      get briefingTimeRisco() {
        return this.reportTeamLoad.filter(p => p.cargaNivel === 'sobrecarga' || p.cargaNivel === 'pressao').map(p => {
          let acao = '';
          if (p.cargaNivel === 'sobrecarga' && p.atrasadas > 0) {
            acao = 'Redistribuir tasks hoje; risco de burnout';
          } else if (p.cargaNivel === 'sobrecarga') {
            acao = 'Redistribuir antes que comece a atrasar';
          } else if (p.cargaNivel === 'pressao' && p.atrasadas > 0) {
            acao = 'Aliviar carga; já está atrasando';
          } else {
            acao = 'Monitorar; não dar mais task nova';
          }
          return { ...p, acao };
        });
      },
      get briefingTendencia() {
        // 4 indicadores chave com delta vs período anterior
        const t = this.tasks;
        const now = Date.now();
        // Throughput 7d
        const c7 = t.filter(x => x.status === STATUS.CONCLUIDO && x.statusEm && (now - x.statusEm) <= 7*86400000).length;
        const c7p = t.filter(x => x.status === STATUS.CONCLUIDO && x.statusEm && (now - x.statusEm) > 7*86400000 && (now - x.statusEm) <= 14*86400000).length;
        // Lead time 14d
        const lead = (from, to) => {
          const arr = t.filter(x => x.status === STATUS.CONCLUIDO && x.statusEm && x.criadoEm && (now - x.statusEm) > from && (now - x.statusEm) <= to)
            .map(x => (x.statusEm - x.criadoEm) / 86400000).filter(d => d > 0);
          return arr.length ? arr.reduce((a,b) => a+b, 0) / arr.length : null;
        };
        const lt = lead(0, 14*86400000);
        const ltP = lead(14*86400000, 28*86400000);
        // % atrasadas das ativas
        const ativas = t.filter(x => x.status !== STATUS.CONCLUIDO);
        const pctAtr = ativas.length ? Math.round(ativas.filter(x => this.atrasada(x)).length / ativas.length * 100) : 0;
        // Capacidade média
        const team = this.reportTeamLoad.filter(p => p.pctCap != null);
        const capMed = team.length ? Math.round(team.reduce((s,p) => s + p.pctCap, 0) / team.length) : null;
  
        const dThr = c7 - c7p;
        const dLt = (lt != null && ltP != null) ? +(lt - ltP).toFixed(1) : null;
  
        return [
          {
            label: 'Throughput · 7d', value: c7,
            deltaText: dThr === 0 ? '= estável' : (dThr > 0 ? '↑ +' + dThr + ' vs sem ant' : '↓ ' + dThr + ' vs sem ant'),
            deltaGood: dThr === 0 ? null : dThr > 0,
          },
          {
            label: 'Lead time · 14d', value: lt != null ? lt.toFixed(1) + 'd' : '—',
            deltaText: dLt == null ? '—' : (dLt === 0 ? '= estável' : (dLt < 0 ? '↓ ' + Math.abs(dLt) + 'd (melhor)' : '↑ +' + dLt + 'd (pior)')),
            deltaGood: dLt == null ? null : (dLt === 0 ? null : dLt < 0),
          },
          {
            label: '% atrasadas', value: pctAtr + '%',
            danger: pctAtr > 20,
            deltaText: pctAtr > 20 ? 'crítico' : (pctAtr > 10 ? 'atenção' : 'saudável'),
            deltaGood: pctAtr <= 10,
          },
          {
            label: 'Capac. média', value: capMed != null ? capMed + '%' : '—',
            danger: capMed != null && capMed > 100,
            deltaText: capMed == null ? '—' : (capMed > 100 ? 'time sobrecarregado' : (capMed < 60 ? 'time com folga' : 'saudável')),
            deltaGood: capMed == null ? null : (capMed >= 60 && capMed <= 100),
          },
        ];
      },
      get briefingNarrativa() {
        const t = this.briefingTendencia;
        const [thr, lt, atr, cap] = t;
        const bons = t.filter(x => x.deltaGood === true).length;
        const ruins = t.filter(x => x.deltaGood === false).length;
        let tom = 'estável';
        if (bons >= 3) tom = 'melhorando';
        else if (ruins >= 3) tom = 'piorando';
        else if (ruins > bons) tom = 'preocupante';
        else if (bons > ruins) tom = 'levemente melhor';
        return 'Operação ' + tom + '. Throughput de ' + thr.value + ' tarefa(s) na última semana, lead time médio de ' + lt.value + ', ' + atr.value + ' das ativas atrasadas, time em ' + cap.value + ' de capacidade média.';
      },
      get briefingCapacidade() {
        const team = this.reportTeamLoad;
        const teamCap = team.filter(p => p.capacidade > 0);
        const alocado = team.reduce((s, p) => s + p.horas, 0);
        const capacidade = teamCap.reduce((s, p) => s + p.capacidade, 0);
        const utilizacao = capacidade > 0 ? Math.round(alocado / capacidade * 100) : 0;
        let nivel = 'ok', label = 'saudável', rec = '';
        const sobrecarga = team.filter(p => p.cargaNivel === 'sobrecarga').length;
        const folga = team.filter(p => p.cargaNivel === 'folga').length;
        if (utilizacao > 100 || sobrecarga >= 2) {
          nivel = 'alta'; label = 'time pressionado';
          rec = 'Time está sistemicamente sobrecarregado. ' +
                (sobrecarga >= 2 ? sobrecarga + ' pessoa(s) em sobrecarga crítica. ' : '') +
                'Decisão: contratar mais 1 pessoa, despriorizar projeto não-estratégico, ou cobrar prazo mais largo dos clientes.';
        } else if (utilizacao < 60 && folga >= Math.ceil(team.length * 0.4)) {
          nivel = 'baixa'; label = 'time com folga';
          rec = 'Time tem capacidade ociosa. ' + folga + ' pessoa(s) abaixo de 60% de uso. ' +
                'Decisão: puxar mais venda, antecipar entregas, ou (se persistente por 3+ semanas) avaliar headcount.';
        } else {
          nivel = 'ok'; label = 'capacidade equilibrada';
          rec = 'Capacidade do time bem dimensionada pra demanda atual. Manter rota; reavaliar se entrar projeto novo.';
        }
        return {
          alocado, capacidade, utilizacao,
          pessoasComCap: teamCap.length,
          utilizacaoNivel: nivel,
          utilizacaoLabel: label,
          recomendacao: rec,
        };
      },
      abrirFiltroCliente(cid) {
        this.tab = 'backlog';
        if (this.f) this.f.cliente = cid;
        this.$nextTick(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
      },
  
  
      get reportRisks() {
        const out = [];
        const ativas = this._visibleTasks.filter(t => t.status !== STATUS.CONCLUIDO);
        const atrasadas = ativas.filter(t => this.atrasada(t));
        if (atrasadas.length) {
          const porCli = {};
          atrasadas.forEach(t => { const n = this.nomeCliente(t.clienteId); porCli[n] = (porCli[n]||0)+1; });
          const top = Object.entries(porCli).sort((a,b) => b[1]-a[1])[0];
          out.push(atrasadas.length + ' tarefa(s) atrasada(s) — concentração em ' + top[0] + ' (' + top[1] + ').');
        }
        const blqStale = ativas.filter(t => t.status === 'bloqueado' && this.agingDays(t) >= 5);
        if (blqStale.length) {
          out.push(blqStale.length + ' tarefa(s) bloqueada(s) há +5 dias — desbloqueio prioritário.');
        }
        const stale = ativas.filter(t => this.agingLevel(t) === 'stale' && t.status !== 'bloqueado');
        if (stale.length) {
          out.push(stale.length + ' tarefa(s) paradas além do limite saudável (aging crítico).');
        }
        const semResp = ativas.filter(t => !t.pessoaId).length;
        if (semResp) out.push(semResp + ' tarefa(s) sem responsável definido.');
        const semPrazo = ativas.filter(t => !t.prazo).length;
        if (semPrazo >= 5) out.push(semPrazo + ' tarefa(s) ativas sem prazo — risco de fila invisível.');
        return out;
      },
      // Saúde por cliente (página 3 do report).
      get reportClientHealth() {
        return this._memo('reportClientHealth', this._tasksSig + ':' + this.clientes.length + ':' + this._dataRev, () => this._computeReportClientHealth());
      },
      _computeReportClientHealth() {
        const now = Date.now();
        const cutoff14 = now - 14 * 86400000;
        const cutoff28 = now - 28 * 86400000;
        const out = [];
        const tasksByCli = this.tasksByCliente; // bucket O(1)
        for (const c of this.clientes) {
          if (c.ehInterno) continue; // cliente interno (bucket de gestão) fora do briefing executivo
          const allTasks = tasksByCli.get(c.id) || [];
          if (allTasks.length === 0) continue;
          const ativas = allTasks.filter(t => t.status !== STATUS.CONCLUIDO);
          const atrasadas = ativas.filter(t => this.atrasada(t));
          const bloqAguard = ativas.filter(t => t.subetapa === 'bloqueado' && t.bloqueadoPor === 'cliente');
          const bloqAguardStale = bloqAguard.filter(t => this.agingDays(t) >= 5).length;
          const entregues14d     = allTasks.filter(t => t.status === STATUS.CONCLUIDO && t.statusEm && t.statusEm >= cutoff14).length;
          const entregues14dPrev = allTasks.filter(t => t.status === STATUS.CONCLUIDO && t.statusEm && t.statusEm >= cutoff28 && t.statusEm < cutoff14).length;
          const delta = entregues14d - entregues14dPrev;
          // SLA médio: criação → conclusão das entregues nos últimos 14d
          const leads = allTasks
            .filter(t => t.status === STATUS.CONCLUIDO && t.statusEm && t.statusEm >= cutoff14 && t.criadoEm)
            .map(t => (t.statusEm - t.criadoEm) / 86400000)
            .filter(d => d > 0);
          const slaMedio = leads.length ? leads.reduce((a,b) => a+b, 0) / leads.length : null;
          // Sinal semafórico
          let sinal = 'verde', sinalReason = 'tudo no prazo';
          const pctAtrasadas = ativas.length ? atrasadas.length / ativas.length : 0;
          if (pctAtrasadas > 0.30 || bloqAguardStale > 0) {
            sinal = 'vermelho';
            sinalReason = pctAtrasadas > 0.30 ? `${Math.round(pctAtrasadas*100)}% das ativas atrasadas` : 'bloqueio com cliente há +5d';
          } else if (atrasadas.length > 0 || bloqAguard.length > 0) {
            sinal = 'amarelo';
            sinalReason = atrasadas.length > 0 ? `${atrasadas.length} atrasada(s)` : 'aguardando cliente';
          }
          out.push({
            id: c.id, nome: c.nome,
            ativas: ativas.length,
            atrasadas: atrasadas.length,
            bloqAguard: bloqAguard.length,
            entregues14d, delta,
            slaMedio,
            sinal, sinalReason,
          });
        }
        const sinalRank = { vermelho: 0, amarelo: 1, verde: 2 };
        out.sort((a,b) => (sinalRank[a.sinal] - sinalRank[b.sinal]) || (b.ativas - a.ativas));
        return out;
      },
      // Top pendentes críticos (página 3).
      get reportTopPendentes() {
        const ativas = this._visibleTasks.filter(t => t.status !== STATUS.CONCLUIDO);
        const score = (t) => {
          // Score maior = mais crítico
          let s = 0;
          if (this.atrasada(t)) s += 1000 + this.diasAtraso(t) * 5;
          if (t.subetapa === 'bloqueado' && t.bloqueadoPor === 'cliente') s += 500 + this.agingDays(t) * 3;
          if (t.subetapa === 'bloqueado' && t.bloqueadoPor !== 'cliente') s += 300 + this.agingDays(t) * 2;
          if (this.agingLevel(t) === 'stale') s += 200;
          // Boost por prioridade
          if (t.prioridade === 'P0') s += 200;
          else if (t.prioridade === 'P1') s += 100;
          return s;
        };
        const candidatos = ativas
          .map(t => ({ t, s: score(t) }))
          .filter(x => x.s > 0)
          .sort((a,b) => b.s - a.s)
          .slice(0, 10)
          .map(x => x.t);
        return candidatos;
      },
      // Carga por pessoa (página 3).
      get reportTeamLoad() {
        return this._memo('reportTeamLoad', this._tasksSig + ':' + this.pessoas.length + ':' + this._dataRev, () => this._computeReportTeamLoad());
      },
      _computeReportTeamLoad() {
        const map = new Map();
        for (const p of this.pessoas) {
          if (p.role === ROLE.CLIENTE) continue; // não inclui clientes externos
          map.set(p.id, {
            id: p.id, nome: p.nome,
            senioridade: p.senioridade || '',
            capacidade: Number(p.capacidade_horas_semana) || 0,
            tasks: 0, horas: 0, atrasadas: 0, horasAtrasadas: 0
          });
        }
        const ativas = this._visibleTasksExternas.filter(t => t.status !== STATUS.CONCLUIDO);
        for (const t of ativas) {
          if (!t.pessoaId) continue;
          const e = map.get(t.pessoaId);
          if (!e) continue;
          e.tasks++;
          const h = this.effEsforco(t);
          e.horas += h;
          if (this.atrasada(t)) {
            e.atrasadas++;
            e.horasAtrasadas += h;
          }
        }
        const arr = Array.from(map.values()).filter(x => x.tasks > 0);
        const maxHoras = Math.max(1, ...arr.map(x => x.horas));
        arr.forEach(x => {
          x.barLate = Math.round((x.horasAtrasadas / maxHoras) * 100);
          x.barOk   = Math.round(((x.horas - x.horasAtrasadas) / maxHoras) * 100);
          x.pctCap  = x.capacidade > 0 ? Math.round((x.horas / x.capacidade) * 100) : null;
          // Faixas: <60% folga, 60-100% saudável, 100-130% pressão, >130% sobrecarga
          x.cargaNivel = x.pctCap == null ? 'sem-cap'
                       : x.pctCap > 130 ? 'sobrecarga'
                       : x.pctCap > 100 ? 'pressao'
                       : x.pctCap < 60  ? 'folga'
                       : 'ok';
          // Fallback antigo (sem capacidade declarada)
          x.sobrecarga = x.pctCap != null ? x.pctCap > 130 : x.horas > 50;
          x.subutilizada = x.pctCap != null ? x.pctCap < 60 : x.horas < 20;
        });
        arr.sort((a,b) => b.horas - a.horas);
        return arr;
      },
      // ============ ANÁLISE SEMANAL DE CAPACIDADE (4 semanas) ============
      // Agrega tasks abertas em 4 buckets (semana atual + 3 próximas) por pessoa
      // e por projeto (sustentação e fechado). Tasks atrasadas puxam pra W0.
      // Defaults pra análise: prazo vazio → semana atual; esforço 0 → 4h.
      // Não escreve nada no banco — só agrega pra heurística e Briefing.
      get weeklyCapacityAnalysis() {
        const sig = this._tasksSig + ':' + this.pessoas.length + ':' + this.projetos.length + ':' + this._dataRev;
        return this._memo('weeklyCapacityAnalysis', sig, () => this._computeWeeklyCapacityAnalysis());
      },
      _computeWeeklyCapacityAnalysis() {
        const today = new Date().toISOString().slice(0, 10);
        const ativas = this._visibleTasksExternas.filter(t => t.status !== STATUS.CONCLUIDO && !t.arquivadoEm);
  
        // ---- Pessoa × semana ----
        const pessoaWeekly = new Map();   // pessoaId → [w0, w1, w2, w3]
        for (const p of this.pessoas) {
          if (p.role === ROLE.CLIENTE) continue;
          pessoaWeekly.set(p.id, [0, 0, 0, 0]);
        }
        for (const t of ativas) {
          if (!t.pessoaId) continue;
          const arr = pessoaWeekly.get(t.pessoaId);
          if (!arr) continue;
          const idx = taskWeekIndex(t, today);
          if (idx === -1) arr[0] += effEsforco(t);                  // atrasada puxa pra W0
          else if (idx !== null) arr[idx] += effEsforco(t);
        }
        const pessoasResult = [];
        for (const p of this.pessoas) {
          if (p.role === ROLE.CLIENTE) continue;
          const hours = pessoaWeekly.get(p.id) || [0,0,0,0];
          const cap = +p.capacidade_horas_semana || 0;
          const weeks = hours.map(h => {
            const pctCap = cap > 0 ? Math.round((h / cap) * 100) : null;
            return { hours: h, pctCap, nivel: cargaNivelFromPctCap(pctCap) };
          });
          const anyOverload = weeks.some(w => w.nivel === 'sobrecarga' || w.nivel === 'pressao');
          pessoasResult.push({ pessoaId: p.id, nome: p.nome, capacidade: cap, weeks, anyOverload });
        }
        pessoasResult.sort((a,b) => {
          // sobrecarga primeiro, depois maior pico de pctCap
          const peakA = Math.max(...a.weeks.map(w => w.pctCap ?? -1));
          const peakB = Math.max(...b.weeks.map(w => w.pctCap ?? -1));
          return peakB - peakA;
        });
  
        // ---- Projeto sustentação × semana ----
        const sustWeekly = new Map();
        for (const proj of this.projetos) {
          if (proj.arquivadoEm) continue;
          if (proj.tipo !== 'sustentacao') continue;
          if (!(+proj.orcamentoHoras > 0)) continue;
          sustWeekly.set(proj.id, [0,0,0,0]);
        }
        for (const t of ativas) {
          if (!t.projetoId) continue;
          const arr = sustWeekly.get(t.projetoId);
          if (!arr) continue;
          const idx = taskWeekIndex(t, today);
          if (idx === -1) arr[0] += effEsforco(t);
          else if (idx !== null) arr[idx] += effEsforco(t);
        }
        const sustentacoesResult = [];
        for (const proj of this.projetos) {
          if (proj.arquivadoEm) continue;
          if (proj.tipo !== 'sustentacao') continue;
          const orcMensal = +proj.orcamentoHoras || 0;
          if (!(orcMensal > 0)) continue;
          const capSem = orcMensal / 4;
          const hours = sustWeekly.get(proj.id) || [0,0,0,0];
          const weeks = hours.map(h => {
            const pctCap = Math.round((h / capSem) * 100);
            return { hours: h, pctCap, nivel: cargaNivelFromPctCap(pctCap) };
          });
          // Ociosa: 2+ semanas consecutivas <50% utilização
          let ociosaStreak = 0, ociosaFlag = false;
          for (const w of weeks) {
            if (w.pctCap < 50) { ociosaStreak++; if (ociosaStreak >= 2) ociosaFlag = true; }
            else ociosaStreak = 0;
          }
          const estourando = weeks.some(w => w.pctCap > 100);
          sustentacoesResult.push({
            projetoId: proj.id, nome: proj.nome, clienteId: proj.clienteId,
            capSemanal: capSem, orcMensal, weeks, estourando, ociosaFlag,
          });
        }
        sustentacoesResult.sort((a,b) => {
          const sevA = a.estourando ? 2 : (a.ociosaFlag ? 1 : 0);
          const sevB = b.estourando ? 2 : (b.ociosaFlag ? 1 : 0);
          return sevB - sevA;
        });
  
        // ---- Projeto fechado × escopo total ----
        const projetosFechadosResult = [];
        for (const proj of this.projetos) {
          if (proj.arquivadoEm) continue;
          if (proj.tipo !== 'projeto') continue;
          if (this.clientesById.get(proj.clienteId)?.ehInterno) continue; // bucket interno fora
          const orcTotal = +proj.orcamentoHoras || 0;
          if (!(orcTotal > 0)) continue;
          let usado = 0, comprometido = 0, countTasks = 0;
          for (const t of this.tasks) {
            if (t.projetoId !== proj.id) continue;
            if (t.arquivadoEm) continue;
            countTasks++;
            if (t.status === STATUS.CONCLUIDO) {
              usado += +t.tempoRealHoras || effEsforco(t);
            } else {
              comprometido += effEsforco(t);
            }
          }
          const total = usado + comprometido;
          const pctEsgotamento = Math.round((total / orcTotal) * 100);
          projetosFechadosResult.push({
            projetoId: proj.id, nome: proj.nome, clienteId: proj.clienteId,
            orcTotal, usado, comprometido, total, pctEsgotamento, countTasks,
            estourado: pctEsgotamento > 110,
            risco: pctEsgotamento >= 90 && pctEsgotamento <= 110,
          });
        }
        projetosFechadosResult.sort((a,b) => b.pctEsgotamento - a.pctEsgotamento);
  
        return { pessoas: pessoasResult, sustentacoes: sustentacoesResult, projetosFechados: projetosFechadosResult };
      },
  
      // Sugestões de redistribuição baseadas em capacidade semanal (Onda D+).
      // Detecção ESTRITA: emite hit somente quando, numa semana W:
      //   1. pessoa P está em pressão/sobrecarga (>100% cap)
      //   2. projeto sustentação Q está em pressão/sobrecarga (>100% cap mensal/4)
      //   3. P concentra ≥40% do esforço dela em W naquele Q (correlação forte)
      // Estratégia única: realocar pra match de `cliente_principal_id`
      // (preferido) ou `cliente_secundario_id` do projeto.
      // Apresentação: só listar + abrir task (sem auto-apply).
      get weeklyRedistSuggestions() {
        const sig = this._tasksSig + ':' + this.pessoas.length + ':' + this.projetos.length + ':' + this._dataRev;
        return this._memo('weeklyRedistSuggestions', sig, () => this._computeWeeklyRedistSuggestions());
      },
      // Stats diagnósticos por estágio — útil quando weeklyRedistSuggestions
      // retorna vazio, pro user entender em qual filtro travou.
      get weeklyRedistDiagInfo() {
        const wca = this.weeklyCapacityAnalysis;
        const pessoasComSobrecarga = wca.pessoas.filter(p => p.anyOverload).length;
        const sustEmPressao = wca.sustentacoes.filter(s =>
          s.weeks.some(w => w.nivel === 'sobrecarga' || w.nivel === 'pressao')
        ).length;
        return {
          pessoasInternas: wca.pessoas.length,
          sustentacoes: wca.sustentacoes.length,
          pessoasComSobrecarga,
          sustEmPressao,
          totalSugestoes: this.weeklyRedistSuggestions.length,
        };
      },
      _computeWeeklyRedistSuggestions() {
        const today = new Date().toISOString().slice(0, 10);
        const wca = this.weeklyCapacityAnalysis;
        if (!wca.pessoas.length || !wca.sustentacoes.length) return [];
  
        const ativas = this._visibleTasksExternas.filter(t => t.status !== STATUS.CONCLUIDO && !t.arquivadoEm);
  
        // Index tasks por (pessoa, semana). Atrasadas vão pra W0 (mesma regra da agregação).
        const tasksByPessoaWeek = new Map();
        for (const p of this.pessoas) {
          if (p.role === ROLE.CLIENTE) continue;
          tasksByPessoaWeek.set(p.id, [[],[],[],[]]);
        }
        for (const t of ativas) {
          if (!t.pessoaId) continue;
          const arr = tasksByPessoaWeek.get(t.pessoaId);
          if (!arr) continue;
          const idx = taskWeekIndex(t, today);
          const bucket = (idx === -1) ? 0 : idx;
          if (bucket >= 0 && bucket <= 3) arr[bucket].push(t);
        }
  
        const sustById = new Map(wca.sustentacoes.map(s => [s.projetoId, s]));
        const wcaPessoaById = new Map(wca.pessoas.map(p => [p.pessoaId, p]));
        const PRIO_RANK = { P0: 0, P1: 1, P2: 2, P3: 3 };
        const SEV_RANK = { sobrecarga: 2, pressao: 1, ok: 0, folga: 0, sem_cap: 0 };
  
        // 1) Detectar hits
        const hits = [];
        for (const pInfo of wca.pessoas) {
          if (!pInfo.anyOverload) continue;
          for (let w = 0; w <= 3; w++) {
            const wk = pInfo.weeks[w];
            if (wk.nivel !== 'sobrecarga' && wk.nivel !== 'pressao') continue;
            if (wk.hours <= 0) continue;
  
            const tasksW = (tasksByPessoaWeek.get(pInfo.pessoaId) || [[],[],[],[]])[w];
            if (!tasksW.length) continue;
  
            // agrupa esforço por projeto
            const horasPorProjeto = new Map();
            for (const t of tasksW) {
              if (!t.projetoId) continue;
              horasPorProjeto.set(t.projetoId, (horasPorProjeto.get(t.projetoId) || 0) + effEsforco(t));
            }
  
            for (const [projId, horas] of horasPorProjeto) {
              const concentracao = horas / wk.hours;
              if (concentracao < 0.40) continue;
              const sust = sustById.get(projId);
              if (!sust) continue;                                  // só sustentação tem ciclo semanal
              const projWk = sust.weeks[w];
              if (projWk.nivel !== 'sobrecarga' && projWk.nivel !== 'pressao') continue;
  
              // tasks redistribuíveis: dessa pessoa, nesse projeto, nessa semana, sem P0
              const redistribuiveis = tasksW
                .filter(t => t.projetoId === projId && t.prioridade !== 'P0')
                .sort((a, b) => (PRIO_RANK[b.prioridade] ?? 4) - (PRIO_RANK[a.prioridade] ?? 4));
              if (!redistribuiveis.length) continue;
  
              hits.push({
                pessoaId: pInfo.pessoaId,
                pessoaNome: pInfo.nome,
                pessoaPct: wk.pctCap,
                pessoaNivel: wk.nivel,
                weekIdx: w,
                projetoId: projId,
                projetoNome: sust.nome,
                clienteId: sust.clienteId,
                horasPessoaNoProjeto: horas,
                concentracao: Math.round(concentracao * 100),
                projetoPct: projWk.pctCap,
                tasksCandidatas: redistribuiveis,
              });
            }
          }
        }
  
        // 2) Gerar sugestão por hit (1 task realocada por hit)
        const result = [];
        for (const hit of hits) {
          // Track granular: candidates por estágio do filtro pra dar diagnóstico
          // útil quando não há sugestão viável (no-match vs no-cap vs no-slack vs no-fit).
          const matchedClient = [];   // pessoas com cliente principal/sec = clienteId
          const matchedWithCap = [];  // ... E com capacidade_horas_semana declarada
          const candidatos = [];      // ... E com folga (pctCap < 80) na semana W
          for (const cand of this.pessoas) {
            if (cand.id === hit.pessoaId) continue;
            if (cand.role === ROLE.CLIENTE) continue;
            const matchPri = cand.cliente_principal_id === hit.clienteId;
            const matchSec = cand.cliente_secundario_id === hit.clienteId;
            if (!matchPri && !matchSec) continue;
            matchedClient.push(cand);
            const candWca = wcaPessoaById.get(cand.id);
            if (!candWca) continue;
            const candWk = candWca.weeks[hit.weekIdx];
            if (candWk.pctCap == null) continue;                    // sem cap declarada
            matchedWithCap.push(cand);
            if (candWk.pctCap >= 80) continue;                      // sem folga
            candidatos.push({ pessoa: cand, wca: candWca, week: candWk, matchScore: matchPri ? 2 : 1 });
          }
          candidatos.sort((a, b) => {
            if (b.matchScore !== a.matchScore) return b.matchScore - a.matchScore;
            return a.week.pctCap - b.week.pctCap;
          });

          // tenta cada task em ordem (menor prioridade primeiro), achar candidato que não estoura
          let suggestion = null;
          for (const t of hit.tasksCandidatas) {
            const esf = effEsforco(t);
            for (const c of candidatos) {
              const cap = c.wca.capacidade;
              if (!(cap > 0)) continue;
              const newPct = Math.round(((c.week.hours + esf) / cap) * 100);
              if (newPct > 100) continue;                           // anti-otimização míope
              suggestion = { hit, task: t, candidate: c, newPctCandidate: newPct, reason: 'ok' };
              break;
            }
            if (suggestion) break;
          }
          if (!suggestion) {
            // Diagnóstico granular: razão específica + contagem por estágio.
            // Substitui o antigo 'no-match' guarda-chuva que escondia "tem pessoa
            // mas sem cap" ou "tem cap mas sem folga".
            let reason;
            if (matchedClient.length === 0)       reason = 'no-match';   // ninguém com cliente principal/sec
            else if (matchedWithCap.length === 0) reason = 'no-cap';     // tem pessoa, faltam capacidade declarada
            else if (candidatos.length === 0)     reason = 'no-slack';   // tem cap, sem folga na semana
            else                                   reason = 'no-fit';    // tem folga, mas absorver estoura

            // Nomes pra UI exibir quem foi considerado
            const matchedNomes = matchedClient.map(p => p.nome).join(', ');
            const semCapNomes = matchedClient
              .filter(p => !matchedWithCap.includes(p))
              .map(p => p.nome).join(', ');
            suggestion = {
              hit, task: hit.tasksCandidatas[0], candidate: null, newPctCandidate: null,
              reason,
              diag: {
                matched: matchedClient.length,
                withCap: matchedWithCap.length,
                withSlack: candidatos.length,
                matchedNomes,
                semCapNomes,
              },
            };
          }
          result.push(suggestion);
        }
  
        // 3) Ordena: weekIdx ASC (mais urgente primeiro), severidade DESC, depois pct DESC
        result.sort((a, b) => {
          if (a.hit.weekIdx !== b.hit.weekIdx) return a.hit.weekIdx - b.hit.weekIdx;
          const sevDiff = SEV_RANK[b.hit.pessoaNivel] - SEV_RANK[a.hit.pessoaNivel];
          if (sevDiff !== 0) return sevDiff;
          return b.hit.pessoaPct - a.hit.pessoaPct;
        });
  
        return result.slice(0, 5);
      },
  
      // Sugestões de redistribuição (página 2). Heurística simples:
      // pra cada pessoa sobrecarregada (>50h), buscar 2-3 tasks dela
      // (atrasadas / P0 / P1) que poderiam ser passadas pra alguém
      // disponível (<20h e mesmo papel interno).
      get reportRedistSuggestions() {
        const team = this.reportTeamLoad;
        const sobrecarregados = team.filter(p => p.sobrecarga);
        const disponiveis     = team.filter(p => p.subutilizada).sort((a,b) => a.horas - b.horas);
        if (sobrecarregados.length === 0 || disponiveis.length === 0) return [];
        const prioRank = { P0: 0, P1: 1, P2: 2, P3: 3 };
        const out = [];
        let dispIdx = 0;
        for (const sobre of sobrecarregados) {
          // Top 3 tasks transferíveis dessa pessoa (excluindo bucket interno)
          const candidatos = this._visibleTasksExternas
            .filter(t => t.pessoaId === sobre.id && t.status !== STATUS.CONCLUIDO)
            .sort((a,b) => {
              const sa = (this.atrasada(a) ? 0 : 1) + (prioRank[a.prioridade] ?? 9) * 0.1;
              const sb = (this.atrasada(b) ? 0 : 1) + (prioRank[b.prioridade] ?? 9) * 0.1;
              return sa - sb;
            })
            .slice(0, 3);
          for (const t of candidatos) {
            if (dispIdx >= disponiveis.length) break;
            const dest = disponiveis[dispIdx];
            const tag = this.atrasada(t) ? 'atrasada' : t.prioridade;
            const h = this.effEsforco(t);
            out.push(
              `Passar "${t.titulo.slice(0, 60)}${t.titulo.length>60?'…':''}" (${tag}, ${h}h) ` +
              `de ${sobre.nome.split(' ')[0]} (${sobre.horas}h) pra ${dest.nome.split(' ')[0]} (${dest.horas}h).`
            );
            dest.horas += h; // simulação local
            if (dest.horas >= 30) dispIdx++; // se ficou ocupado, próximo
          }
          if (out.length >= 5) break; // limite de sugestões por relatório
        }
        return out.slice(0, 5);
      },
    };
  }

  window.makeBriefingView = makeBriefingView;
})();
