"use strict";
(() => {
  (() => {
    (() => {
      (() => {
        let currentSessionId = null;
        let currentProjectPath = null;
        let isStreaming = false;
        let pendingEl = null;
        let currentModelId = null;
        let settingsStep = "idle";
        let selectedProvider = null;
        // Codex-style session list state
        let expandedSessionId = null;   // Ctrl+E expanded preview
        const messagesEl = document.getElementById("messages");
        const inputEl = document.getElementById("msg-input");
        const sendBtn = document.getElementById("send-btn");
        const statusText = document.getElementById("status-text");
        const statusModel = document.getElementById("status-model");
        const sessionListEl = document.getElementById("session-list");
        const newProjectBtn = document.getElementById("new-project-btn");
        const abSidebarBtn = document.getElementById("ab-sidebar");
        const abSettingsBtn = document.getElementById("ab-settings");
        const projectView = document.getElementById("project-view");
        const abortBtn = document.getElementById("abort-btn");
        const settingsOverlay = document.getElementById("settings-overlay");
        const settingsClose = document.getElementById("settings-close");
        const settingsStatus = document.getElementById("settings-status");
        const currentModelDisplay = document.getElementById("current-model-display");
        const providerSelect = document.getElementById("provider-select");
        const welcomeCard = document.getElementById("welcome-card");
        const apiKeySection = document.getElementById("api-key-section");
        const apiKeyInput = document.getElementById("api-key-input");
        const saveApiKeyBtn = document.getElementById("save-api-key-btn");
        const skipApiKeyBtn = document.getElementById("skip-api-key-btn");
        const modelSection = document.getElementById("model-section");
        const modelSelect = document.getElementById("model-select");
        const compactBtn = document.getElementById("compact-btn");
        const statusCtx = document.getElementById("status-ctx");
        const statsOverlay = document.getElementById("stats-overlay");
        const statsBody = document.getElementById("stats-body");
        const statsClose = document.getElementById("stats-close");

        function showStatus(msg, type) {
          const overlay = document.getElementById('stats-overlay');
          const panel = document.getElementById('stats-panel');
          const body = document.getElementById('stats-body');
          if (!overlay || !panel || !body) return;
          body.innerHTML = `<div style="color:${type === 'error' ? '#f48771' : type === 'success' ? '#4ec9b0' : '#d4d4d4'};padding:8px 0;">${msg}</div>`;
          overlay.style.display = 'flex';
          overlay.style.alignItems = 'center';
          overlay.style.justifyContent = 'center';
          panel.style.width = '320px';
          document.getElementById('stats-close').style.display = 'none';
          clearTimeout(showStatus._timer);
          showStatus._timer = setTimeout(() => {
            overlay.style.display = 'none';
            document.getElementById('stats-close').style.display = '';
          }, 2500);
        }

        function scrollToBottom() {
          messagesEl.scrollTop = messagesEl.scrollHeight;
        }
        // ─── Block rendering helpers ────────────────────────────────────────────

        function renderBlock(block) {
          if (block.kind === "text") {
            return document.createTextNode(block.text);
          }
          if (block.kind === "image") {
            const img = document.createElement("img");
            img.src = block.url || block.text;
            img.alt = "image";
            img.style.maxWidth = "100%";
            return img;
          }

          // Reasoning block — wraps all thinking + tool calls + results
          if (block.kind === "reasoning") {
            const wrapper = document.createElement("div");
            wrapper.className = "reasoning-block";
            const toggle = document.createElement("div");
            toggle.className = "reasoning-toggle";
            toggle.textContent = block.summary || "▶ Reasoning";
            const content = document.createElement("div");
            content.className = "reasoning-content";
            content.style.display = "none";
            for (const step of (block.steps || [])) {
              const el = document.createElement("div");
              el.className = "reasoning-step " + (step.type || "");
              if (step.type === "thinking") {
                el.textContent = step.text;
              } else if (step.type === "toolCall") {
                const icon = step.result ? (step.result.isError ? "✗" : "✓") : "→";
                el.innerHTML = `<span class="reasoning-step-icon">${icon}</span> ${step.name} ${step.command || ""}`;
                if (step.result) {
                  const resultEl = document.createElement("div");
                  resultEl.className = "reasoning-step-result";
                  resultEl.textContent = step.result.text || "";
                  el.appendChild(resultEl);
                }
              } else if (step.type === "toolResult") {
                // skip — already shown as part of toolCall
                continue;
              }
              content.appendChild(el);
            }
            toggle.addEventListener("click", () => {
              const open = content.style.display === "none";
              content.style.display = open ? "" : "none";
              toggle.textContent = open
                ? (block.summary || "▶ Reasoning").replace("▶", "▾")
                : block.summary || "▶ Reasoning";
            });
            wrapper.appendChild(toggle);
            wrapper.appendChild(content);
            return wrapper;
          }

          // Tool result one-liner: ✓ bash  or  ✗ bash
          if (block.kind === "toolResult") {
            const wrapper = document.createElement("div");
            wrapper.className = "tool-result-line";
            const toggle = document.createElement("span");
            toggle.className = "tool-result-toggle";
            const icon = block.isError ? "✗" : "✓";
            toggle.innerHTML = `<span class="tool-result-icon ${block.isError ? 'error' : 'success'}">${icon}</span> <span class="tool-result-name">${block.name}</span>`;
            toggle.title = block.isError ? "执行失败，点击查看详情" : "执行成功，点击查看详情";
            const detail = document.createElement("div");
            detail.className = "tool-result-detail";
            detail.style.display = "none";
            detail.textContent = block.fullText || block.text;
            toggle.addEventListener("click", () => {
              const open = detail.style.display === "none";
              detail.style.display = open ? "" : "none";
              toggle.classList.toggle("expanded", open);
            });
            wrapper.appendChild(toggle);
            wrapper.appendChild(detail);
            return wrapper;
          }

          // Collapsible block (thinking / toolCall / toolExecution)
          const summary = getBlockSummary(block);
          const wrapper = document.createElement("div");
          wrapper.className = "collapsible-block";
          const toggle = document.createElement("div");
          toggle.className = "collapsible-toggle";
          toggle.textContent = summary;
          const content = document.createElement("div");
          content.className = "collapsible-content";
          content.style.display = "none";
          content.textContent = block.fullText || block.text;
          toggle.addEventListener("click", () => {
            const open = content.style.display === "none";
            content.style.display = open ? "" : "none";
            toggle.textContent = open ? (block.expandedLabel || summary) : summary;
            if (open) scrollToBottom();
          });
          wrapper.appendChild(toggle);
          wrapper.appendChild(content);
          return wrapper;
        }

        function getBlockSummary(block) {
          if (block.kind === "thinking") {
            const preview = block.text.slice(0, 80).replace(/\n/g, " ") + (block.text.length > 80 ? "…" : "");
            return "▶ Thinking: " + preview;
          }
          if (block.kind === "toolCall") {
            return "▶ Tool: " + block.name + "(" + truncateArgs(block.args) + ")";
          }
          if (block.kind === "toolExecution") {
            return "🏃 " + block.name + (block.args ? " " + truncateArgs(block.args) : "");
          }
          return "▶ " + block.kind;
        }

        function truncateArgs(args) {
          if (!args) return "";
          const s = typeof args === "string" ? args : JSON.stringify(args);
          return s.length > 60 ? s.slice(0, 60) + "…" : s;
        }

        function createMessageEl(role, blocks, status) {
          const div = document.createElement("div");
          div.className = `msg ${role}`;

          // Role label
          const roleLabel =
            role === "user" ? "You" :
            role === "assistant" ? "Assistant" :
            role === "toolResult" ? "Tool" :
            role === "error" ? "Error" :
            "";
          if (roleLabel) {
            const labelEl = document.createElement("div");
            labelEl.className = "role";
            labelEl.textContent = roleLabel + (status === "streaming" ? " · streaming…" : "");
            div.appendChild(labelEl);
          }

          // Content
          const contentEl = document.createElement("div");
          contentEl.className = "content";
          for (const block of blocks) {
            contentEl.appendChild(renderBlock(block));
          }
          div.appendChild(contentEl);
          return div;
        }

        function appendMessage(role, blocks, status) {
          const el = createMessageEl(role, blocks, status);
          messagesEl.appendChild(el);
          scrollToBottom();
          return el;
        }

        function updatePendingMessage(blocks, role) {
          if (!pendingEl) return;
          const contentEl = pendingEl.querySelector(".content");
          contentEl.innerHTML = "";
          for (const block of blocks) {
            contentEl.appendChild(renderBlock(block));
          }
          const labelEl = pendingEl.querySelector(".role");
          labelEl.textContent = (role === "user" ? "You" : "Assistant") + " (streaming…)";
          scrollToBottom();
        }

        function finalizePendingMessage(role, blocks, status) {
          if (pendingEl) {
            pendingEl.remove();
            pendingEl = null;
          }
          appendMessage(role, blocks, status);
        }

        // ─── Session list with project grouping ─────────────────────────────────

        let ctxMenuTarget = null; // session info for right-click target
        let projCtxMenuTarget = null; // project info for right-click target
        window._cachedSessions = []; // shared session list for project switcher

        function sessionDisplayName(s) {
          return s.name || s.firstMessage?.slice(0, 28).trim() || s.id.slice(0, 8) + '…';
        }

        // ── Codex-style helpers ──────────────────────────────────────────────
        function formatRelativeTime(dateStr) {
          if (!dateStr) return '';
          const d = new Date(dateStr);
          const now = new Date();
          const diffMs = now - d;
          const diffMins = Math.floor(diffMs / 60000);
          const diffHours = Math.floor(diffMs / 3600000);
          const diffDays = Math.floor(diffMs / 86400000);
          if (diffMins < 1) return '刚刚';
          if (diffMins < 60) return `${diffMins}m`;
          if (diffHours < 24) return `${diffHours}h`;
          if (diffDays < 7) return `${diffDays}d`;
          return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
        }

        function shortenPath(path) {
          if (!path) return '';
          // Try to get home from agent (Node.js side) via global exposed by preload
          const home = window.__codeagent_home || '';
          if (home && path.startsWith(home)) {
            return '~' + path.slice(home.length).replace(/\\/g, '/');
          }
          // Fallback: try HOME env var from window location
          if (path.includes('/home/')) {
            const idx = path.indexOf('/home/');
            return '~' + path.slice(idx + 5);
          }
          return path;
        }

        /**
         * Re-render all session item DOM elements in-place (called after
         * density/selection/expanded state changes — no full reload).
         */
        function renderAllSessionItems() {
          const items = sessionListEl.querySelectorAll('.session-item');
          items.forEach(item => {
            const sid = item.dataset.sessionId;
            const isActive = sid === currentSessionId;
            item.className = `session-item${isActive ? ' active' : ''}`;
          });
        }

        function makeSessionItem(s, index) {
          const item = document.createElement('div');
          const isActive = s.id === currentSessionId;
          item.className = `session-item${isActive ? ' active' : ''}`;
          item.dataset.sessionId = s.id;
          item.dataset.sessionPath = s.path;
          item.dataset.sessionCwd = s.cwd || '';
          item.dataset.index = String(index);

          const nameEl = document.createElement('span');
          nameEl.className = 'si-name';
          nameEl.textContent = sessionDisplayName(s);
          nameEl.title = (s.firstMessage || s.id) + (s.cwd ? '\n' + s.cwd : '');
          item.appendChild(nameEl);

          // Hover delete button
          const actions = document.createElement('div');
          actions.className = 'si-actions';
          const delBtn = document.createElement('button');
          delBtn.textContent = '✕';
          delBtn.title = '删除';
          delBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (confirm('删除会话: ' + sessionDisplayName(s) + '?')) {
              window.agent.deleteSession(s.path).then(async () => {
                if (s.id === currentSessionId) {
                  currentSessionId = null;
                  messagesEl.innerHTML = '';
                  updateWelcomeState(false);
                }
                await loadProjects();
              });
            }
          });
          actions.appendChild(delBtn);
          item.appendChild(actions);

          // Click: activate session → show chat on right
          item.addEventListener('click', async (e) => {
            if (s.id === currentSessionId) return;
            e.stopPropagation();
            await window.agent.switchSession(s.path, s.cwd || '');
            currentSessionId = s.id;
            currentProjectPath = s.cwd || null;
            messagesEl.innerHTML = '';
            pendingEl = null;
            expandedSessionId = null;
            await loadProjects();
            await loadMessages();
            await updateContextBar();
            await updateThinkingLevelDisplay();
            updateBreadcrumb();
          });

          item.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            ctxMenuTarget = s;
            showCtxMenu(e.clientX, e.clientY);
          });

          return item;
        }

        function showCtxMenu(x, y, menuId = 'ctx-menu') {
          const menu = document.getElementById(menuId);
          if (!menu) return;
          menu.style.display = 'block';
          const rect = menu.getBoundingClientRect();
          const maxX = window.innerWidth - rect.width - 8;
          const maxY = window.innerHeight - rect.height - 8;
          menu.style.left = Math.min(x, maxX) + 'px';
          menu.style.top = Math.min(y, maxY) + 'px';
        }

        function hideCtxMenu() {
          const menu = document.getElementById('ctx-menu');
          if (menu) menu.style.display = 'none';
          const projMenu = document.getElementById('proj-ctx-menu');
          if (projMenu) projMenu.style.display = 'none';
          ctxMenuTarget = null;
          projCtxMenuTarget = null;
        }

        function showRenameInput(s) {
          hideCtxMenu();
          const item = document.querySelector(`[data-session-id="${s.id}"]`);
          if (!item) return;
          const existing = item.querySelector('.rename-input');
          if (existing) { existing.focus(); return; }

          const input = document.createElement('input');
          input.type = 'text';
          input.className = 'rename-input';
          input.value = s.name || s.firstMessage?.slice(0, 28).trim() || '';
          input.style.cssText = 'width:100%;background:#1e1e1e;border:1px solid #4fc3f7;border-radius:3px;color:#d4d4d4;font-size:13px;padding:2px 6px;outline:none;';

          input.addEventListener('keydown', async (e) => {
            if (e.key === 'Enter') {
              e.stopPropagation();
              const newName = input.value.trim();
              if (newName) {
                await window.agent.renameSession(s.path, newName);
              }
              await loadSessions();
            }
            if (e.key === 'Escape') {
              await loadSessions();
            }
          });

          input.addEventListener('blur', async () => {
            const newName = input.value.trim();
            if (newName) {
              await window.agent.renameSession(s.path, newName);
            }
            await loadSessions();
          });

          item.innerHTML = '';
          item.appendChild(input);
          input.focus();
          input.select();
        }

        // ─── Project Selector ─────────────────────────────────────────────────────

        /**
         * Activate a project for chatting — show input page, session created on first prompt.
         */
        async function activateProjectForChat(projectPath) {
          await window.agent.activateProject(projectPath);
          currentProjectPath = projectPath;
          currentSessionId = null;
          messagesEl.innerHTML = '';
          pendingEl = null;
          updateWelcomeState(false);
          await loadProjects();
          await updateContextBar();
          updateBreadcrumb();
        }

        /**
         * Render a single project group element.
         */
        function makeProjectGroup(project, sessions, isCurrent, isCollapsed, sessionIdxRef) {
          const groupEl = document.createElement('div');
          groupEl.className = 'session-group proj-group' + (isCurrent ? ' current' : '') + (isCollapsed ? ' collapsed' : '');
          groupEl.dataset.projectPath = project.path;
          groupEl.dataset.projectName = project.name;

          // Project header
          const headerEl = document.createElement('div');
          headerEl.className = 'session-group-header';

          // Project name
          const nameEl = document.createElement('span');
          nameEl.className = 'project-name';
          nameEl.textContent = project.name;
          nameEl.title = project.path;
          headerEl.appendChild(nameEl);

          // Session count badge
          if (sessions.length > 0) {
            const badge = document.createElement('span');
            badge.className = 'session-count-badge';
            badge.textContent = sessions.length;
            badge.style.cssText = 'margin-left:auto;padding:2px 8px;background:rgba(255,255,255,0.08);border-radius:10px;font-size:11px;color:var(--text-dim);';
            headerEl.appendChild(badge);
          }

          // Click header → activate project + expand + collapse others
          headerEl.addEventListener('click', (e) => {
            e.stopPropagation();
            // Activate project
            activateProjectForChat(project.path);
            // Expand this project
            groupEl.classList.remove('collapsed');
            localStorage.setItem('proj:collapsed:' + project.path, '0');
            // Collapse all other projects
            document.querySelectorAll('.proj-group').forEach(el => {
              if (el !== groupEl && el.dataset.projectPath) {
                el.classList.add('collapsed');
                localStorage.setItem('proj:collapsed:' + el.dataset.projectPath, '1');
              }
            });
          });

          // Context menu
          headerEl.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            projCtxMenuTarget = project;
            showCtxMenu(e.clientX, e.clientY, 'proj-ctx-menu');
          });

          groupEl.appendChild(headerEl);

          // Session list
          const listEl = document.createElement('div');
          listEl.className = 'session-group-items';

          if (sessions.length > 0) {
            for (const s of sessions) {
              listEl.appendChild(makeSessionItem(s, sessionIdxRef.val++));
            }
          } else {
            // Empty state: hint that typing in the input box will auto-create a session
            const emptyState = document.createElement('div');
            emptyState.className = 'session-empty-state';
            emptyState.innerHTML = `<span>在输入框中提问即可开始</span>`;
            listEl.appendChild(emptyState);
          }

          groupEl.appendChild(listEl);
          return groupEl;
        }

        /**
         * Render the sidebar: load projects + sessions, group by project.
         * Projects without sessions still show (for "start chatting" state).
         */
        async function loadProjects() {
          const projects = await window.agent.listProjects();
          const sessions = await window.agent.listSessions();
          const currentCwd = await window.agent.getCurrentCwd();
          window._cachedSessions = sessions;

          if (!sessionListEl) {
            console.error('[loadProjects] sessionListEl is null!');
            return;
          }

          // Group sessions by cwd
          const byCwd = new Map();
          for (const s of sessions) {
            const cwd = s.cwd || '';
            if (!byCwd.has(cwd)) byCwd.set(cwd, []);
            byCwd.get(cwd).push(s);
          }
          // Sort sessions within each group: modified desc
          for (const items of byCwd.values()) {
            items.sort((a, b) => new Date(b.modified).getTime() - new Date(a.modified).getTime());
          }

          // Split out global sessions (cwd = '')
          const globalSessions = byCwd.get('') || [];
          // Remove global sessions from byCwd for project rendering
          byCwd.delete('');

          sessionListEl.innerHTML = '';

          // Global session index (used for keyboard nav)
          let _sessionIdx = 0;

          // ── Global sessions group (shown when there are any) ──────────────────
          if (globalSessions.length > 0) {
            const isGlobalCurrent = currentCwd === '';
            const globalGroup = document.createElement('div');
            globalGroup.className = 'session-group' + (isGlobalCurrent ? ' current' : '');

            const globalHeader = document.createElement('div');
            globalHeader.className = 'session-group-header';
            globalHeader.textContent = 'Global';
            globalGroup.appendChild(globalHeader);

            const globalList = document.createElement('div');
            globalList.className = 'session-group-items';
            for (const s of globalSessions) {
              globalList.appendChild(makeSessionItem(s, _sessionIdx++));
            }
            globalGroup.appendChild(globalList);
            sessionListEl.appendChild(globalGroup);
          }

          // ── Projects ──────────────────────────────────────────────────────
          const sortedProjects = [...projects].sort((a, b) => a.name.localeCompare(b.name));

          const sessionIdxRef = { val: _sessionIdx }; // pass by ref

          for (const project of sortedProjects) {
            const isCurrent = project.path === currentCwd;
            const projectSessions = byCwd.get(project.path) || [];
            // Active project: always expanded. Other projects: always collapsed on init
            const isCollapsed = !isCurrent;

            const groupEl = makeProjectGroup(project, projectSessions, isCurrent, isCollapsed, sessionIdxRef);
            sessionListEl.appendChild(groupEl);
          }

          // Show unregistered sessions (projects not in projects.json — old sessions)
          const registeredPaths = new Set(projects.map(p => p.path));
          const unregisteredSessions = sessions.filter(s => !registeredPaths.has(s.cwd));
          if (unregisteredSessions.length > 0) {
            const groupEl = document.createElement('div');
            groupEl.className = 'session-group';

            const headerEl = document.createElement('div');
            headerEl.className = 'session-group-header';
            headerEl.textContent = '(未注册项目)';
            groupEl.appendChild(headerEl);

            const listEl = document.createElement('div');
            listEl.className = 'session-group-items';
            for (const s of unregisteredSessions) {
              listEl.appendChild(makeSessionItem(s, _sessionIdx++));
            }
            groupEl.appendChild(listEl);
            sessionListEl.appendChild(groupEl);
          }

        }

        // Legacy alias for backward compat
        const loadSessions = loadProjects;

        // ─── Context menu click handlers ─────────────────────────────────────────
        document.getElementById('ctx-rename')?.addEventListener('click', () => {
          if (ctxMenuTarget) showRenameInput(ctxMenuTarget);
        });

        // ─── Project context menu handlers ───────────────────────────────────────
        function showProjRenameInput(project) {
          hideCtxMenu();
          const groupEl = document.querySelector(`[data-project-path="${CSS.escape(project.path)}"]`);
          if (!groupEl) return;
          const headerEl = groupEl.querySelector('.session-group-header');
          if (!headerEl) return;
          const existing = headerEl.querySelector('.rename-input');
          if (existing) { existing.focus(); return; }

          const input = document.createElement('input');
          input.type = 'text';
          input.className = 'rename-input';
          input.value = project.name;
          input.style.cssText = 'width:120px;background:#1e1e1e;border:1px solid #4fc3f7;border-radius:3px;color:#d4d4d4;font-size:12px;padding:2px 4px;outline:none;';

          input.addEventListener('keydown', async (e) => {
            if (e.key === 'Enter') {
              e.stopPropagation();
              const newName = input.value.trim();
              if (newName && newName !== project.name) {
                await window.agent.renameProject(project.path, newName);
              }
              await loadProjects();
            }
            if (e.key === 'Escape') {
              await loadProjects();
            }
          });

          input.addEventListener('blur', async () => {
            const newName = input.value.trim();
            if (newName && newName !== project.name) {
              await window.agent.renameProject(project.path, newName);
            }
            await loadProjects();
          });

          headerEl.innerHTML = '';
          headerEl.appendChild(input);
          input.focus();
          input.select();
        }

        document.getElementById('proj-ctx-rename')?.addEventListener('click', () => {
          if (projCtxMenuTarget) showProjRenameInput(projCtxMenuTarget);
        });

        document.getElementById('proj-ctx-delete')?.addEventListener('click', async () => {
          if (!projCtxMenuTarget) return;
          const proj = projCtxMenuTarget;
          hideCtxMenu();
          if (!confirm(`确定删除项目 "${proj.name}"？\n会话不会被删除，但项目将从侧边栏移除。`)) return;
          await window.agent.deleteProject(proj.path);
          // If deleted project was current, switch to global mode
          if (currentProjectPath === proj.path) {
            currentProjectPath = null;
            const result = await window.agent.newGlobalSession();
            if (result.success && result.sessionPath) {
              await window.agent.switchSession(result.sessionPath, '');
              currentSessionId = result.sessionId || null;
            }
          }
          await loadProjects();
        });

        document.getElementById('ctx-copy-id')?.addEventListener('click', async () => {
          if (ctxMenuTarget) {
            await navigator.clipboard.writeText(ctxMenuTarget.id);
          }
          hideCtxMenu();
        });

        document.getElementById('ctx-export-html')?.addEventListener('click', async () => {
          if (ctxMenuTarget) {
            const result = await window.agent.exportSession(ctxMenuTarget.path, 'html');
            if (result.success) {
              showStatus('已导出: ' + result.path, 'success');
            } else {
              showStatus('导出失败: ' + result.error, 'error');
            }
          }
          hideCtxMenu();
        });

        document.getElementById('ctx-export-jsonl')?.addEventListener('click', async () => {
          if (ctxMenuTarget) {
            const result = await window.agent.exportSession(ctxMenuTarget.path, 'jsonl');
            if (result.success) {
              showStatus('已导出: ' + result.path, 'success');
            } else {
              showStatus('导出失败: ' + result.error, 'error');
            }
          }
          hideCtxMenu();
        });

        document.getElementById('ctx-delete')?.addEventListener('click', async () => {
          if (!ctxMenuTarget) return;
          if (!confirm('确定删除会话？\n' + sessionDisplayName(ctxMenuTarget))) return;
          const isCurrent = ctxMenuTarget.id === currentSessionId;
          const result = await window.agent.deleteSession(ctxMenuTarget.path);
          if (result.success) {
            if (isCurrent) {
              const cwd = currentProjectPath || '';
              const newResult = cwd
                ? await window.agent.newSessionForProject(cwd)
                : await window.agent.newGlobalSession();
              if (newResult.success && newResult.sessionPath) {
                await window.agent.switchSession(newResult.sessionPath, cwd);
                currentSessionId = newResult.sessionId || null;
              }
            }
            await loadSessions();
          } else {
            showStatus('删除失败: ' + result.error, 'error');
          }
          hideCtxMenu();
        });

        // Dismiss context menu on outside click
        document.addEventListener('click', (e) => {
          const menu = document.getElementById('ctx-menu');
          if (menu && menu.style.display !== 'none' && !menu.contains(e.target)) {
            hideCtxMenu();
          }
        });

        // Dismiss context menu on Escape
        document.addEventListener('keydown', (e) => {
          if (e.key === 'Escape') hideCtxMenu();
        });

        async function loadMessages() {
          const msgs = await window.agent.getMessages();
          console.debug("[loadMessages] count:", msgs.length);
          messagesEl.innerHTML = "";

          let lastAssistantBlocks = null; // track previous assistant's blocks for tool merging

          for (const msg of msgs) {
            const entryType = msg.type || "message";
            const inner = msg.message || msg;
            const role = entryType === "message" ? inner.role : entryType;

            // ToolResult: merge into previous assistant's reasoning block instead of showing separately
            if (role === "toolResult" && lastAssistantBlocks) {
              const reasoning = lastAssistantBlocks.find(b => b.kind === "reasoning");
              if (reasoning) {
                // Find matching toolCall step and attach result
                const content = Array.isArray(inner.content) ? inner.content : [];
                const resultText = content.map(c => c.text || "").join("");
                const toolName = inner.toolName || "tool";
                // Update the matching toolCall step in reasoning
                const step = reasoning.steps.find(s => s.type === "toolCall" && s.name === toolName);
                if (step) {
                  step.result = { text: resultText.slice(0, 5000), isError: inner.isError };
                }
                reasoning.steps.push({ type: "toolResult", name: toolName, isError: inner.isError });
                reasoning.summary = buildReasoningSummary(reasoning);
              }
              continue; // skip separate display
            }

            const blocks = extractBlocks(msg);
            appendMessage(role, blocks, "completed");

            // Track last assistant for tool merging
            if (role === "assistant") {
              lastAssistantBlocks = blocks;
            } else if (role === "user") {
              lastAssistantBlocks = null; // reset between turns
            }
          }
          updateWelcomeState(msgs.length > 0);
        }

        // Extract renderable blocks from a session entry
        function extractBlocks(entry) {
          const msg = entry.message || entry;
          const entryType = entry.type || "message";
          const role = entryType === "message" ? msg.role : entryType;
          const raw = msg.blocks || msg.content;
          const blocks = [];

          // UserMessage — content is a simple string
          if (role === "user") {
            const text = typeof raw === "string" ? raw : (Array.isArray(raw) ? raw.map(c => c.text || String(c)).join("") : String(raw || ""));
            blocks.push({ kind: "text", text });
            return blocks;
          }

          // ToolResult — still extract in case it's needed standalone
          // (but loadMessages now merges them into previous assistant)
          if (role === "toolResult") {
            const content = Array.isArray(raw) ? raw : (typeof raw === "string" ? [{ type: "text", text: raw }] : []);
            const textContent = content.map(c => c.text || "").join("");
            blocks.push({
              kind: "toolResult",
              name: msg.toolName || "tool",
              text: (msg.isError ? "✗ " : "✓ ") + (msg.toolName || "tool"),
              fullText: textContent.slice(0, 5000),
              isError: msg.isError
            });
            return blocks;
          }

          // BashExecutionMessage
          if (role === "bashExecution") {
            const output = (msg.output || "").slice(0, 5000);
            blocks.push({
              kind: "toolResult",
              name: "bash: " + (msg.command || "").slice(0, 50),
              text: (msg.exitCode === 0 ? "✓ " : "✗ ") + "bash: " + (msg.command || "").slice(0, 50),
              fullText: output,
              isError: msg.exitCode !== 0
            });
            return blocks;
          }

          // Compaction entry — divider
          if (entryType === "compaction") {
            blocks.push({ kind: "text", text: "─── Context compacted ───" });
            if (entry.summary) blocks.push({ kind: "text", text: entry.summary });
            return blocks;
          }

          // Branch summary
          if (role === "branchSummary") {
            blocks.push({ kind: "text", text: "─── Branch ───" });
            if (msg.summary) blocks.push({ kind: "text", text: msg.summary });
            return blocks;
          }

          // Custom message
          if (role === "custom" || entryType === "custom_message") {
            blocks.push({ kind: "text", text: "[Custom: " + (msg.customType || entry.customType || "unknown") + "]" });
            return blocks;
          }

          // Model change / thinking level change — skip silently
          if (entryType === "model_change" || entryType === "thinking_level_change") {
            return blocks;
          }

          // Assistant message — content is an array of blocks
          const items = Array.isArray(raw) ? raw : (typeof raw === "string" ? [{ type: "text", text: raw }] : []);
          const reasoningSteps = [];
          for (const item of items) {
            if (!item) continue;
            if (item.type === "text") {
              blocks.push({ kind: "text", text: item.text || "" });
            } else if (item.type === "thinking") {
              reasoningSteps.push({ type: "thinking", text: item.thinking || item.text || "" });
            } else if (item.type === "toolCall") {
              reasoningSteps.push({
                type: "toolCall",
                name: item.name,
                command: truncateArgs(item.arguments || item.args)
              });
            } else if (item.type === "image") {
              blocks.push({ kind: "image", url: item.data || item.url });
            }
          }
          if (reasoningSteps.length > 0) {
            const toolNames = [...new Set(reasoningSteps.filter(s => s.type === "toolCall").map(s => s.name))];
            blocks.push({
              kind: "reasoning",
              steps: reasoningSteps,
              summary: toolNames.length > 0 ? "▶ Reasoning → " + toolNames.join(", ") : "▶ Reasoning"
            });
          }
          return blocks;
        }

        function formatToolCall(item) {
          const args = item.arguments;
          const argsStr = typeof args === "string" ? args : JSON.stringify(args, null, 2);
          return `Tool: ${item.name}\n${argsStr}`;
        }

        // ─── Streaming event handler ─────────────────────────────────────────────

        let currentBlocks = [];
        let currentRole = "assistant";

        // Helper: find or create the current reasoning block
        function ensureReasoning() {
          let block = currentBlocks.filter(b => b.kind === "reasoning").pop();
          if (!block) {
            block = { kind: "reasoning", steps: [] };
            currentBlocks.push(block);
          }
          return block;
        }

        function buildReasoningSummary(r) {
          const toolNames = [...new Set(r.steps.filter(s => s.type === "toolResult").map(s => s.name))];
          if (toolNames.length === 0) return "▶ Reasoning";
          return "▶ Reasoning → " + toolNames.join(", ");
        }

        function handleAgentEvent(event) {
          switch (event.type) {
            case "agent_start": {
              currentBlocks = [];
              currentRole = "assistant";
              isStreaming = true;
              pendingEl = appendMessage("assistant", [], "streaming");
              setStatus("Thinking…");
              showAbortButton(true);
              break;
            }
            case "message_update": {
              const aevt = event.assistantMessageEvent;
              if (aevt.type === "text_delta") {
                const lastText = currentBlocks.filter((b) => b.kind === "text").pop();
                if (lastText) {
                  lastText.text += aevt.delta;
                } else {
                  currentBlocks.push({ kind: "text", text: aevt.delta });
                }
              } else {
                // thinking_delta / toolcall_delta / tool_summary → all go to reasoning
                const r = ensureReasoning();
                if (aevt.type === "thinking_delta") {
                  const last = r.steps[r.steps.length - 1];
                  if (last && last.type === "thinking") {
                    last.text += aevt.delta;
                  } else {
                    r.steps.push({ type: "thinking", text: aevt.delta });
                  }
                } else if (aevt.type === "toolcall_delta") {
                  const name = aevt.partial?.name || "…";
                  r.steps.push({ type: "toolCall", name, command: aevt.delta || "" });
                } else if (aevt.type === "tool_summary") {
                  const idx = r.steps.findIndex(s => s.type === "toolCall" && (s.name === aevt.toolName || s.name === "…"));
                  if (idx >= 0) r.steps[idx].command = truncateArgs(aevt.arguments || {});
                }
                r.summary = buildReasoningSummary(r);
              }
              updatePendingMessage(currentBlocks, currentRole);
              break;
            }
            case "agent_end": {
              finalizePendingMessage(currentRole, currentBlocks, "completed");
              isStreaming = false;
              currentBlocks = [];
              setStatus("Ready");
              showAbortButton(false);
              inputEl.disabled = false;
              updateContextBar();
              updateThinkingLevelDisplay();
              break;
            }
            case "auto_compaction_start": {
              setStatus("Auto-compacting...");
              if (compactBtn) {
                compactBtn.style.display = "block";
                compactBtn.textContent = "Auto-compacting...";
                compactBtn.disabled = true;
              }
              break;
            }
            case "auto_compaction_end": {
              setStatus("Ready");
              if (compactBtn) {
                compactBtn.disabled = false;
                compactBtn.textContent = "Compact";
                compactBtn.style.display = "none";
              }
              updateContextBar();
              if (event.aborted) {
                appendMessage("assistant", [{ kind: "text", text: "⚠ Auto-compaction aborted" }], "completed");
              } else if (event.result?.summary) {
                appendMessage("assistant", [{ kind: "text", text: "✓ Context auto-compacted: " + event.result.summary }], "completed");
              }
              break;
            }
            case "tool_execution_start": {
              const r = ensureReasoning();
              const idx = r.steps.findIndex(s => s.type === "toolCall" && (s.name === event.toolName || s.name === "…"));
              if (idx >= 0) {
                r.steps[idx].name = event.toolName;
                r.steps[idx].running = true;
              }
              updatePendingMessage(currentBlocks, currentRole);
              break;
            }
            case "tool_execution_update": {
              break;
            }
            case "tool_execution_end": {
              const r = ensureReasoning();
              const idx = r.steps.findIndex(s => s.type === "toolCall" && s.name === event.toolName);
              const resultContent = event.result?.content;
              const resultText = resultContent
                ? (Array.isArray(resultContent) ? resultContent.map(c => c.text || "").join("") : String(resultContent))
                : "";
              if (idx >= 0) {
                r.steps[idx].running = false;
                r.steps[idx].result = { text: resultText.slice(0, 5000), isError: event.isError };
              }
              r.steps.push({ type: "toolResult", name: event.toolName, isError: event.isError });
              r.summary = buildReasoningSummary(r);
              updatePendingMessage(currentBlocks, currentRole);
              break;
            }
            case "message_end": {
              if (event.message?.stopReason === "error") {
                appendMessage("error", [{ kind: "text", text: event.message.errorMessage || "Unknown error" }], "error");
              }
              break;
            }
            case "turn_end": {
              // Tool results are already captured inside the reasoning block; nothing extra needed
              break;
            }
            case "turn_start": {
              setStatus("Thinking…");
              break;
            }
            case "message_start": {
              if (event.message?.role === "assistant") {
                setStatus("Generating…");
              }
              break;
            }
            case "auto_retry_start": {
              setStatus(`Retrying (${event.attempt}/${event.maxAttempts})…`);
              appendMessage("assistant", [{ kind: "text", text: `🔄 Retrying (attempt ${event.attempt}/${event.maxAttempts}): ${event.errorMessage || "Unknown error"}` }], "completed");
              break;
            }
            case "auto_retry_end": {
              if (!event.success && event.finalError) {
                appendMessage("error", [{ kind: "text", text: "Retry failed: " + event.finalError }], "error");
              }
              break;
            }
          }
        }

        async function sendMessage() {
          const text = inputEl.value.trim();
          if (!text || isStreaming) return;
          inputEl.value = "";
          inputEl.disabled = true;

          // 输入即创建：如果没有 active session，自动创建
          if (!currentSessionId) {
            let result;
            if (currentProjectPath) {
              result = await window.agent.newSessionForProject(currentProjectPath);
            } else {
              result = await window.agent.newGlobalSession();
            }
            if (result.success && result.sessionPath) {
              const cwd = currentProjectPath || '';
              await window.agent.switchSession(result.sessionPath, cwd);
              currentSessionId = result.sessionId || null;
              if (currentProjectPath) currentProjectPath = currentProjectPath;
              await loadProjects();
              updateBreadcrumb();
            } else {
              appendMessage("error", [{ kind: "text", text: "创建会话失败: " + (result.error || '未知错误') }], "error");
              return;
            }
          }

          hideWelcomeCard();
          appendMessage("user", [{ kind: "text", text }], "completed");
          setStatus("Thinking…");
          const promptResult = await window.agent.prompt(text);
          if (!promptResult.success) {
            appendMessage("error", [{ kind: "text", text: promptResult.error || "Unknown error" }], "error");
            setStatus("Error");
          } else {
            setStatus("Ready");
            await loadSessions();
            await new Promise((r) => setTimeout(r, 300));
            await loadSessions();
          }
          await updateContextBar();
        }

        function setStatus(text) {
          statusText.textContent = text;
        }

        function setModelDisplay(modelId) {
          currentModelId = modelId;
          if (modelId) {
            statusModel.innerHTML = `<span style="color:var(--accent);font-weight:600;">${modelId}</span>`;
            statusModel.classList.remove("unconfigured");
            currentModelDisplay.textContent = modelId;
          } else {
            statusModel.innerHTML = `<span style="color:#f48771;">No model</span>`;
            statusModel.classList.add("unconfigured");
            currentModelDisplay.textContent = "Not configured";
          }
        }

        const LEVEL_LABELS = { none: "TH:O", minimal: "TH:Mi", low: "TH:L", medium: "TH:M", high: "TH:H", xhigh: "TH:XH" };

        async function updateThinkingLevelDisplay() {
          const el = document.getElementById("thinking-level");
          if (!el) return;
          try {
            const info = await window.agent.getThinkingLevel();
            if (!info || !info.supportsThinking) {
              el.textContent = "";
              el.className = "";
              el.title = "";
              return;
            }
            // TH indicator color based on level
            const levelColor = info.level === 'high' || info.level === 'xhigh' ? '#f48771' : info.level === 'medium' ? '#dcdcaa' : '#4ec9b0';
            el.innerHTML = `<span style="color:${levelColor}">TH:${info.level.charAt(0).toUpperCase()}</span>`;
            el.title = `思考深度: ${info.level} (点击切换)`;
          } catch {
            el.textContent = "";
          }
        }

        // ─── Project breadcrumb ────────────────────────────────────────────────

        async function onThinkingLevelClick() {
          const el = document.getElementById("thinking-level");
          if (!el || !el.classList.contains("supported")) return;
          const result = await window.agent.cycleThinkingLevel();
          if (result.success) {
            const info = await window.agent.getThinkingLevel();
            const levelColor = info.level === 'high' || info.level === 'xhigh' ? '#f48771' : info.level === 'medium' ? '#dcdcaa' : '#4ec9b0';
            el.innerHTML = `<span style="color:${levelColor}">TH:${info.level.charAt(0).toUpperCase()}</span>`;
            el.title = `思考深度: ${info.level} (点击切换)`;
          }
        }

        function showAbortButton(show) {
          abortBtn.classList.toggle("visible", show);
          if (show) {
            sendBtn.style.display = 'none';
          } else {
            sendBtn.style.display = 'flex';
          }
        }

        function showWelcomeCard() {
          const subtitle = document.getElementById("welcome-subtitle");
          if (subtitle) {
            subtitle.textContent = currentProjectPath
              ? 'Ask me anything about ' + getProjectName(currentProjectPath)
              : 'Ask me anything about your codebase.';
          }
          welcomeCard.classList.add("visible");
          messagesEl.style.display = "none";
        }

        function hideWelcomeCard() {
          welcomeCard.classList.remove("visible");
          messagesEl.style.display = "";
        }

        function updateWelcomeState(hasMessages) {
          if (hasMessages) hideWelcomeCard();
          else showWelcomeCard();
        }

        // ─── Project Breadcrumb ──────────────────────────────────────────────────
        function getProjectName(path) {
          if (!path) return 'Global';
          return path.split(/[\\/]/).pop() || path;
        }

        function getCurrentSessionName() {
          // Find current session from cached data
          const sessions = window._cachedSessions || [];
          const current = sessions.find(s => s.id === currentSessionId);
          if (current) return sessionDisplayName(current);
          return '';
        }

        function getSessionCountForProject(path) {
          const sessions = window._cachedSessions || [];
          return sessions.filter(s => (s.cwd || '') === (path || '')).length;
        }

        function updateBreadcrumb() {
          const bc = document.getElementById("project-breadcrumb");
          const label = document.getElementById("project-breadcrumb-label");
          if (!bc || !label) return;

          const projectName = getProjectName(currentProjectPath);
          const sessionName = getCurrentSessionName();

          if (currentSessionId && sessionName) {
            label.textContent = projectName + ' › ' + sessionName;
            bc.style.display = 'flex';
          } else {
            label.textContent = currentSessionId ? projectName : projectName;
            bc.style.display = currentSessionId ? 'flex' : 'none';
          }
        }

        function showProjectSwitcher() {
          hideAllPopups();
          const switcher = document.getElementById("project-switcher");
          if (!switcher) return;
          const sessions = window._cachedSessions || [];
          switcher.innerHTML = '';
          // Global option
          const globalItem = document.createElement("div");
          globalItem.className = "proj-switch-item" + (!currentProjectPath ? " active" : "");
          globalItem.innerHTML = `<span class="proj-switch-name">Global</span><span class="proj-switch-count">${getSessionCountForProject('')}</span>`;
          globalItem.addEventListener("click", (e) => { e.stopPropagation(); switchToProject(''); });
          switcher.appendChild(globalItem);
          // Project options
          const projects = document.querySelectorAll('.proj-group');
          projects.forEach(g => {
            const path = g.dataset.projectPath || '';
            const name = getProjectName(path);
            const count = getSessionCountForProject(path);
            const item = document.createElement("div");
            item.className = "proj-switch-item" + (path === currentProjectPath ? " active" : "");
            item.innerHTML = `<span class="proj-switch-name">${name}</span><span class="proj-switch-count">${count}</span>`;
            item.addEventListener("click", (e) => { e.stopPropagation(); switchToProject(path); });
            switcher.appendChild(item);
          });
          switcher.style.display = "block";
        }

        function hideProjectSwitcher() {
          const s = document.getElementById("project-switcher");
          if (s) s.style.display = "none";
        }

        async function switchToProject(path) {
          console.log('[TRACE] switchToProject ENTRY path=', path, 'currentProjectPath=', currentProjectPath);
          if (path === currentProjectPath) { console.log('[TRACE] same project, returning'); hideProjectSwitcher(); return; }
          console.log('[TRACE] past same-project check');
          if (isStreaming) {
            console.log('[TRACE] isStreaming=true, showing confirm');
            const confirmed = window.confirm('正在生成回答，切换项目将丢失当前输出。确定要切换吗？');
            console.log('[TRACE] confirm result=', confirmed);
            if (!confirmed) { hideProjectSwitcher(); return; }
            onAbortClick();
          }
          hideProjectSwitcher();
          console.log('[TRACE] past streaming check, proceeding');

          // Only activate the project — no session created here (lazy, on first prompt)
          await window.agent.activateProject(path);

          currentSessionId = null;
          currentProjectPath = path || null;
          messagesEl.innerHTML = '';
          pendingEl = null;
          updateWelcomeState(false);
          await loadProjects();
          await updateContextBar();
          updateBreadcrumb();
        }

        function hideAllPopups() {
          hideProjectSwitcher();
          closeStatsPopup();
          closeCtxMenu();
          closeProjCtxMenu();
        }

        // ─── Stats Popup ───────────────────────────────────────────────────────────

        function formatCost(n) {
          if (n >= 1) return "$" + n.toFixed(4);
          return "$" + (n * 1000).toFixed(2) + "m";
        }

        async function showStatsPopup() {
          if (!statsOverlay) return;
          statsOverlay.style.display = "flex";

          const stats = await window.agent.getSessionStats();
          const usage = await window.agent.getContextUsage();
          const thinking = await window.agent.getThinkingLevel();

          let html = '<table style="width:100%;border-collapse:collapse;">';

          // Context
          if (usage && usage.contextWindow > 0) {
            const ratio = (usage.tokens ?? 0) / usage.contextWindow;
            const pct = usage.percent ?? (ratio * 100);
            const ctxColor = ratio >= 0.95 ? "#f48771" : ratio >= 0.8 ? "#dcdcaa" : "#4ec9b0";
            html += `<tr><td style="padding:4px 0;color:var(--text-dim);">Context</td><td style="padding:4px 0;text-align:right;color:${ctxColor}">${formatTokens(usage.tokens ?? 0)} / ${formatTokens(usage.contextWindow)} (${pct.toFixed(1)}%)</td></tr>`;
          }

          // Thinking
          if (thinking.supportsThinking) {
            const levelLabel = { none: "None", low: "Low", medium: "Medium", high: "High", xhigh: "Extra High" };
            html += `<tr><td style="padding:4px 0;color:var(--text-dim);">Thinking</td><td style="padding:4px 0;text-align:right;">${levelLabel[thinking.level] || thinking.level}</td></tr>`;
          }

          // Stats
          if (stats) {
            html += `<tr><td colspan="2" style="padding:8px 0 4px 0;border-top:1px solid var(--border);font-weight:600;">Messages</td></tr>`;
            html += `<tr><td style="padding:4px 0;color:var(--text-dim);padding-left:8px;">User</td><td style="padding:4px 0;text-align:right;">${stats.userMessages}</td></tr>`;
            html += `<tr><td style="padding:4px 0;color:var(--text-dim);padding-left:8px;">Assistant</td><td style="padding:4px 0;text-align:right;">${stats.assistantMessages}</td></tr>`;
            html += `<tr><td style="padding:4px 0;color:var(--text-dim);padding-left:8px;">Tool Calls</td><td style="padding:4px 0;text-align:right;">${stats.toolCalls}</td></tr>`;

            html += `<tr><td colspan="2" style="padding:8px 0 4px 0;border-top:1px solid var(--border);font-weight:600;">Tokens</td></tr>`;
            html += `<tr><td style="padding:4px 0;color:var(--text-dim);padding-left:8px;">Input</td><td style="padding:4px 0;text-align:right;">${formatTokens(stats.tokens.input)}</td></tr>`;
            html += `<tr><td style="padding:4px 0;color:var(--text-dim);padding-left:8px;">Output</td><td style="padding:4px 0;text-align:right;">${formatTokens(stats.tokens.output)}</td></tr>`;
            if (stats.tokens.cacheRead > 0 || stats.tokens.cacheWrite > 0) {
              html += `<tr><td style="padding:4px 0;color:var(--text-dim);padding-left:8px;">Cache Read</td><td style="padding:4px 0;text-align:right;">${formatTokens(stats.tokens.cacheRead)}</td></tr>`;
              html += `<tr><td style="padding:4px 0;color:var(--text-dim);padding-left:8px;">Cache Write</td><td style="padding:4px 0;text-align:right;">${formatTokens(stats.tokens.cacheWrite)}</td></tr>`;
            }
            html += `<tr><td style="padding:4px 0;color:var(--text-dim);padding-left:8px;">Total</td><td style="padding:4px 0;text-align:right;font-weight:600;">${formatTokens(stats.tokens.total)}</td></tr>`;

            if (stats.cost > 0) {
              html += `<tr><td colspan="2" style="padding:8px 0 4px 0;border-top:1px solid var(--border);font-weight:600;">Cost</td></tr>`;
              html += `<tr><td style="padding:4px 0;color:var(--text-dim);padding-left:8px;">Total</td><td style="padding:4px 0;text-align:right;font-weight:600;color:#4ec9b0;">${formatCost(stats.cost)}</td></tr>`;
            }
          } else {
            html += '<tr><td style="padding:8px 0;color:var(--text-dim);">No session stats available</td></tr>';
          }

          html += '</table>';
          statsBody.innerHTML = html;
        }

        function closeStatsPopup() {
          if (statsOverlay) statsOverlay.style.display = "none";
        }

        function formatTokens(n) {
          if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
          if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
          return String(n);
        }

        async function updateContextBar() {
          const ctxBar = document.getElementById('ctx-bar');
          const ctxText = document.getElementById('ctx-text');
          if (!ctxBar || !ctxText) return;
          try {
            const usage = await window.agent.getContextUsage();
            if (!usage || usage.contextWindow === 0) {
              ctxBar.textContent = '';
              ctxText.textContent = '';
              return;
            }
            const tokens = usage.tokens ?? 0;
            const limit = usage.contextWindow;
            const ratio = tokens / limit;
            const percent = usage.percent ?? ratio * 100;

            // Bar: 8 chars, █ for filled, ░ for empty
            const BAR_WIDTH = 8;
            const filled = Math.round(ratio * BAR_WIDTH);
            const bar = '▓'.repeat(filled) + '░'.repeat(BAR_WIDTH - filled);

            // Color based on usage
            const color = ratio >= 0.95 ? 'danger' : ratio >= 0.8 ? 'warning' : 'neutral';
            statusCtx.className = color;

            // Update bar with color
            const barColor = ratio >= 0.95 ? '#f48771' : ratio >= 0.8 ? '#dcdcaa' : '#4ec9b0';
            ctxBar.innerHTML = `<span style="color:${barColor}">${bar}</span>`;

            // Update text: simplified numbers
            ctxText.innerHTML = `<span style="color:${barColor}">${formatTokens(tokens)}/${formatTokens(limit)}</span> <span style="color:var(--text-dim)">${percent.toFixed(1)}%</span>`;

            const isCompacting = await window.agent.isCompacting();
            if (isCompacting) {
              compactBtn.style.display = "block";
              compactBtn.textContent = "Compacting...";
              compactBtn.disabled = true;
            } else if (ratio >= 0.8) {
              compactBtn.style.display = "block";
              compactBtn.textContent = "Compact";
              compactBtn.disabled = false;
            } else {
              compactBtn.style.display = "none";
            }
          } catch (e) {
            ctxBar.textContent = '';
            ctxText.textContent = '';
          }
        }

        async function onCompactClick() {
          if (!compactBtn || compactBtn.disabled) return;
          compactBtn.disabled = true;
          compactBtn.textContent = "Compacting...";
          setStatus("Compacting...");
          try {
            const result = await window.agent.compact();
            if (!result.success) {
              appendMessage("error", [{ kind: "text", text: "Compact failed: " + (result.error || "unknown") }], "error");
            } else {
              appendMessage("assistant", [{ kind: "text", text: "✓ Context compacted: " + (result.summary || "done") }], "completed");
            }
          } catch (e) {
            appendMessage("error", [{ kind: "text", text: "Compact error: " + e.message }], "error");
          }
          compactBtn.disabled = false;
          compactBtn.textContent = "Compact";
          setStatus("Ready");
          await updateContextBar();
        }

        async function openSettings() {
          // Hide project-view and main, show settings page
          projectView.style.display = 'none';
          document.getElementById('main').style.display = 'none';
          document.getElementById('settings-page').style.display = 'flex';

          // Load providers
          const providers = await window.agent.getProviders();
          const cfg = await window.agent.getConfig();
          const providerList = document.getElementById('provider-list');
          providerList.innerHTML = '';

          for (const provider of providers) {
            const card = document.createElement('div');
            card.className = 'provider-card';
            card.dataset.provider = provider.id;

            card.innerHTML = `
              <div class="provider-card-name">${provider.id.toUpperCase()}</div>
              <div class="provider-card-status ${provider.hasApiKey ? 'configured' : 'unconfigured'}">
                ${provider.hasApiKey ? '✓ 已配置' : '未配置'}
              </div>
            `;

            card.addEventListener('click', () => {
              openProviderConfig(provider.id, provider.hasApiKey);
            });

            providerList.appendChild(card);
          }
        }

        async function openProviderConfig(providerId, hasApiKey) {
          const providerList = document.getElementById('provider-list');
          const status = document.getElementById('settings-status');
          status.textContent = '';

          if (!hasApiKey) {
            // Show API key input with back button
            providerList.innerHTML = `
              <div class="provider-card">
                <div class="provider-card-name">配置 ${providerId.toUpperCase()}</div>
                <button id="back-btn" style="position: absolute; top: 24px; right: 24px; background: none; border: none; color: var(--text-dim); cursor: pointer; font-size: 14px;">← 返回</button>
                <div style="margin-top: 12px;">
                  <input type="password" id="api-key-input" placeholder="输入 API Key..."
                    style="width: 100%; padding: 10px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; color: #e4e4e4; font-size: 14px; outline: none; box-sizing: border-box;">
                  <button id="save-api-key-btn" class="btn btn-primary" style="width: 100%; margin-top: 12px;">保存</button>
                </div>
              </div>
            `;

            document.getElementById('back-btn').addEventListener('click', openSettings);
            document.getElementById('save-api-key-btn').addEventListener('click', async () => {
              const apiKey = document.getElementById('api-key-input').value.trim();
              if (!apiKey) return;
              const result = await window.agent.saveApiKey(providerId, apiKey);
              if (result.success) {
                openSettings();
              } else {
                status.textContent = '保存失败';
                status.style.color = '#f48771';
              }
            });
          }
        }

        function closeSettings() {
          document.getElementById('settings-page').style.display = 'none';
          projectView.style.display = 'flex';
          document.getElementById('main').style.display = 'flex';
        }

        async function onProviderChange(providerId) {
          if (!providerId) {
            apiKeySection.style.display = "none";
            modelSection.style.display = "none";
            return;
          }
          selectedProvider = providerId;
          const providers = await window.agent.getProviders();
          const providerInfo = providers.find((p) => p.id === providerId);
          if (!providerInfo || providerInfo.hasApiKey) {
            settingsStep = "model";
            apiKeySection.style.display = "none";
            await loadModelsForProvider(providerId);
          } else {
            settingsStep = "apikey";
            apiKeySection.style.display = "block";
            modelSection.style.display = "none";
            apiKeyInput.value = "";
            apiKeyInput.focus();
          }
        }

        async function loadModelsForProvider(providerId) {
          modelSection.style.display = "block";
          const models = await window.agent.getModels(providerId);
          modelSelect.innerHTML = '<option value="">-- Select --</option>';
          for (const m of models) {
            const opt = document.createElement("option");
            opt.value = JSON.stringify(m);
            opt.textContent = m.id;
            modelSelect.appendChild(opt);
          }
        }

        async function saveApiKey() {
          const apiKey = apiKeyInput.value.trim();
          if (!apiKey) {
            settingsStatus.textContent = "API key cannot be empty.";
            settingsStatus.className = "error";
            return;
          }
          const result = await window.agent.saveApiKey(selectedProvider, apiKey);
          if (!result.success) {
            settingsStatus.textContent = "Failed to save API key.";
            settingsStatus.className = "error";
            return;
          }
          settingsStatus.textContent = "API key saved ✓";
          settingsStatus.className = "success";
          settingsStep = "model";
          apiKeySection.style.display = "none";
          await loadModelsForProvider(selectedProvider);
        }

        async function onModelChange(modelJson) {
          if (!modelJson) return;
          const model = JSON.parse(modelJson);
          settingsStatus.textContent = "Setting model…";
          settingsStatus.className = "";
          const result = await window.agent.setModel(model);
          if (!result.success) {
            settingsStatus.textContent = "Failed to set model: " + (result.error || "");
            settingsStatus.className = "error";
            return;
          }
          settingsStatus.textContent = "Model set: " + model.id + " ✓";
          settingsStatus.className = "success";
          setModelDisplay(model.id);
          setTimeout(closeSettings, 1200);
        }

        async function onAbortClick() {
          await window.agent.abort();
        }

        // ─── Event listeners ─────────────────────────────────────────────────────

        inputEl.addEventListener("keydown", (e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
          }
        });

        sendBtn.addEventListener("click", sendMessage);

        newProjectBtn?.addEventListener("click", async () => {
          const dirResult = await window.agent.selectDirectory();
          if (!dirResult.success || !dirResult.path) return;
          const cwd = dirResult.path;
          await window.agent.activateProject(cwd);
          currentProjectPath = cwd;
          currentSessionId = null;
          messagesEl.innerHTML = '';
          pendingEl = null;
          updateWelcomeState(false);
          await loadProjects();
          updateBreadcrumb();
        });

        // Toggle sidebar via Activity Bar button
        abSidebarBtn?.addEventListener("click", () => {
          // Show project view (main-container)
          closeSettings();
          abSidebarBtn.classList.add("active");
          abSettingsBtn?.classList.remove("active");
        });

        abSettingsBtn?.addEventListener("click", () => {
          openSettings();
          abSettingsBtn.classList.add("active");
          abSidebarBtn?.classList.remove("active");
        });


        document.querySelectorAll(".tip-msg").forEach((el) => {
          el.addEventListener("click", () => {
            const text = el.textContent.replace(/^[""]|[""]$/g, "").trim();
            inputEl.value = text;
            inputEl.focus();
          });
        });

        statusModel.addEventListener("click", openSettings);
        settingsClose.addEventListener("click", closeSettings);
        settingsOverlay.addEventListener("click", (e) => {
          if (e.target === settingsOverlay) closeSettings();
        });
        providerSelect.addEventListener("change", (e) => onProviderChange(e.target.value));
        saveApiKeyBtn.addEventListener("click", saveApiKey);
        skipApiKeyBtn.addEventListener("click", async () => {
          if (!selectedProvider) return;
          await loadModelsForProvider(selectedProvider);
          settingsStep = "model";
        });
        modelSelect.addEventListener("change", (e) => onModelChange(e.target.value));
        abortBtn.addEventListener("click", onAbortClick);
        compactBtn.addEventListener("click", onCompactClick);
        statusCtx.addEventListener("click", showStatsPopup);
        statsClose.addEventListener("click", closeStatsPopup);
        statsOverlay.addEventListener("click", (e) => {
          if (e.target === statsOverlay) closeStatsPopup();
        });
        document.getElementById("project-breadcrumb")?.addEventListener("click", () => {
          const bc = document.getElementById("project-breadcrumb");
          const switcher = document.getElementById("project-switcher");
          if (switcher?.style.display === "block") {
            hideProjectSwitcher();
            bc?.classList.remove("open");
          } else {
            showProjectSwitcher();
            bc?.classList.add("open");
          }
        });
        // Close project switcher on outside click
        document.addEventListener("click", (e) => {
          const switcher = document.getElementById("project-switcher");
          const bc = document.getElementById("project-breadcrumb");
          if (switcher?.style.display === "block" && !switcher.contains(e.target) && !bc?.contains(e.target)) {
            hideProjectSwitcher();
            bc?.classList.remove("open");
          }
        });
        document.getElementById('thinking-level')?.addEventListener('click', onThinkingLevelClick);

        // ─── Keyboard navigation for session list ───────────────────────────────
        let kbSelectedIndex = -1;

        document.addEventListener('keydown', (e) => {
          if (settingsStep !== 'idle') return;
          const projectViewEl = document.getElementById('project-view');
          if (!projectViewEl || projectViewEl.style.display === 'none') return;

          const items = [...sessionListEl.querySelectorAll('.session-item')];
          const totalItems = items.length;
          if (totalItems === 0) return;

          if (e.key === 'ArrowDown') {
            e.preventDefault();
            kbSelectedIndex = Math.min(kbSelectedIndex + 1, totalItems - 1);
            updateKeyboardHighlight(items);
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            kbSelectedIndex = Math.max(kbSelectedIndex - 1, 0);
            updateKeyboardHighlight(items);
          } else if (e.key === 'Enter') {
            const selected = items[kbSelectedIndex];
            if (selected) selected.click();
          } else if (e.key === 'Escape') {
            kbSelectedIndex = -1;
            expandedSessionId = null;
            renderAllSessionItems();
          } else if (e.key === 'e' && e.ctrlKey) {
            e.preventDefault();
            const selected = items[kbSelectedIndex];
            if (selected) {
              const sid = selected.dataset.sessionId;
              expandedSessionId = (expandedSessionId === sid) ? null : sid;
              renderAllSessionItems();
            }
          }
        });

        function updateKeyboardHighlight(items) {
          items.forEach((item, i) => {
            item.classList.toggle('kb-selected', i === kbSelectedIndex);
          });
        }

        function scrollSelectedIntoView(items) {
          const selected = items[kbSelectedIndex];
          if (selected) selected.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }

        // ─── Init ────────────────────────────────────────────────────────────────

        async function init() {
          const result = await window.agent.init();
          if (!result.success) {
            statusText.textContent = "Init failed: " + result.error;
            sendBtn.disabled = true;
            return;
          }

          currentSessionId = result.sessionId || null;
          currentProjectPath = (await window.agent.getCurrentCwd()) || null;
          // Set agent home for path shortening in session list
          window.__codeagent_home = await window.agent.getAgentHome();
          setStatus("Ready");

          window.agent.onEvent(handleAgentEvent);

          const cfg = await window.agent.getConfig();
          setModelDisplay(cfg.currentModel);

          const firstRun = await window.agent.isFirstRun();
          if (firstRun || !cfg.currentModel) {
            openSettings();
          }

          await loadSessions();
          await loadMessages();
          await updateContextBar();
          await updateThinkingLevelDisplay();
          updateBreadcrumb(); // init breadcrumb state
          // Periodic context bar update
          setInterval(updateContextBar, 5000);
        }

        if (window.agent) {
          init().catch(console.error);
        } else {
          window.addEventListener("DOMContentLoaded", () => {
            init().catch(console.error);
          });
        }
      })();
    })();
  })();
})();
