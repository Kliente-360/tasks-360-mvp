/* ============ tasks 360 · Charts (Dashboard) ============
 * Tema central de gráficos (chartTheme), renderCharts (8 charts do
 * dashboard), tooltip/options padrão. Chart.js via CDN.
 *
 * Dependências em app() (permanecem lá):
 *   - this.charts, this.tasks, this.dashTasks, this.atrasada, etc
 *
 * Dependências em window:
 *   - Chart (chart.js CDN), STATUS
 * =========================================================
 */

(function () {
  'use strict';

  function makeChartsView() {
    return {
      // ===================== CHARTS =====================
      // Tema central — paleta + opções base padronizadas. Todos os
      // gráficos do dashboard partem daqui pra ter mesma fonte, grid,
      // tooltip e cores semânticas.
      chartTheme() {
        const css = getComputedStyle(document.documentElement);
        const v = (n) => css.getPropertyValue(n).trim();
        const palette = {
          brand: v('--brand'), brandDark: v('--brand-dark'),
          danger: v('--p0'), warn: v('--p1'), info: v('--p2'), neutral: v('--p3'),
          ink: v('--ink'), inkSoft: v('--ink-soft'), muted: v('--muted'),
          line: v('--line'), bgElev: v('--bg-elev'),
        };
        const fontBrand = 'IBM Plex Sans';
        const fontMono  = 'IBM Plex Mono';
        const baseOpts = {
          responsive: true, maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: palette.ink, titleColor: palette.bgElev, bodyColor: palette.bgElev,
              padding: 10,
              titleFont: { family: fontBrand, size: 12, weight: 600 },
              bodyFont:  { family: fontMono,  size: 11 },
              displayColors: false,
            }
          },
          scales: {
            x: { grid: { display: false }, ticks: { color: palette.muted,   font: { family: fontMono, size: 11 } }, border: { display: false } },
            y: { grid: { color: palette.line }, ticks: { color: palette.inkSoft, font: { family: fontMono, size: 11 } }, border: { display: false } }
          }
        };
        return { palette, fontBrand, fontMono, baseOpts };
      },
  
      // Reusa instância de Chart.js quando possível. Trocar dados via
      // .update() é ~10x mais rápido que destruir e recriar o canvas.
      // Funciona enquanto o type não muda (todos charts são fixos no app).
      _upsertChart(key, ctx, config) {
        const existing = this.charts[key];
        if (existing && existing.canvas === ctx) {
          existing.data = config.data;
          existing.options = config.options;
          existing.update('none'); // sem animação no refresh
          return existing;
        }
        // Canvas diferente (DOM remontado via x-if) ou primeiro render: cria.
        if (existing) { try { existing.destroy(); } catch(_){} }
        this.charts[key] = new Chart(ctx, config);
        return this.charts[key];
      },
  
      // Carrega Chart.js sob demanda (não vem no boot — ~200KB que só
      // importam pra quem abre Dashboard/Briefing ou exporta PDF).
      // Idempotente: resolve na hora se já carregado; coalesce chamadas.
      _ensureChartJs() {
        if (window.Chart) return Promise.resolve();
        if (this._chartJsPromise) return this._chartJsPromise;
        this._chartJsPromise = new Promise((resolve, reject) => {
          const s = document.createElement('script');
          s.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js';
          s.onload = () => resolve();
          s.onerror = () => { this._chartJsPromise = null; reject(new Error('falha ao carregar Chart.js')); };
          document.head.appendChild(s);
        });
        return this._chartJsPromise;
      },
      async renderCharts() {
        try {
          await this._ensureChartJs();
        } catch (e) {
          this.toast('error', 'Gráficos indisponíveis: ' + (e.message || e));
          return;
        }
        this.track('dashboard_chart_render', { filter_cliente: !!this.f.cliente, filter_pessoa: !!this.f.pessoa, filter_projeto: !!this.f.projeto });
        const ativas = this.dashTasks.filter(t => t.status !== STATUS.CONCLUIDO);
        const theme = this.chartTheme();
        const { palette, baseOpts } = theme;
  
        // por cliente
        const porCliente = {};
        this.clientes.forEach(c => porCliente[c.nome] = 0);
        ativas.forEach(t => {
          const n = this.nomeCliente(t.clienteId);
          porCliente[n] = (porCliente[n] || 0) + this.effEsforco(t);
        });
        const cliEntries = Object.entries(porCliente).filter(([_,v]) => v > 0).sort((a,b) => b[1] - a[1]);
  
        // entregas — próximas 8 semanas (1ª barra = atrasadas)
        const startOfWeek = (d) => {
          const dt = new Date(d); dt.setHours(0,0,0,0);
          const diff = (dt.getDay() + 6) % 7;
          dt.setDate(dt.getDate() - diff);
          return dt;
        };
        const fmtSem = (d) => `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`;
        const hojeWk = startOfWeek(new Date());
        const semanas = [];
        for (let i = 0; i < 5; i++) {
          const ini = new Date(hojeWk); ini.setDate(ini.getDate() + i*7);
          const fim = new Date(ini); fim.setDate(fim.getDate() + 7);
          semanas.push({ ini, fim, label: fmtSem(ini), horas: 0, count: 0 });
        }
        let atrasadasH = 0, atrasadasN = 0;
        ativas.forEach(t => {
          if (!t.prazo) return;
          const prazo = new Date(t.prazo + 'T00:00:00');
          const h = this.effEsforco(t);
          if (prazo < hojeWk) { atrasadasH += h; atrasadasN++; return; }
          const wk = semanas.find(s => prazo >= s.ini && prazo < s.fim);
          if (wk) { wk.horas += h; wk.count++; }
        });
        const tlLabels = ['Atrasadas', ...semanas.map(s => s.label)];
        const tlData   = [atrasadasH, ...semanas.map(s => s.horas)];
        const tlCounts = [atrasadasN, ...semanas.map(s => s.count)];
  
        // _upsertChart reusa instâncias do mesmo canvas; cria/destroi
        // só quando o ctx muda (ex: x-if remontou o DOM).
  
        const horizBarOpts = {
          ...baseOpts, indexAxis: 'y',
          scales: {
            x: { ...baseOpts.scales.x, beginAtZero: true },
            y: { ...baseOpts.scales.y, grid: { display: false } },
          },
          plugins: {
            ...baseOpts.plugins,
            tooltip: {
              ...baseOpts.plugins.tooltip,
              callbacks: { label: (c) => c.parsed.x + 'h' }
            }
          }
        };
  
        const ctxC = document.getElementById('chartClientes');
        if (ctxC) {
          this._upsertChart('clientes', ctxC, {
            type: 'bar',
            data: {
              labels: cliEntries.map(e => e[0]),
              datasets: [{ data: cliEntries.map(e => e[1]), backgroundColor: palette.brand, borderRadius: 4, barThickness: 22 }]
            },
            options: horizBarOpts,
          });
        }
  
        // Carga por pessoa — operacional, sem expor cadastral.
        // Soma horas em ativas, destacando horas em tasks atrasadas.
        const cargaRows = [];
        const cargaMap = new Map();   // pessoaId → { horas, horasAtrasadas }
        for (const t of ativas) {
          if (!t.pessoaId) continue;
          let r = cargaMap.get(t.pessoaId);
          if (!r) { r = { horas: 0, horasAtrasadas: 0 }; cargaMap.set(t.pessoaId, r); }
          const h = this.effEsforco(t);
          r.horas += h;
          if (this.atrasada(t)) r.horasAtrasadas += h;
        }
        for (const p of this.pessoas) {
          if (p.role === ROLE.CLIENTE) continue;
          const r = cargaMap.get(p.id);
          if (!r || r.horas === 0) continue;
          cargaRows.push({ nome: p.nome, horas: r.horas, horasAtrasadas: r.horasAtrasadas });
        }
        cargaRows.sort((a, b) => b.horas - a.horas);
        const ctxCarga = document.getElementById('chartCargaPessoa');
        if (ctxCarga && cargaRows.length) {
          this._upsertChart('cargaPessoa', ctxCarga, {
            type: 'bar',
            data: {
              labels: cargaRows.map(r => r.nome),
              datasets: [
                {
                  label: 'Horas no prazo',
                  data: cargaRows.map(r => Math.max(0, r.horas - r.horasAtrasadas)),
                  backgroundColor: palette.brand,
                  borderRadius: { topLeft: 4, bottomLeft: 4 },
                  barThickness: 22,
                  stack: 's',
                },
                {
                  label: 'Horas em atrasadas',
                  data: cargaRows.map(r => r.horasAtrasadas),
                  backgroundColor: palette.danger,
                  borderRadius: { topRight: 4, bottomRight: 4 },
                  barThickness: 22,
                  stack: 's',
                },
              ],
            },
            options: {
              ...baseOpts, indexAxis: 'y',
              scales: {
                x: { ...baseOpts.scales.x, beginAtZero: true, ticks: { ...baseOpts.scales.x.ticks, callback: (v) => v + 'h' } },
                y: { ...baseOpts.scales.y, grid: { display: false }, stacked: true },
              },
              plugins: {
                ...baseOpts.plugins,
                tooltip: {
                  ...baseOpts.plugins.tooltip,
                  callbacks: {
                    title: (items) => cargaRows[items[0].dataIndex].nome,
                    label: (c) => {
                      const r = cargaRows[c.dataIndex];
                      if (c.datasetIndex === 1 && r.horasAtrasadas > 0) return `Atrasadas: ${r.horasAtrasadas}h`;
                      if (c.datasetIndex === 0) return `Total: ${r.horas}h`;
                      return '';
                    },
                  },
                },
              },
            },
          });
        }
  
        const ts = this.throughputSemanas;
        const ctxTh = document.getElementById('chartThroughput');
        if (ctxTh) {
          this._upsertChart('throughput', ctxTh, {
            type: 'bar',
            data: {
              labels: ts.map(s => s.label),
              datasets: [{
                data: ts.map(s => s.count),
                backgroundColor: ts.map((_, i) => i === ts.length - 1 ? palette.brandDark : palette.brand),
                borderRadius: 4, maxBarThickness: 36,
              }]
            },
            options: {
              ...baseOpts,
              plugins: {
                ...baseOpts.plugins,
                tooltip: {
                  ...baseOpts.plugins.tooltip,
                  callbacks: {
                    title: (items) => 'Semana de ' + ts[items[0].dataIndex].label,
                    label: (c) => c.parsed.y + ' tarefa(s) concluída(s)',
                  }
                }
              },
              scales: {
                x: baseOpts.scales.x,
                y: { ...baseOpts.scales.y, ticks: { ...baseOpts.scales.y.ticks, stepSize: 1, precision: 0 } }
              }
            }
          });
        }
  
        const ctxT = document.getElementById('chartTimeline');
        if (ctxT) {
          this._upsertChart('timeline', ctxT, {
            type: 'bar',
            data: {
              labels: tlLabels,
              datasets: [{
                data: tlData,
                backgroundColor: tlLabels.map((_,i) => i === 0 ? palette.danger : palette.brand),
                borderRadius: 4, maxBarThickness: 36,
              }]
            },
            options: {
              ...baseOpts,
              plugins: {
                ...baseOpts.plugins,
                tooltip: {
                  ...baseOpts.plugins.tooltip,
                  callbacks: {
                    title: (items) => {
                      const i = items[0].dataIndex;
                      if (i === 0) return 'Atrasadas';
                      const s = semanas[i-1];
                      const fim = new Date(s.fim); fim.setDate(fim.getDate()-1);
                      return 'Semana de ' + fmtSem(s.ini) + ' a ' + fmtSem(fim);
                    },
                    label: (c) => tlCounts[c.dataIndex] + ' tarefa(s) · ' + c.parsed.y + 'h',
                  }
                }
              },
              scales: {
                x: baseOpts.scales.x,
                y: { ...baseOpts.scales.y, ticks: { ...baseOpts.scales.y.ticks, callback: (v) => v + 'h' } }
              }
            }
          });
        }
  
        const ltRows = this.leadTimePorCliente;
        const ctxLT = document.getElementById('chartLeadTime');
        if (ctxLT && ltRows.length) {
          this._upsertChart('leadtime', ctxLT, {
            type: 'bar',
            data: {
              labels: ltRows.map(r => r.cliente),
              datasets: [{
                data: ltRows.map(r => r.leadDays),
                backgroundColor: palette.info,
                borderRadius: 4, barThickness: 22,
              }]
            },
            options: {
              ...horizBarOpts,
              plugins: {
                ...baseOpts.plugins,
                tooltip: {
                  ...baseOpts.plugins.tooltip,
                  callbacks: {
                    title: (items) => ltRows[items[0].dataIndex].cliente,
                    label: (c) => {
                      const r = ltRows[c.dataIndex];
                      return `${r.leadDays}d · ${r.count} tarefa(s)`;
                    }
                  }
                }
              },
              scales: {
                ...horizBarOpts.scales,
                x: { ...horizBarOpts.scales.x, ticks: { ...baseOpts.scales.x.ticks, callback: (v) => v + 'd' } },
              }
            }
          });
        }
  
      },
    };
  }

  window.makeChartsView = makeChartsView;
})();
