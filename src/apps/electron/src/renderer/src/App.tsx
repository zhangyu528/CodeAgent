import { useState, useEffect, useRef, useCallback } from 'react';
import type { Message, Session, Project, Provider, Model, ThinkingLevel, ContextUsage, SessionGroup } from './types';
import { agent } from './api';
import MessageContent from './components/MessageContent';

type View = 'chat' | 'projects' | 'settings';

export default function App() {
  // State
  const [status, setStatus] = useState('Loading...');
  const [view, setView] = useState<View>('chat');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Sessions & Projects
  const [sessions, setSessions] = useState<Session[]>([]);
  const [sessionGroups, setSessionGroups] = useState<SessionGroup>({ global: [], byProject: {} });
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());

  // Model
  const [providers, setProviders] = useState<Provider[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [currentModel, setCurrentModel] = useState<string | null>(null);

  // Context
  const [contextUsage, setContextUsage] = useState<ContextUsage | null>(null);
  const [thinkingLevel, setThinkingLevel] = useState<ThinkingLevel | null>(null);
  const [autoCompaction, setAutoCompaction] = useState(false);
  const [isCompacting, setIsCompacting] = useState(false);
  const [currentCwd, setCurrentCwd] = useState<string>('');
  const [isFirstRun, setIsFirstRun] = useState(false);
  const [hoveredSessionId, setHoveredSessionId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Helper: get session display name (时间 + 首消息摘要)
  const getSessionDisplayName = (session: Session): string => {
    const now = new Date();
    const modified = session.modified instanceof Date ? session.modified : new Date(session.modified);
    const diffMs = now.getTime() - modified.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    let timeStr: string;
    if (diffDays === 0) {
      timeStr = `今天 ${modified.getHours().toString().padStart(2, '0')}:${modified.getMinutes().toString().padStart(2, '0')}`;
    } else if (diffDays === 1) {
      timeStr = '昨天';
    } else {
      timeStr = `${(modified.getMonth() + 1).toString().padStart(2, '0')}-${modified.getDate().toString().padStart(2, '0')}`;
    }

    let summary = '新对话';
    if (session.firstMessage && session.firstMessage.trim()) {
      const msg = session.firstMessage.trim();
      summary = msg.length > 12 ? msg.substring(0, 12) + '...' : msg;
    }

    return `${timeStr} · ${summary}`;
  };

  // Initialize
  useEffect(() => {
    init();
  }, []);

  const init = async () => {
    try {
      const result = await agent.init();
      if (result.success) {
        setStatus('Ready');
        setActiveSessionId(result.sessionId || null);

        // Check if first run
        const firstRun = await agent.isFirstRun();
        setIsFirstRun(firstRun);
        if (firstRun) {
          setStatus('Welcome! Please configure your API Key in Settings.');
          setView('settings');
        }

        await loadSessions();
        await loadProjects();
        await loadProviders();
        await loadContextUsage();
        await loadThinkingLevel();
        await loadAutoCompaction();
        await loadCurrentCwd();
        await loadMessages();
        setupEventListener();
      } else {
        setStatus('Error: ' + result.error);
      }
    } catch (err: any) {
      setStatus('Error: ' + err.message);
    }
  };

  const setupEventListener = () => {
    agent.onEvent((event: any) => {
      if (event.type === 'message' || event.type === 'streaming') {
        loadMessages();
        if (event.type === 'streaming' && event.done) {
          setIsLoading(false);
        }
      }
      if (event.type === 'compact' || event.type === 'context') {
        loadContextUsage();
      }
      if (event.type === 'error') {
        setIsLoading(false);
        setStatus('Error: ' + event.error);
      }
      if (event.type === 'compacting') {
        setIsCompacting(true);
      }
      if (event.type === 'compact-done') {
        setIsCompacting(false);
        loadContextUsage();
      }
    });
  };

  const loadSessions = async () => {
    try {
      const list = await agent.listSessions();
      console.log('[App] loadSessions, raw list length:', list.length);
      for (const s of list) {
        console.log('[App] loadSessions session:', s.id, 'path:', s.path, 'cwd:', s.cwd);
      }
      setSessions(list);
      setSessionGroups(groupSessions(list));
    } catch (err) {
      console.error('Failed to load sessions:', err);
    }
  };

  const groupSessions = (sessions: Session[]): SessionGroup => {
    const groups: SessionGroup = { global: [], byProject: {} };
    sessions.forEach(session => {
      if (!session.cwd) {
        groups.global.push(session);
      } else {
        if (!groups.byProject[session.cwd]) {
          groups.byProject[session.cwd] = [];
        }
        groups.byProject[session.cwd].push(session);
      }
    });
    return groups;
  };

  const loadProjects = async () => {
    try {
      const list = await agent.listProjects();
      setProjects(list);
    } catch (err) {
      console.error('Failed to load projects:', err);
    }
  };

  const toggleProjectExpand = (projectPath: string) => {
    setExpandedProjects(prev => {
      const next = new Set(prev);
      if (next.has(projectPath)) {
        next.delete(projectPath);
      } else {
        next.add(projectPath);
      }
      return next;
    });
  };

  const loadProviders = async () => {
    try {
      const config = await agent.getConfig();
      setProviders(config.providers);
      setCurrentModel(config.currentModel);
    } catch (err) {
      console.error('Failed to load providers:', err);
    }
  };

  const loadModels = async (provider: string) => {
    try {
      const list = await agent.getModels(provider);
      setModels(list);
    } catch (err) {
      console.error('Failed to load models:', err);
    }
  };

  const loadContextUsage = async () => {
    try {
      const usage = await agent.getContextUsage();
      setContextUsage(usage);
    } catch (err) {
      console.error('Failed to load context usage:', err);
    }
  };

  const loadThinkingLevel = async () => {
    try {
      const level = await agent.getThinkingLevel();
      setThinkingLevel(level);
    } catch (err) {
      console.error('Failed to load thinking level:', err);
    }
  };

  const loadMessages = async () => {
    try {
      const msgs = await agent.getMessages();
      console.log('[App] loadMessages, count:', msgs.length, 'msgs:', JSON.stringify(msgs, null, 2));
      setMessages(msgs);
    } catch (err) {
      console.error('Failed to load messages:', err);
    }
  };

  // Handlers
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const text = input.trim();
    setInput('');
    setIsLoading(true);

    setMessages(prev => [...prev, { id: Date.now().toString(), role: 'user', content: text, timestamp: Date.now() }]);

    try {
      await agent.prompt(text);
      await loadMessages();
    } catch (err: any) {
      console.error('Prompt failed:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewChat = async () => {
    try {
      let result;
      if (currentCwd && currentCwd !== '') {
        result = await agent.newSessionForProject(currentCwd);
      } else {
        result = await agent.newGlobalSession();
      }
      if (result.success) {
        setMessages([]);
        setActiveSessionId(result.sessionId || null);
        await loadSessions();
      }
    } catch (err) {
      console.error('Failed to create session:', err);
    }
  };

  const handleNewGlobalChat = async () => {
    try {
      const result = await agent.newGlobalSession();
      if (result.success) {
        setMessages([]);
        setActiveSessionId(result.sessionId || null);
        await loadSessions();
      }
    } catch (err) {
      console.error('Failed to create global session:', err);
    }
  };

  const handleSelectDirectory = async () => {
    try {
      const result = await agent.selectDirectory();
      if (result.success && result.path) {
        const sessionResult = await agent.newSessionForProject(result.path);
        if (sessionResult.success) {
          const project = projects.find(p => p.path === result.path) || { path: result.path, name: result.path.split(/[\\/]/).pop() || result.path, createdAt: Date.now() };
          setActiveProject(project);
          setCurrentCwd(result.path);
          setMessages([]);
          setActiveSessionId(sessionResult.sessionId || null);
          await loadSessions();
          await loadProjects();
        }
      }
    } catch (err) {
      console.error('Failed to select directory:', err);
    }
  };

  const handleSwitchSession = async (session: Session) => {
    console.log('[App] handleSwitchSession called');
    console.log('[App] session.id:', session.id);
    console.log('[App] session.path:', session.path);
    console.log('[App] session.cwd:', session.cwd);

    // 防御性检查：验证 path 格式
    if (!session.path) {
      console.error('[App] session.path is empty/falsy, returning early');
      return;
    }

    // 检查 path 是否像目录（不是 .jsonl 文件）
    if (!session.path.endsWith('.jsonl')) {
      console.error('[App] Invalid session path (not .jsonl):', session.path);
      console.error('[App] session object:', JSON.stringify(session));
      return;
    }

    try {
      const effectiveCwd = session.cwd || '';
      console.log('[App] calling switchSession, path:', session.path, 'cwd:', effectiveCwd);
      await agent.switchSession(session.path, effectiveCwd);
      setActiveSessionId(session.id);
      await loadMessages();
    } catch (err) {
      console.error('Failed to switch session:', err);
    }
  };

  const handleDeleteSession = async (session: Session) => {
    if (!session.path) return;
    try {
      await agent.deleteSession(session.path);
      await loadSessions();
      if (session.id === activeSessionId) {
        setMessages([]);
        setActiveSessionId(null);
      }
    } catch (err) {
      console.error('Failed to delete session:', err);
    }
  };

  const handleSelectProvider = async (providerId: string) => {
    setSelectedProvider(providerId);
    await loadModels(providerId);
  };

  const handleSetModel = async (modelId: string) => {
    try {
      await agent.setModel({ id: modelId, provider: selectedProvider || undefined });
      setCurrentModel(modelId);
    } catch (err) {
      console.error('Failed to set model:', err);
    }
  };

  const [apiKeyInput, setApiKeyInput] = useState<Record<string, string>>({});
  const [apiKeySaving, setApiKeySaving] = useState<Record<string, boolean>>({});

  const handleSaveApiKey = async (providerId: string) => {
    const key = apiKeyInput[providerId];
    if (!key?.trim()) return;
    setApiKeySaving(prev => ({ ...prev, [providerId]: true }));
    try {
      await agent.saveApiKey(providerId, key.trim());
      setApiKeyInput(prev => ({ ...prev, [providerId]: '' }));
      await loadProviders();
    } catch (err) {
      console.error('Failed to save API key:', err);
    } finally {
      setApiKeySaving(prev => ({ ...prev, [providerId]: false }));
    }
  };

  const handleRemoveApiKey = async (providerId: string) => {
    try {
      await agent.removeApiKey(providerId);
      await loadProviders();
    } catch (err) {
      console.error('Failed to remove API key:', err);
    }
  };

  const handleReloadProviders = async () => {
    try {
      await agent.reloadProviders();
      await loadProviders();
    } catch (err) {
      console.error('Failed to reload providers:', err);
    }
  };

  const loadAutoCompaction = async () => {
    try {
      const enabled = await agent.getAutoCompaction();
      setAutoCompaction(enabled);
    } catch (err) {
      console.error('Failed to load auto compaction:', err);
    }
  };

  const loadCurrentCwd = async () => {
    try {
      const cwd = await agent.getCurrentCwd();
      setCurrentCwd(cwd);
    } catch (err) {
      console.error('Failed to load current cwd:', err);
    }
  };

  const handleSetAutoCompaction = async (enabled: boolean) => {
    try {
      await agent.setAutoCompaction(enabled);
      setAutoCompaction(enabled);
    } catch (err) {
      console.error('Failed to set auto compaction:', err);
    }
  };

  const handleAbort = async () => {
    try {
      agent.abort();
    } catch (err) {
      console.error('Failed to abort:', err);
    }
  };

  const handleSwitchProject = async (project: Project) => {
    if (!project.path) return;
    try {
      await agent.activateProject(project.path);
      setActiveProject(project);
      setCurrentCwd(project.path);
      await loadSessions();
      setMessages([]);
      setActiveSessionId(null);
    } catch (err) {
      console.error('Failed to switch project:', err);
    }
  };

  const handleDeleteProject = async (project: Project) => {
    if (!project.path) return;
    try {
      await agent.deleteProject(project.path);
      await loadProjects();
    } catch (err) {
      console.error('Failed to delete project:', err);
    }
  };

  const handleRenameProject = async (project: Project, newName: string) => {
    if (!project.path) return;
    try {
      await agent.renameProject(project.path, newName);
      await loadProjects();
    } catch (err) {
      console.error('Failed to rename project:', err);
    }
  };

  const handleRenameSession = async (session: Session, newName: string) => {
    if (!session.path) return;
    try {
      await agent.renameSession(session.path, newName);
      await loadSessions();
    } catch (err) {
      console.error('Failed to rename session:', err);
    }
  };

  const handleCompact = async () => {
    try {
      await agent.compact();
      await loadContextUsage();
    } catch (err) {
      console.error('Failed to compact:', err);
    }
  };

  const handleCycleThinking = async () => {
    try {
      const result = await agent.cycleThinkingLevel();
      if (result.success) {
        await loadThinkingLevel();
      }
    } catch (err) {
      console.error('Failed to cycle thinking level:', err);
    }
  };

  const handleSetThinkingLevel = (level: string) => {
    try {
      agent.setThinkingLevel(level);
      setThinkingLevel(prev => prev ? { ...prev, level } : null);
    } catch (err) {
      console.error('Failed to set thinking level:', err);
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Render
  return (
    <div style={styles.container}>
      {/* Sidebar */}
      <div style={styles.sidebar}>
        <div style={styles.logo}>
          <span style={styles.logoIcon}>🤖</span>
          <span style={styles.logoText}>CodeAgent</span>
        </div>

        <div style={styles.sidebarButtons}>
          <button style={styles.button} onClick={handleNewChat}>
            {currentCwd ? `+ New Chat in ${currentCwd.split(/[\\/]/).pop()}` : '+ New Global Chat'}
          </button>
          <button style={styles.buttonSecondary} onClick={handleSelectDirectory}>📁 Open Project</button>
        </div>

        <div style={styles.section}>
          <div style={styles.sectionTitle}>SESSIONS</div>

          {/* Global Sessions */}
          <div style={styles.sessionGroup}>
            <div style={styles.groupHeader} onClick={handleNewGlobalChat}>
              🏠 Global<span style={styles.headerAction}>+ New</span>
            </div>
            {sessionGroups.global.length === 0 ? (
              <div style={{ ...styles.sessionItem, color: '#52525b', cursor: 'default' }}>
                No global sessions
              </div>
            ) : (
              sessionGroups.global.map(session => (
                <div
                  key={session.id}
                  style={{
                    ...styles.sessionItem,
                    ...(session.id === activeSessionId ? styles.sessionItemActive : {}),
                    ...(hoveredSessionId === session.id ? styles.sessionItemHover : {}),
                  }}
                  onClick={() => handleSwitchSession(session)}
                  onMouseEnter={() => setHoveredSessionId(session.id)}
                  onMouseLeave={() => setHoveredSessionId(null)}
                >
                  <span style={styles.sessionIcon}>💬</span>
                  <div style={styles.sessionInfo}>
                    <div style={styles.sessionName}>{getSessionDisplayName(session)}</div>
                    <div style={styles.sessionMeta}>{session.messageCount} msgs</div>
                  </div>
                  <div style={styles.sessionActions}>
                    <button
                      style={{
                        ...styles.iconButton,
                        ...(hoveredSessionId === session.id ? styles.iconButtonHover : {}),
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!session.path) return;
                        const newName = prompt('Rename session:', session.name);
                        if (newName && newName !== session.name) {
                          handleRenameSession(session, newName);
                        }
                      }}
                    >
                      ✏️
                    </button>
                    <button
                      style={{
                        ...styles.iconButton,
                        ...(hoveredSessionId === session.id ? styles.iconButtonHover : {}),
                      }}
                      onClick={(e) => { e.stopPropagation(); handleDeleteSession(session); }}
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Project Sessions */}
          {Object.entries(sessionGroups.byProject).map(([projectPath, projSessions]) => (
            <div key={projectPath} style={styles.sessionGroup}>
              <div
                style={styles.projectGroupHeader}
                onClick={() => toggleProjectExpand(projectPath)}
              >
                <span style={styles.expandIcon}>
                  {expandedProjects.has(projectPath) ? '▼' : '▶'}
                </span>
                <span>📁</span>
                <span style={styles.projectGroupName}>{projectPath.split(/[\\/]/).pop()}</span>
                <span style={styles.sessionCount}>({projSessions.length})</span>
              </div>

              {expandedProjects.has(projectPath) && projSessions.map(session => (
                <div
                  key={session.id}
                  style={{
                    ...styles.sessionItem,
                    ...(session.id === activeSessionId ? styles.sessionItemActive : {}),
                    ...(hoveredSessionId === session.id ? styles.sessionItemHover : {}),
                  }}
                  onClick={() => handleSwitchSession(session)}
                  onMouseEnter={() => setHoveredSessionId(session.id)}
                  onMouseLeave={() => setHoveredSessionId(null)}
                >
                  <span style={styles.sessionIcon}>💬</span>
                  <div style={styles.sessionInfo}>
                    <div style={styles.sessionName}>{getSessionDisplayName(session)}</div>
                    <div style={styles.sessionMeta}>{session.messageCount} msgs</div>
                  </div>
                  <div style={styles.sessionActions}>
                    <button
                      style={{
                        ...styles.iconButton,
                        ...(hoveredSessionId === session.id ? styles.iconButtonHover : {}),
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!session.path) return;
                        const newName = prompt('Rename session:', session.name);
                        if (newName && newName !== session.name) {
                          handleRenameSession(session, newName);
                        }
                      }}
                    >
                      ✏️
                    </button>
                    <button
                      style={{
                        ...styles.iconButton,
                        ...(hoveredSessionId === session.id ? styles.iconButtonHover : {}),
                      }}
                      onClick={(e) => { e.stopPropagation(); handleDeleteSession(session); }}
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ))}

          {sessions.length === 0 && (
            <div style={styles.empty}>No sessions yet</div>
          )}
        </div>

        <div style={styles.bottomNav}>
          {(['chat', 'settings'] as const).map(v => (
            <button
              key={v}
              style={{ ...styles.navButton, ...(view === v ? styles.navButtonActive : {}) }}
              onClick={() => setView(v)}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div style={styles.main}>
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.headerLeft}>
            <span style={styles.status}>{status}</span>
            <span style={{
              ...styles.modeIndicator,
              backgroundColor: currentCwd ? '#1a2e1a' : '#1a1a2e',
              border: `1px solid ${currentCwd ? '#22c55e' : '#3b82f6'}`,
              color: currentCwd ? '#22c55e' : '#3b82f6',
            }}>
              {currentCwd ? `📁 ${currentCwd.split(/[\\/]/).pop()}` : '🌐 GLOBAL'}
            </span>
          </div>
          <div style={styles.headerActions}>
            {isLoading && (
              <button style={styles.abortButton} onClick={handleAbort}>
                ⏹ Stop
              </button>
            )}
            <select
              style={styles.thinkingSelect}
              value={thinkingLevel?.level || 'off'}
              onChange={(e) => handleSetThinkingLevel(e.target.value)}
            >
              {(thinkingLevel?.availableLevels || ['off', 'low', 'medium', 'high']).map(level => (
                <option key={level} value={level}>
                  Thinking: {level}
                </option>
              ))}
            </select>
            <button
              style={{ ...styles.actionButton, ...(autoCompaction ? styles.actionButtonActive : {}) }}
              onClick={() => handleSetAutoCompaction(!autoCompaction)}
              title="Auto Compaction"
            >
              🔄 Auto
            </button>
            <button
              style={styles.actionButton}
              onClick={handleCompact}
              disabled={isCompacting}
            >
              {isCompacting ? 'Compacting...' : 'Compact'}
            </button>
            {contextUsage && (
              <span style={styles.contextBar}>
                {contextUsage.tokens ?? 0} / {contextUsage.contextWindow}
                <div style={{
                  ...styles.contextProgress,
                  width: `${contextUsage.percent ?? 0}%`,
                }} />
              </span>
            )}
          </div>
        </div>

        {/* Content Area */}
        {view === 'chat' && (
          <>
            {/* Breadcrumb */}
            <div style={styles.breadcrumb}>
              <span style={styles.breadcrumbItem}>💬 {activeProject ? activeProject.name.split(/[\\/]/).pop() : 'Global'}</span>
              {activeSessionId && (
                <>
                  <span style={styles.breadcrumbSep}> › </span>
                  <span style={styles.breadcrumbItem}>{sessions.find(s => s.id === activeSessionId) ? getSessionDisplayName(sessions.find(s => s.id === activeSessionId)!) : ''}</span>
                </>
              )}
            </div>

            <div style={styles.messages}>
              {messages.length === 0 ? (
                <div style={styles.empty}>
                  <div style={styles.emptyIcon}>💬</div>
                  <div style={styles.emptyTitle}>Start a conversation</div>
                  <div style={styles.emptyText}>Type a message below to begin</div>
                </div>
              ) : (
                messages.map((msg, idx) => (
                  <div
                    key={msg.id || idx}
                    style={{
                      ...styles.message,
                      flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
                    }}
                  >
                    <div style={{
                      ...styles.avatar,
                      background: msg.role === 'user' ? '#3f3f46' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      color: '#fff',
                      fontSize: '14px',
                      fontWeight: 600,
                    }}>
                      {msg.role === 'user' ? 'U' : 'AI'}
                    </div>
                    <div style={{
                      ...styles.messageContent,
                      background: msg.role === 'user' ? '#3f3f46' : '#18181b',
                      borderRadius: msg.role === 'user' ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
                      borderLeft: msg.role === 'assistant' ? '3px solid #667eea' : 'none',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                    }}>
                      <MessageContent content={msg.content} role={msg.role} />
                      <div style={styles.messageTimestamp}>
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                ))
              )}
              {isLoading && <div style={styles.loading}>Thinking...</div>}
              <div ref={messagesEndRef} />
            </div>

            <form style={styles.inputForm} onSubmit={handleSubmit}>
              <input
                style={styles.input}
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="Type a message..."
                disabled={isLoading}
              />
              <button type="submit" style={styles.sendButton} disabled={!input.trim() || isLoading}>
                Send
              </button>
            </form>
          </>
        )}

        {view === 'projects' && (
          <div style={styles.content}>
            <div style={styles.contentTitle}>Projects</div>
            {projects.length === 0 ? (
              <div style={styles.empty}>No projects yet</div>
            ) : (
              projects.map(project => (
                <div
                  key={project.path}
                  style={styles.projectItem}
                  onClick={() => project.path && handleSwitchProject(project)}
                >
                  <div style={styles.projectHeader}>
                    <div style={styles.projectName}>{project.name}</div>
                    <div style={styles.projectActions}>
                      <button
                        style={styles.iconButton}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!project.path) return;
                          const newName = prompt('Rename project:', project.name);
                          if (newName && newName !== project.name) {
                            handleRenameProject(project, newName);
                          }
                        }}
                      >
                        ✏️
                      </button>
                      <button
                        style={styles.iconButton}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!project.path) return;
                          if (confirm(`Delete project "${project.name}"?`)) {
                            handleDeleteProject(project);
                          }
                        }}
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                  <div style={styles.projectPath}>{project.path}</div>
                </div>
              ))
            )}
          </div>
        )}

        {view === 'settings' && (
          <div style={styles.content}>
            <div style={styles.contentTitle}>Settings</div>

            <div style={styles.settingsSection}>
              <div style={styles.settingsHeader}>
                <div style={styles.settingsTitle}>Model Provider</div>
                <button style={styles.reloadButton} onClick={handleReloadProviders}>
                  ↻ Reload
                </button>
              </div>
              {providers.map(provider => (
                <div key={provider.id} style={styles.providerItem}>
                  <div style={styles.providerInfo}>
                    <div style={styles.providerName}>{provider.name || provider.id}</div>
                    <div style={styles.providerStatus}>
                      {provider.hasApiKey ? '✅ Configured' : '❌ Not configured'}
                    </div>
                  </div>
                  <div style={styles.providerActions}>
                    {!provider.hasApiKey && (
                      <div style={styles.apiKeyInput}>
                        <input
                          type="password"
                          style={styles.apiKeyInputField}
                          placeholder="API Key..."
                          value={apiKeyInput[provider.id] || ''}
                          onChange={e => setApiKeyInput(prev => ({ ...prev, [provider.id]: e.target.value }))}
                        />
                        <button
                          style={styles.saveButton}
                          onClick={() => handleSaveApiKey(provider.id)}
                          disabled={!apiKeyInput[provider.id]?.trim() || apiKeySaving[provider.id]}
                        >
                          {apiKeySaving[provider.id] ? 'Saving...' : 'Save'}
                        </button>
                      </div>
                    )}
                    {provider.hasApiKey && (
                      <div style={styles.apiKeyActions}>
                        <button
                          style={styles.selectButton}
                          onClick={() => handleSelectProvider(provider.id)}
                        >
                          Select
                        </button>
                        <button
                          style={styles.removeButton}
                          onClick={() => handleRemoveApiKey(provider.id)}
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {selectedProvider && (
              <div style={styles.settingsSection}>
                <div style={styles.settingsTitle}>Models - {selectedProvider}</div>
                {models.map(model => (
                  <div
                    key={model.id}
                    style={{
                      ...styles.modelItem,
                      ...(model.id === currentModel ? styles.modelItemActive : {}),
                    }}
                    onClick={() => handleSetModel(model.id)}
                  >
                    {model.id}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Styles
const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    height: '100vh',
    background: '#0b0b0f',
    color: '#e4e4e7',
  },
  sidebar: {
    width: 260,
    borderRight: '1px solid #27272a',
    display: 'flex',
    flexDirection: 'column',
  },
  logo: {
    padding: 16,
    borderBottom: '1px solid #27272a',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  logoIcon: { fontSize: 20 },
  logoText: { fontWeight: 600, fontSize: 16 },
  sidebarButtons: { padding: 8, display: 'flex', flexDirection: 'column', gap: 4 },
  button: {
    width: '100%',
    padding: '10px 12px',
    background: '#18181b',
    border: '1px solid #27272a',
    borderRadius: 6,
    color: '#e4e4e7',
    cursor: 'pointer',
    textAlign: 'left',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  buttonSecondary: {
    width: '100%',
    padding: '10px 12px',
    background: '#18181b',
    border: '1px solid #27272a',
    borderRadius: 6,
    color: '#a1a1aa',
    cursor: 'pointer',
    textAlign: 'left',
  },
  section: { flex: 1, overflow: 'auto', padding: '8px 0' },
  sectionTitle: { padding: '8px 16px', fontSize: 11, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.5px' },
  modeSwitcher: { display: 'flex', gap: 4, marginBottom: 8 },
  modeBtn: {
    flex: 1,
    padding: '6px 8px',
    background: '#18181b',
    border: '1px solid #27272a',
    borderRadius: 4,
    color: '#71717a',
    cursor: 'pointer',
    fontSize: 12,
  },
  modeBtnActive: {
    background: '#27272a',
    color: '#e4e4e7',
    borderColor: '#3f3f46',
  },
  sessionGroup: { marginBottom: 8 },
  groupHeader: {
    padding: '8px 12px',
    fontSize: 11,
    fontWeight: 600,
    color: '#71717a',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  headerAction: { marginLeft: 'auto', fontSize: '10px', color: '#3b82f6', fontWeight: 400 },
  sessionItem: {
    padding: '8px 16px',
    paddingLeft: '36px',
    cursor: 'pointer',
    borderBottom: '1px solid #27272a',
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  sessionItemActive: { background: '#1e3a5f', borderLeft: '3px solid #3b82f6' },
  sessionIcon: { fontSize: '14px', width: '20px', textAlign: 'center' },
  sessionInfo: { flex: 1, minWidth: 0 },
  sessionName: { fontSize: 14, color: '#e4e4e7', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  sessionMeta: { fontSize: 12, color: '#71717a' },
  projectGroupHeader: {
    padding: '10px 12px',
    fontSize: 13,
    fontWeight: 500,
    color: '#d1d5db',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    borderBottom: '1px solid #374151',
  },
  expandIcon: { fontSize: '8px', color: '#6b7280', width: '12px' },
  projectGroupName: { flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  sessionCount: { fontSize: '11px', color: '#6b7280' },
  deleteButton: {
    position: 'absolute',
    right: 8,
    top: 8,
    background: 'none',
    border: 'none',
    color: '#71717a',
    cursor: 'pointer',
    fontSize: 16,
  },
  bottomNav: {
    borderTop: '1px solid #27272a',
    display: 'flex',
  },
  navButton: {
    flex: 1,
    padding: '12px 0',
    background: 'transparent',
    border: 'none',
    color: '#71717a',
    cursor: 'pointer',
    textTransform: 'capitalize',
  },
  navButtonActive: { background: '#18181b', color: '#e4e4e7' },
  main: { flex: 1, display: 'flex', flexDirection: 'column' },
  header: {
    padding: '12px 24px',
    borderBottom: '1px solid #27272a',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: { display: 'flex', alignItems: 'center', gap: 12 },
  cwd: { fontSize: 12, color: '#71717a' },
  modeIndicator: {
    padding: '4px 10px',
    borderRadius: 12,
    fontSize: 11,
    fontWeight: 600,
  },
  status: { fontSize: 14, color: '#71717a' },
  headerActions: { display: 'flex', gap: 8, alignItems: 'center' },
  abortButton: {
    padding: '6px 12px',
    background: '#dc2626',
    border: 'none',
    borderRadius: 4,
    color: '#fff',
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 600,
  },
  actionButton: {
    padding: '6px 12px',
    background: '#18181b',
    border: '1px solid #27272a',
    borderRadius: 4,
    color: '#e4e4e7',
    cursor: 'pointer',
    fontSize: 12,
  },
  actionButtonActive: {
    background: '#27272a',
    borderColor: '#3f3f46',
  },
  thinkingSelect: {
    padding: '6px 12px',
    background: '#18181b',
    border: '1px solid #27272a',
    borderRadius: 4,
    color: '#e4e4e7',
    cursor: 'pointer',
    fontSize: 12,
  },
  contextBar: {
    fontSize: 12,
    color: '#71717a',
    position: 'relative',
    padding: '4px 8px',
    background: '#18181b',
    borderRadius: 4,
    minWidth: 120,
  },
  contextProgress: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    height: 2,
    background: '#3f3f46',
  },
  messages: { flex: 1, overflow: 'auto', padding: 24 },
  breadcrumb: {
    padding: '8px 24px',
    borderBottom: '1px solid #27272a',
    display: 'flex',
    alignItems: 'center',
    fontSize: 12,
    color: '#71717a',
  },
  breadcrumbItem: { color: '#a1a1aa' },
  breadcrumbSep: { color: '#52525b', margin: '0 4px' },
  empty: {
    textAlign: 'center',
    padding: 48,
    color: '#71717a',
  },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontSize: 18, marginBottom: 8 },
  emptyText: { fontSize: 14 },
  message: {
    marginBottom: 24,
    display: 'flex',
    gap: 12,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 16,
    flexShrink: 0,
  },
  messageContent: {
    maxWidth: '70%',
    padding: '12px 16px',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },
  messageTimestamp: {
    fontSize: '11px',
    color: '#52525b',
    marginTop: '8px',
    textAlign: 'right',
  },
  loading: { color: '#71717a', fontSize: 14 },
  inputForm: {
    padding: '16px 24px',
    borderTop: '1px solid #27272a',
    display: 'flex',
    gap: 12,
  },
  input: {
    flex: 1,
    padding: '12px 16px',
    background: '#18181b',
    border: '1px solid #27272a',
    borderRadius: 8,
    color: '#e4e4e7',
    fontSize: 14,
    outline: 'none',
  },
  sendButton: {
    padding: '12px 24px',
    background: '#3f3f46',
    border: 'none',
    borderRadius: 8,
    color: '#e4e4e7',
    cursor: 'pointer',
    fontSize: 14,
  },
  content: { flex: 1, overflow: 'auto', padding: 24 },
  contentTitle: { fontSize: 18, marginBottom: 16 },
  projectItem: {
    padding: 12,
    background: '#18181b',
    borderRadius: 8,
    marginBottom: 8,
    cursor: 'pointer',
  },
  projectHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  projectName: { fontSize: 14, fontWeight: 600 },
  projectPath: { fontSize: 12, color: '#71717a', marginTop: 4 },
  projectActions: { display: 'flex', gap: 4 },
  sessionActions: { display: 'flex', gap: 4 },
  iconButton: {
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    fontSize: 12,
    padding: 2,
    color: '#71717a',
    transition: 'color 0.15s',
  },
  iconButtonHover: {
    color: '#e5e7eb',
  },
  sessionItemHover: {
    background: '#27272a',
  },
  settingsSection: { marginBottom: 24 },
  settingsTitle: { fontSize: 14, fontWeight: 600, marginBottom: 12 },
  settingsHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  reloadButton: {
    padding: '6px 12px',
    background: '#18181b',
    border: '1px solid #27272a',
    borderRadius: 4,
    color: '#a1a1aa',
    cursor: 'pointer',
    fontSize: 12,
  },
  providerItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 12,
    padding: 12,
    background: '#18181b',
    borderRadius: 8,
    marginBottom: 8,
  },
  providerInfo: { flex: 1 },
  providerName: { fontSize: 14 },
  providerStatus: { fontSize: 12, color: '#71717a', marginTop: 2 },
  providerActions: { display: 'flex', flexDirection: 'column', gap: 8 },
  apiKeyInput: { display: 'flex', gap: 8 },
  apiKeyInputField: {
    flex: 1,
    padding: '8px 12px',
    background: '#0b0b0f',
    border: '1px solid #27272a',
    borderRadius: 4,
    color: '#e4e4e7',
    fontSize: 13,
    outline: 'none',
  },
  apiKeyActions: { display: 'flex', gap: 8 },
  saveButton: {
    padding: '8px 12px',
    background: '#3f3f46',
    border: 'none',
    borderRadius: 4,
    color: '#e4e4e7',
    cursor: 'pointer',
    fontSize: 12,
  },
  removeButton: {
    padding: '8px 12px',
    background: 'transparent',
    border: '1px solid #27272a',
    borderRadius: 4,
    color: '#71717a',
    cursor: 'pointer',
    fontSize: 12,
  },
  selectButton: {
    padding: '6px 12px',
    background: '#3f3f46',
    border: 'none',
    borderRadius: 4,
    color: '#e4e4e7',
    cursor: 'pointer',
    fontSize: 12,
  },
  modelItem: {
    padding: 12,
    background: '#18181b',
    borderRadius: 8,
    marginBottom: 8,
    cursor: 'pointer',
    border: '1px solid transparent',
  },
  modelItemActive: { borderColor: '#3f3f46' },
};