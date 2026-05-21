/* ============ tasks 360 · Anexos (storage + UI) ============
 * Upload, download, preview, delete e crop de imagem.
 * Self-contained — toda lógica de attachments isolada.
 *
 * Dependências em app() (permanecem lá):
 *   - this.editing, this.attachments, this.toast, this.session, this.currentPessoa
 *   - this.lightboxOpen, this.lightboxAttachment, this.lightboxIndex
 *
 * Dependências em window:
 *   - sb (supabase-client.js), STATUS
 * ============================================================
 */

(function () {
  'use strict';

  function makeAnexosView() {
    return {
      // ===================== ANEXOS =====================
      async loadAttachments(taskId) {
        if (!taskId) { this.editingAttachments = []; this.attachmentUrls = {}; return; }
        const { data, error } = await sb.from('task_attachments')
          .select('id, task_id, storage_path, mime, size_bytes, width, height, author_pessoa_id, criado_em')
          .eq('task_id', taskId)
          .order('criado_em', { ascending: false });
        if (error) return;
        this.editingAttachments = data || [];
        this._refreshAttachmentUrls();
      },
      async _refreshAttachmentUrls() {
        const paths = this.editingAttachments.map(a => a.storage_path);
        if (!paths.length) { this.attachmentUrls = {}; return; }
        const { data, error } = await sb.storage.from('task-attachments').createSignedUrls(paths, 3600);
        if (error || !data) return;
        const map = {};
        data.forEach((row, idx) => {
          const a = this.editingAttachments[idx];
          if (a && row && row.signedUrl) map[a.id] = row.signedUrl;
        });
        this.attachmentUrls = map;
      },
      _canDeleteAttachment(a) {
        if (!a || !a.id) return false;
        if (this.viewerRole === ROLE.ADMIN) return true;
        return !!(this.currentPessoa && a.author_pessoa_id === this.currentPessoa.id);
      },
      fmtBytes(n) {
        const b = Number(n) || 0;
        if (b < 1024) return b + ' B';
        if (b < 1024 * 1024) return (b / 1024).toFixed(0) + ' KB';
        return (b / (1024 * 1024)).toFixed(1) + ' MB';
      },
      openLightbox(a) { this.lightboxAttachment = a; },
      onModalPaste(ev) {
        if (!this.modal || !this.editing.id) return;
        const items = ev && ev.clipboardData && ev.clipboardData.files;
        if (!items || !items.length) return;
        const imgs = Array.from(items).filter(f => f && /^image\/(png|jpe?g|webp)$/i.test(f.type));
        if (!imgs.length) return;
        ev.preventDefault();
        // Upload sequencial (1 imagem por vez é o caso normal de paste).
        (async () => {
          for (const f of imgs) {
            await this._uploadAttachment(f);
          }
          if (this.modalTab !== 'anexos') {
            this.toast('success', imgs.length === 1 ? 'Anexo adicionado.' : imgs.length + ' anexos adicionados.');
          }
        })();
      },
      async _uploadAttachment(file) {
        const taskId = this.editing && this.editing.id;
        if (!taskId) return;
        this.attachmentUploading = true;
        this.attachmentUploadLabel = 'processando…';
        try {
          const processed = await this._downscaleImage(file, 1600, 0.85);
          if (!processed) { this.toast('error', 'Falha ao processar imagem.'); return; }
          if (processed.blob.size > 2 * 1024 * 1024) {
            this.toast('error', 'Imagem ainda acima de 2MB após compressão. Tente um print menor.');
            return;
          }
          this.attachmentUploadLabel = 'enviando…';
          const ext = processed.blob.type === 'image/png' ? 'png' : (processed.blob.type === 'image/webp' ? 'webp' : 'jpg');
          const objId = (crypto && crypto.randomUUID) ? crypto.randomUUID() : Math.random().toString(36).slice(2);
          const path = `${taskId}/${objId}.${ext}`;
          const { error: upErr } = await sb.storage.from('task-attachments').upload(path, processed.blob, {
            contentType: processed.blob.type,
            upsert: false,
          });
          if (upErr) { this.toast('error', 'Erro no upload: ' + upErr.message); return; }
          const authorPessoaId = (this.currentPessoa && this.currentPessoa.id) || null;
          const { data, error: insErr } = await sb.from('task_attachments').insert({
            task_id: taskId,
            storage_path: path,
            mime: processed.blob.type,
            size_bytes: processed.blob.size,
            width: processed.width,
            height: processed.height,
            author_pessoa_id: authorPessoaId,
          }).select('id, task_id, storage_path, mime, size_bytes, width, height, author_pessoa_id, criado_em').single();
          if (insErr) {
            await sb.storage.from('task-attachments').remove([path]);
            this.toast('error', 'Erro ao registrar anexo: ' + insErr.message);
            return;
          }
          this.editingAttachments = [data, ...this.editingAttachments];
          this._refreshAttachmentUrls();
          this.track('attachment_upload', { size: processed.blob.size, mime: processed.blob.type });
        } finally {
          this.attachmentUploading = false;
          this.attachmentUploadLabel = '';
        }
      },
      _downscaleImage(file, maxDim, quality) {
        // Lê o file, desenha em canvas redimensionado, exporta JPEG (ou PNG se input PNG c/ transparência).
        return new Promise((resolve) => {
          const url = URL.createObjectURL(file);
          const img = new Image();
          img.onload = () => {
            URL.revokeObjectURL(url);
            const ratio = Math.min(1, maxDim / Math.max(img.width, img.height));
            const w = Math.round(img.width * ratio);
            const h = Math.round(img.height * ratio);
            const canvas = document.createElement('canvas');
            canvas.width = w; canvas.height = h;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, w, h);
            // PNG só preserva se o input era PNG e pequeno (transparência preservada); senão JPEG.
            const outType = (file.type === 'image/png' && file.size < 800 * 1024) ? 'image/png' : 'image/jpeg';
            canvas.toBlob((blob) => {
              if (!blob) { resolve(null); return; }
              resolve({ blob, width: w, height: h });
            }, outType, quality);
          };
          img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
          img.src = url;
        });
      },
      deleteAttachment(a) {
        if (!this._canDeleteAttachment(a)) return;
        this.askConfirm('Excluir este anexo?', async () => {
          const i = this.editingAttachments.findIndex(x => x.id === a.id);
          const prev = i >= 0 ? this.editingAttachments[i] : null;
          if (i >= 0) this.editingAttachments.splice(i, 1);
          if (this.lightboxAttachment && this.lightboxAttachment.id === a.id) this.lightboxAttachment = null;
          const { error: delErr } = await sb.from('task_attachments').delete().eq('id', a.id);
          if (delErr) {
            if (prev) this.editingAttachments.splice(i, 0, prev);
            this.toast('error', 'Erro ao excluir: ' + delErr.message);
            return;
          }
          // Tenta limpar o storage object (best-effort; órfão é OK pois cron pega).
          sb.storage.from('task-attachments').remove([a.storage_path]).catch(() => {});
          this.track('attachment_delete', {});
        });
      },
      repliesOf(parentId) {
        return this.editingComments.filter(c => c.parent_id === parentId);
      },
      get topLevelComments() {
        // top-level: parent_id null. Mais recente primeiro.
        return this.editingComments
          .filter(c => !c.parent_id)
          .slice()
          .sort((a, b) => {
            const ta = new Date(a.posted_em || a.criado_em).getTime();
            const tb = new Date(b.posted_em || b.criado_em).getTime();
            return tb - ta;
          });
      },
      startReply(parentId) {
        this.replyingToId = parentId;
        this.newReply = '';
        this.$nextTick(() => {
          const el = document.querySelector(`[data-reply-input="${parentId}"]`);
          if (el) el.focus();
        });
      },
      cancelReply() {
        this.replyingToId = '';
        this.newReply = '';
      },
      async postReply(parentId) {
        const body = (this.newReply || '').trim();
        if (!body || !this.editing.id || !parentId) return;
        const author = (this.currentPessoa && this.currentPessoa.nome) || 'app';
        const authorPessoaId = (this.currentPessoa && this.currentPessoa.id) || null;
        // Herda visibilidade do parent: se o cliente perguntou (visivel_cliente=true),
        // a resposta também precisa aparecer pro cliente. Senão fica interna.
        const parent = this.editingComments.find(x => x.id === parentId);
        const visivel = !!(parent && parent.visivel_cliente);
        const tempId = 'tmp-' + Math.random().toString(36).slice(2, 8);
        const optimistic = {
          id: tempId, parent_id: parentId, author, body,
          author_pessoa_id: authorPessoaId,
          external_source: null, posted_em: null,
          criado_em: new Date().toISOString(),
          visivel_cliente: visivel, from_cliente: false,
        };
        this.editingComments = [...this.editingComments, optimistic];
        this.newReply = '';
        this.replyingToId = '';
        const { data, error } = await sb.from('task_comments')
          .insert({ task_id: this.editing.id, parent_id: parentId, author, body, author_pessoa_id: authorPessoaId, visivel_cliente: visivel, from_cliente: false })
          .select('id, parent_id, author, body, author_pessoa_id, external_source, posted_em, criado_em, visivel_cliente, from_cliente')
          .single();
        if (error) {
          this.editingComments = this.editingComments.filter(c => c.id !== tempId);
          this.newReply = body;
          this.replyingToId = parentId;
          this.toast('error', 'Erro ao responder: ' + error.message);
          return;
        }
        this.editingComments = this.editingComments.map(c => c.id === tempId ? data : c);
        this.track('comment_reply', { has_mention: /@/.test(body) });
        // Notificações: @mentions no corpo da resposta (mesmo parser do postComment).
        try {
          await this._notifyMentions(this.editing.id, data.id, body);
        } catch (e) { console.warn('[notif] postReply notify failed:', e); }
      },
      fmtPostedEm(iso) {
        if (!iso) return '—';
        const d = new Date(iso);
        if (Number.isNaN(d.getTime())) return '—';
        const dd = String(d.getDate()).padStart(2,'0');
        const mm = String(d.getMonth()+1).padStart(2,'0');
        const yy = d.getFullYear();
        const hh = String(d.getHours()).padStart(2,'0');
        const mi = String(d.getMinutes()).padStart(2,'0');
        return `${dd}/${mm}/${yy} ${hh}:${mi}`;
      },
      // Converte HTML rich text (vindo do Salesforce Chatter) em texto plano,
      // preservando quebras de linha. Comments com HTML viram texto legível;
      // comments já em plain text passam intactos.
      stripHtml(s) {
        if (!s) return '';
        const str = String(s);
        // Curto-circuito: sem qualquer tag, retorna como veio.
        if (!/<[a-z!\/]/i.test(str)) return str;
        const tmp = document.createElement('div');
        tmp.innerHTML = str
          .replace(/<\/p\s*>/gi, '\n\n')
          .replace(/<br\s*\/?>/gi, '\n')
          .replace(/<\/li\s*>/gi, '\n')
          .replace(/<li[^>]*>/gi, '• ')
          .replace(/<\/(div|h[1-6]|tr)\s*>/gi, '\n');
        // textContent strips remaining tags + decodifica entidades (&amp; etc.)
        return (tmp.textContent || '').replace(/\n{3,}/g, '\n\n').replace(/[ \t]+\n/g, '\n').trim();
      },

      // Sanitiza HTML rich text via allowlist. Usado pra comments vindos de
      // integração externa (Salesforce) onde o body original é HTML formatado.
      // Estratégia: parse em DocumentFragment, walker que mantém só tags da
      // ALLOWED_TAGS, remove atributos exceto href em <a>. Defesa contra XSS
      // sem precisar de DOMPurify externo.
      _sanitizeHtmlRich(html) {
        if (!html) return '';
        const ALLOWED_TAGS = new Set([
          'P', 'BR', 'DIV', 'SPAN',
          'B', 'STRONG', 'I', 'EM', 'U', 'S', 'CODE', 'PRE',
          'UL', 'OL', 'LI',
          'A',
          'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
          'BLOCKQUOTE',
        ]);
        const tmp = document.createElement('div');
        tmp.innerHTML = String(html);
        // Walker iterativo (não recursivo pra evitar stack overflow em HTML grande).
        const walk = (node) => {
          // children snapshot porque vamos mutar
          const kids = Array.from(node.childNodes);
          for (const child of kids) {
            if (child.nodeType === 1) { // Element
              const tag = child.tagName;
              if (!ALLOWED_TAGS.has(tag)) {
                // Tag não permitida: substitui pelos filhos (mantém texto interno)
                const parent = child.parentNode;
                while (child.firstChild) parent.insertBefore(child.firstChild, child);
                parent.removeChild(child);
                continue;
              }
              // Remove TODOS atributos exceto href em <a>
              const attrs = Array.from(child.attributes);
              for (const a of attrs) {
                if (tag === 'A' && a.name === 'href') {
                  // Valida href: bloqueia javascript:, data:, vbscript:
                  const href = (a.value || '').trim();
                  if (/^\s*(javascript|data|vbscript):/i.test(href)) {
                    child.removeAttribute(a.name);
                  } else {
                    // força target=_blank + rel pra segurança
                    child.setAttribute('target', '_blank');
                    child.setAttribute('rel', 'noopener noreferrer');
                  }
                } else {
                  child.removeAttribute(a.name);
                }
              }
              walk(child);
            } else if (child.nodeType !== 3) { // não text node
              child.remove();
            }
          }
        };
        walk(tmp);
        return tmp.innerHTML;
      },

      // Renderiza body de comment como HTML seguro.
      // - external_source==='salesforce': body é HTML rich text (campo
      //   HTML do Chatter/Feed). Sanitiza via allowlist preservando formatação.
      // - Caso contrário: strip de tags, escape, e realça @firstname que
      //   bate com pessoa cadastrada (interno/admin).
      renderCommentBody(body, externalSource) {
        if (externalSource === 'salesforce') {
          return this._sanitizeHtmlRich(body);
        }
        const plain = this.stripHtml(body);
        const escaped = plain
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');
        const firstNames = new Set(
          this.pessoas
            .filter(p => p.role !== ROLE.CLIENTE)
            .map(p => (p.nome || '').split(/\s+/)[0])
            .filter(Boolean)
        );
        // @palavra (com acentos): se bate first name, vira span destacado.
        return escaped
          .replace(/@([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ0-9]*)/g, (m, name) => {
            return firstNames.has(name) ? `<span class="mention">@${name}</span>` : m;
          })
          .replace(/\n/g, '<br>');
      },
      // Detecta @\w* sendo digitado no textarea e abre o picker com a query
      // que veio direto do texto (sem precisar clicar no botão "@ mencionar").
      // Salva o anchor (posição do @) pra substituir o partial certinho ao
      // escolher uma pessoa via appendMention.
      onMentionInput(field, ev) {
        const txt = this[field] || '';
        const caret = (ev && ev.target && typeof ev.target.selectionStart === 'number') ? ev.target.selectionStart : txt.length;
        const before = txt.slice(0, caret);
        // Pega último token tipo "@xxx" se estiver no fim e sem whitespace dentro.
        const m = before.match(/(?:^|\s)@([A-Za-zÀ-ÿ0-9-]*)$/);
        if (m) {
          this._mentionAnchor = caret - m[1].length - 1; // posição do '@'
          this._mentionField = field;
          this.mentionPickerQuery = m[1];
          this.mentionPickerFor = field;
          this._mentionActiveIdx = 0;
        } else if (this.mentionPickerFor === field) {
          this.mentionPickerFor = '';
          this._mentionAnchor = null;
        }
      },
      appendMention(field, firstName) {
        const txt = this[field] || '';
        const insert = '@' + firstName + ' ';
        let newCaret;
        // Fluxo inline: substitui '@partial' no anchor por '@FirstName '.
        if (this._mentionAnchor != null && this._mentionField === field) {
          const anchor = this._mentionAnchor;
          const rest = txt.slice(anchor).replace(/^@[A-Za-zÀ-ÿ0-9-]*/, insert);
          this[field] = txt.slice(0, anchor) + rest;
          newCaret = anchor + insert.length;
        } else {
          // Fluxo botão: concatena no fim.
          const sep = txt && !txt.endsWith(' ') && !txt.endsWith('\n') ? ' ' : '';
          this[field] = txt + sep + insert;
          newCaret = (this[field] || '').length;
        }
        this.mentionPickerFor = '';
        this.mentionPickerQuery = '';
        this._mentionAnchor = null;
        this._mentionField = null;
        this._mentionActiveIdx = 0;
        this._focusComposer(field, newCaret);
      },
      // Devolve foco pro textarea após pick e posiciona o caret depois do nome.
      _focusComposer(field, caret) {
        this.$nextTick(() => {
          let el = null;
          if (field === 'newComment') el = this.$refs.newCommentTa;
          else if (field === 'newReply' && this.replyingToId) {
            el = document.querySelector('[data-reply-input="' + this.replyingToId + '"]');
          }
          if (!el) return;
          el.focus();
          if (typeof caret === 'number') {
            try { el.setSelectionRange(caret, caret); } catch (_) {}
          }
        });
      },
      // Navegação por teclado no picker (chamado pelas textareas).
      _mentionMove(delta) {
        const list = this.mentionablePessoas(this.mentionPickerQuery);
        if (!list.length) return;
        const len = list.length;
        this._mentionActiveIdx = ((this._mentionActiveIdx || 0) + delta + len) % len;
      },
      // Permissão: autor (mesma pessoa logada) ou admin pode excluir.
      // Comentários do Salesforce (external_source) ficam não-deletáveis pra
      // não criar dessync com a fonte externa.
      _canDeleteComment(c) {
        if (!c || !c.id || c.external_source) return false;
        if (this.viewerRole === ROLE.ADMIN) return true;
        return !!(this.currentPessoa && c.author_pessoa_id === this.currentPessoa.id);
      },
      // Edit é mais restrito que delete: só o próprio autor (admin não edita texto alheio).
      _canEditCommentBody(c) {
        if (!c || !c.id || c.external_source || c.from_cliente) return false;
        return !!(this.currentPessoa && c.author_pessoa_id === this.currentPessoa.id);
      },
      startEditComment(c) {
        if (!this._canEditCommentBody(c)) return;
        this.editingCommentId = c.id;
        this.editingCommentDraft = c.body || '';
        this.$nextTick(() => {
          const el = document.querySelector('[data-edit-comment="' + c.id + '"]');
          if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
        });
      },
      cancelEditComment() {
        this.editingCommentId = '';
        this.editingCommentDraft = '';
      },
      async saveEditComment(c) {
        if (!c || !this._canEditCommentBody(c)) return;
        const body = (this.editingCommentDraft || '').trim();
        if (!body) { this.toast('error', 'Comentário não pode ficar vazio.'); return; }
        if (body === (c.body || '').trim()) { this.cancelEditComment(); return; }
        const i = this.editingComments.findIndex(x => x.id === c.id);
        if (i < 0) return;
        const prev = this.editingComments[i];
        const nowIso = new Date().toISOString();
        this.editingComments[i] = { ...prev, body, edited_em: nowIso };
        this.cancelEditComment();
        const { error } = await sb.from('task_comments').update({ body, edited_em: nowIso }).eq('id', c.id);
        if (error) {
          this.editingComments[i] = prev;
          this.toast('error', 'Erro ao salvar: ' + error.message);
          return;
        }
        this.track('comment_edit', { is_reply: !!prev.parent_id });
      },
      // Mesma regra do delete: autor ou admin. SF/cliente fica imutável.
      _canEditCommentVisivel(c) {
        if (!c || !c.id || c.external_source || c.from_cliente) return false;
        if (this.viewerRole === ROLE.ADMIN) return true;
        return !!(this.currentPessoa && c.author_pessoa_id === this.currentPessoa.id);
      },
      async toggleCommentVisivel(c) {
        if (!this._canEditCommentVisivel(c)) return;
        const prev = !!c.visivel_cliente;
        const next = !prev;
        // Optimistic: atualiza o objeto local (Alpine reativo) antes do DB.
        const i = this.editingComments.findIndex(x => x.id === c.id);
        if (i < 0) return;
        this.editingComments[i] = { ...this.editingComments[i], visivel_cliente: next };
        const { error } = await sb.from('task_comments').update({ visivel_cliente: next }).eq('id', c.id);
        if (error) {
          this.editingComments[i] = { ...this.editingComments[i], visivel_cliente: prev };
          this.toast('error', 'Erro ao alterar visibilidade: ' + error.message);
          return;
        }
        this.track('comment_visivel_toggle', { to: next });
      },
      deleteComment(c) {
        if (!c || !c.id) return;
        const isReply = !!c.parent_id;
        const msg = isReply ? 'Excluir esta resposta?' : 'Excluir este comentário (e suas respostas)?';
        this.askConfirm(msg, async () => {
          const id = c.id;
          const idsToRemove = new Set([id]);
          if (!isReply) {
            // top-level: remove cascade dos replies otimisticamente
            this.editingComments.filter(x => x.parent_id === id).forEach(x => idsToRemove.add(x.id));
          }
          const prev = this.editingComments;
          this.editingComments = prev.filter(x => !idsToRemove.has(x.id));
          // Top-level: apaga replies antes (defensivo caso schema não tenha
          // ON DELETE CASCADE no parent_id).
          if (!isReply) {
            const replyIds = [...idsToRemove].filter(x => x !== id);
            if (replyIds.length) await sb.from('task_comments').delete().in('id', replyIds);
          }
          const { error } = await sb.from('task_comments').delete().eq('id', id);
          if (error) {
            this.editingComments = prev;
            this.toast('error', 'Erro ao excluir: ' + error.message);
            return;
          }
          this.track('comment_delete', { is_reply: isReply });
          this.toast('success', isReply ? 'Resposta excluída.' : 'Comentário excluído.');
        });
      },
      _mentionPickActive(field) {
        const list = this.mentionablePessoas(this.mentionPickerQuery);
        const p = list[this._mentionActiveIdx || 0];
        if (!p) return;
        this.appendMention(field, (p.nome || '').split(' ')[0]);
      },
      mentionablePessoas(query) {
        const q = (query || '').toLowerCase();
        return this.pessoas
          .filter(p => p.role !== ROLE.CLIENTE)
          .filter(p => !q || (p.nome || '').toLowerCase().includes(q))
          .slice(0, 8);
      },
      async refreshFromLogo() {
        if (this.refreshing) return;
        this.refreshing = true;
        // Garante que o pulse seja visível mesmo se a rede vier rápido (UX).
        const minDelay = new Promise(r => setTimeout(r, 700));
        try {
          await Promise.all([this.load(), minDelay]);
        } finally {
          this.refreshing = false;
        }
      },
      // Janela de tasks concluídas carregadas por default (em dias).
      // Tasks concluídas há mais tempo só vêm via loadOlderConcluidas().
      TASKS_CONCLUIDAS_WINDOW_DAYS: 90,
      historicoCompletoCarregado: false,
  
      _tasksWindowCutoff() {
        const d = new Date();
        d.setDate(d.getDate() - this.TASKS_CONCLUIDAS_WINDOW_DAYS);
        return d.toISOString();
      },
      // Colunas leves carregadas no boot. `descricao` (pode ser markdown
      // longo) fica off-list e é puxada lazy quando o modal abre.
      _TASK_LIGHT_COLS: 'id,titulo,cliente_id,projeto_id,pessoa_id,prioridade,esforco,complexidade,prazo,status,subetapa,bloqueado_por,visivel_cliente,criado_em,status_em,subetapa_em,ordem,tags,checklist,reopen_count,tipo_trabalho,tempo_real_horas,external_source,external_id,arquivado_em,criado_por_ia,privada',
      _buildTasksQuery(extra) {
        // Default: todas não-concluídas + concluídas dos últimos N dias.
        // status_em é setado pelo banco quando muda status; concluídas sem
        // status_em (cenário improvável) entram pelo OR de status.
        const cutoff = this._tasksWindowCutoff();
        let q = sb.from('tasks').select(this._TASK_LIGHT_COLS)
          .or(`status.neq.concluido,status_em.gte.${cutoff}`)
          .order('criado_em', { ascending: false });
        if (extra) q = extra(q);
        return q;
      },
      async load() {
        // Bifurca: cliente externo carrega apenas dados próprios (menos
        // queries, menos campos sensíveis no payload). Staff (admin/interno)
        // continua com loadFull. RLS no banco bloqueia tentativas cross-tenant,
        // este split é defesa em profundidade + redução de payload.
        if (this.currentPessoa && this.currentPessoa.role === ROLE.CLIENTE) {
          return this._loadPortal();
        }
        return this._loadFull();
      },
      async _loadFull() {
        try {
          const [c, p, ps, t, h, td] = await Promise.all([
            sb.from('clientes').select('id,nome,tier,eh_interno,arquivado_em,dominios,webhook_enabled').order('nome'),
            sb.from('projetos').select('id,nome,cliente_id,sla_resposta_horas,sla_entrega_dias,orcamento_horas,tipo,arquivado_em').order('nome'),
            sb.from('pessoas').select('id,nome,email,user_id,invited_at,role,cliente_id,cliente_principal_id,cliente_secundario_id,capacidade_horas_semana,skills,senioridade').order('nome'),
            this._buildTasksQuery(),
            sb.from('task_field_history')
              .select('task_id, field, from_value, to_value, actor_pessoa_id, actor_source, occurred_at')
              .eq('field', 'status')
              .gte('occurred_at', this._tasksWindowCutoff())
              .order('occurred_at', { ascending: false }),
            sb.from('task_dependencies').select('task_id, depende_de_id'),
          ]);
          const err = c.error || p.error || ps.error || t.error || h.error || td.error;
          if (err) throw err;
          this.clientes = c.data.map(clienteFromDb);
          this.projetos = p.data.map(projetoFromDb);
          this.pessoas  = ps.data;
          this._setAllTasks(t.data.map(taskFromDb));
          this.historyAll = h.data || [];
          this.taskDeps = td.data || [];
          this.historicoCompletoCarregado = false;
        } catch (e) {
          console.error('Falha ao carregar do Supabase', e);
          this.toast('error', 'Falha ao carregar: ' + (e.message || e));
        }
      },
      async _loadPortal() {
        // Cliente externo: payload mínimo, sem campos sensíveis.
        // - pessoas: somente a própria linha (a RLS já bloqueia o resto;
        //   selecionamos só os campos que o Portal usa pra nomes de contato)
        // - clientes: só o cliente vinculado
        // - projetos: só do cliente vinculado, sem orçamento/SLA contratados
        // - tasks: visíveis do cliente; query e taskFromDb compat
        // - history e deps: não usados no Portal — não carrega
        const cid = this.currentPessoa && this.currentPessoa.cliente_id;
        if (!cid) {
          this.clientes = []; this.projetos = []; this.pessoas = [];
          this.historyAll = []; this.taskDeps = [];
          this._setAllTasks([]);
          return;
        }
        try {
          const [c, p, ps, t] = await Promise.all([
            sb.from('clientes').select('id,nome,tier,eh_interno,arquivado_em,dominios').eq('id', cid),
            sb.from('projetos').select('id,nome,cliente_id,tipo,arquivado_em').eq('cliente_id', cid).order('nome'),
            // RLS limita a própria linha. Não pedimos skills/senioridade/
            // capacidade/cliente_principal/secundario.
            sb.from('pessoas').select('id,nome,email,user_id,invited_at,role,cliente_id').order('nome'),
            sb.from('tasks').select(this._TASK_LIGHT_COLS)
              .eq('cliente_id', cid)
              .eq('visivel_cliente', true)
              .order('criado_em', { ascending: false }),
          ]);
          const err = c.error || p.error || ps.error || t.error;
          if (err) throw err;
          this.clientes = (c.data || []).map(clienteFromDb);
          this.projetos = (p.data || []).map(projetoFromDb);
          this.pessoas  = ps.data || [];
          this._setAllTasks((t.data || []).map(taskFromDb));
          this.historyAll = [];
          this.taskDeps = [];
          this.historicoCompletoCarregado = true;  // não há janela de "mais antigo" no portal
        } catch (e) {
          console.error('Falha ao carregar portal do cliente', e);
          this.toast('error', 'Falha ao carregar: ' + (e.message || e));
        }
      },
      // Refetch completo da tabela tasks. Usado como fallback do realtime
      // (debounce) quando chega evento sem payload utilizável. O caminho
      // normal de realtime aplica o payload direto, sem refetch.
      async refreshTasks() {
        // Mantém o filtro de janela se ainda não pediu histórico completo.
        const q = this.historicoCompletoCarregado
          ? sb.from('tasks').select(this._TASK_LIGHT_COLS).order('criado_em', { ascending: false })
          : this._buildTasksQuery();
        const { data, error } = await q;
        if (!error) this._setAllTasks(data.map(taskFromDb));
      },
      // Sob demanda: puxa concluídas antigas. Idempotente — mescla pelo id.
      async loadOlderConcluidas() {
        if (this.historicoCompletoCarregado) {
          this.toast('info', 'Histórico completo já carregado.');
          return;
        }
        const cutoff = this._tasksWindowCutoff();
        const { data, error } = await sb.from('tasks').select(this._TASK_LIGHT_COLS)
          .eq('status', 'concluido')
          .lt('status_em', cutoff)
          .order('status_em', { ascending: false });
        if (error) { this.toast('error', 'Erro ao carregar histórico: ' + error.message); return; }
        const older = (data || []).map(taskFromDb);
        const existing = new Set(this.tasks.map(t => t.id));
        this._setAllTasks([...this.tasks, ...older.filter(t => !existing.has(t.id))]);
        this.historicoCompletoCarregado = true;
        this.toast('success', `+${older.length} tarefa(s) concluída(s) antigas carregadas.`);
      },
      async refreshClientes() {
        const { data, error } = await sb.from('clientes').select('id,nome,tier,eh_interno,arquivado_em,dominios').order('nome');
        if (!error) this.clientes = data.map(clienteFromDb);
      },
      async refreshProjetos() {
        const { data, error } = await sb.from('projetos').select('id,nome,cliente_id,sla_resposta_horas,sla_entrega_dias,orcamento_horas,tipo,arquivado_em').order('nome');
        if (!error) this.projetos = data.map(projetoFromDb);
      },
      async refreshPessoas() {
        const { data, error } = await sb.from('pessoas').select('id,nome,email,user_id,invited_at,role,cliente_id,cliente_principal_id,cliente_secundario_id,capacidade_horas_semana,skills,senioridade').order('nome');
        if (!error) this.pessoas = data;
      },
      async convidarPessoa(p) {
        if (!p.email) {
          this.toast('error', `${p.nome} não tem email cadastrado. Edite no banco ou recadastre.`);
          return;
        }
        // 1) Marca como convidada (libera acesso futuro mesmo se o email falhar agora)
        const nowIso = new Date().toISOString();
        const { error: upErr } = await sb.from('pessoas').update({ invited_at: nowIso }).eq('id', p.id);
        if (upErr) { this.toast('error', 'Erro ao marcar convite: ' + upErr.message); return; }
        const i = this.pessoas.findIndex(x => x.id === p.id);
        if (i >= 0) this.pessoas[i] = { ...this.pessoas[i], invited_at: nowIso };
        // 2) Dispara magic link
        const { error } = await sb.auth.signInWithOtp({
          email: p.email,
          options: { emailRedirectTo: window.location.origin + window.location.pathname }
        });
        if (error) {
          this.toast('error', 'Convite marcado, mas falha ao enviar email: ' + error.message);
          return;
        }
        this.toast('success', `Convite enviado para ${p.email}`);
      },
      async ativarPessoa(p) {
        // Pra interno/admin: só marca invited_at (login é via Google, não precisa magic link).
        if (!p.email) {
          this.toast('error', `${p.nome} não tem email. Edite a pessoa antes de ativar.`);
          return;
        }
        const nowIso = new Date().toISOString();
        const i = this.pessoas.findIndex(x => x.id === p.id);
        const prev = i >= 0 ? this.pessoas[i] : null;
        if (i >= 0) this.pessoas[i] = { ...prev, invited_at: nowIso };
        const { error } = await sb.from('pessoas').update({ invited_at: nowIso }).eq('id', p.id);
        if (error) {
          if (prev) this.pessoas[i] = prev;
          this.toast('error', 'Erro ao ativar: ' + error.message);
          return;
        }
        this.toast('success', `${p.nome} ativada. Já pode entrar com Google.`);
      },
      desconvidarPessoa(p) {
        this.askConfirm(
          `Revogar acesso de ${p.nome}? Sessão ativa dele expira no próximo refresh do browser dele.`,
          async () => {
            const i = this.pessoas.findIndex(x => x.id === p.id);
            const prev = i >= 0 ? this.pessoas[i] : null;
            if (i >= 0) this.pessoas[i] = { ...prev, invited_at: null };
            const { error } = await sb.from('pessoas').update({ invited_at: null }).eq('id', p.id);
            if (error) {
              if (prev) this.pessoas[i] = prev;
              this.toast('error', 'Erro ao revogar: ' + error.message);
              return;
            }
            this.toast('success', `Acesso de ${p.nome} revogado.`);
          },
          { label: 'revogar' }
        );
      },
      askConfirm(msg, action, opts) {
        this.confirmTarget = { msg, action, label: (opts && opts.label) || 'excluir', danger: !(opts && opts.danger === false) };
      },
      runConfirm() {
        const t = this.confirmTarget;
        this.confirmTarget = null;
        if (t && typeof t.action === 'function') t.action();
      },
      toast(kind, msg, ms) {
        const id = Math.random().toString(36).slice(2, 9);
        this.toasts.push({ id, kind, msg });
        setTimeout(() => this.dismissToast(id), ms || (kind === 'error' ? 6000 : 3500));
      },
      dismissToast(id) { this.toasts = this.toasts.filter(t => t.id !== id); },
    };
  }

  window.makeAnexosView = makeAnexosView;
})();
