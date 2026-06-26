import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Avatar,
  Button,
  Card,
  Chip,
  Input,
  Spinner,
  Switch,
  TextArea,
} from '@heroui/react';
import '@heroui/styles/css';
import {
  Archive,
  Bell,
  Bot,
  Brain,
  CheckCircle2,
  CircleAlert,
  CircleCheck,
  Command,
  Compass,
  Database,
  FileUp,
  Home,
  MessageCircle,
  Moon,
  Paperclip,
  RefreshCw,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  Sun,
  Upload,
  User,
  Users,
  X,
} from 'lucide-react';
import './styles.css';

const API_BASE_KEY = 'infinitechat.apiBase';
const USER_ID_KEY = 'infinitechat.userId';
const SESSION_ID_KEY = 'infinitechat.sessionId';
const THEME_KEY = 'infinitechat.theme';
const MESSAGES_KEY = 'infinitechat.messages';

const railItems = [
  { id: 'home', label: '首页', icon: Home },
  { id: 'chat', label: '消息', icon: MessageCircle },
  { id: 'contacts', label: '联系人', icon: Users },
  { id: 'discover', label: '发现', icon: Compass },
  { id: 'agent', label: '助手', icon: Sparkles },
  { id: 'settings', label: '设置', icon: Settings },
];

const assistantModes = [
  { id: 'agent', label: '助手编排', icon: Bot, hint: '理解目标、整理步骤，再给出建议' },
  { id: 'knowledge', label: '知识引用', icon: Database, hint: '优先从已入库资料里回答' },
  { id: 'direct', label: '直接回复', icon: MessageCircle, hint: '快速生成一条可编辑回复' },
];

const assistantTabs = [
  { id: 'conversation', label: '对话', icon: MessageCircle },
  { id: 'knowledge', label: '资料', icon: Database },
  { id: 'ingest', label: '导入', icon: FileUp },
  { id: 'memory', label: '记忆', icon: Brain },
];

const welcomeMessage = {
  id: 'welcome',
  role: 'assistant',
  author: 'Infinite 助手',
  time: '现在',
  text: '输入要处理的消息、问题或资料后，我会保留依据、展示状态，并让你确认后再采用。',
};

function defaultApiBase() {
  const envBase = import.meta.env.VITE_AGENT_API_BASE;
  if (envBase) return trimSlash(envBase);
  if (typeof window === 'undefined') return 'http://localhost:10010/api';
  const host = window.location.hostname || 'localhost';
  return `http://${host}:10010/api`;
}

function trimSlash(value) {
  return String(value || '').replace(/\/+$/, '');
}

function toLong(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function nowTime() {
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date());
}

function randomId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getInitialView() {
  if (typeof window === 'undefined') return 'chat';
  const fromPath = window.location.pathname.replace(/^\/+/, '').split('/')[0];
  const fromHash = window.location.hash.replace(/^#\/?/, '');
  const candidate = fromPath || fromHash || 'chat';
  return railItems.some((item) => item.id === candidate) ? candidate : 'chat';
}

function useStoredState(key, initialValue) {
  const [value, setValue] = useState(() => {
    if (typeof window === 'undefined') return initialValue;
    return window.localStorage.getItem(key) || initialValue;
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(key, value);
    }
  }, [key, value]);

  return [value, setValue];
}

function useStoredMessages() {
  const [messages, setMessages] = useState(() => {
    if (typeof window === 'undefined') return [welcomeMessage];
    try {
      const raw = window.localStorage.getItem(MESSAGES_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      return Array.isArray(parsed) && parsed.length > 0 ? parsed : [welcomeMessage];
    } catch {
      return [welcomeMessage];
    }
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(MESSAGES_KEY, JSON.stringify(messages.slice(-60)));
    }
  }, [messages]);

  return [messages, setMessages];
}

async function requestJson(apiBase, path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${trimSlash(apiBase)}${path}`, {
    ...options,
    headers,
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(body?.message || `HTTP ${response.status}`);
  }
  if (body && typeof body.code === 'number' && body.code !== 200) {
    throw new Error(body.message || `业务错误 ${body.code}`);
  }
  return body?.data ?? body;
}

async function readSse(response, onEvent) {
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `HTTP ${response.status}`);
  }
  if (!response.body) throw new Error('当前浏览器无法读取流式响应');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split(/\r?\n\r?\n/);
    buffer = chunks.pop() || '';
    chunks.forEach((chunk) => {
      const data = chunk
        .split(/\r?\n/)
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).trimStart())
        .join('\n');
      if (!data) return;
      try {
        onEvent(JSON.parse(data));
      } catch {
        onEvent({ type: 'delta', text: data });
      }
    });
  }
}

function extractAnswer(data) {
  if (!data) return '没有生成内容。';
  return data.answer || data.content || data.response || data.message || String(data);
}

function extractTrace(data) {
  return data?.reactTrace || data?.debug?.steps || data?.steps || [];
}

async function callMode(apiBase, mode, payload) {
  if (mode === 'knowledge') {
    return requestJson(apiBase, '/rag/adaptive/chat', {
      method: 'POST',
      body: JSON.stringify({ ...payload, debug: true }),
    });
  }
  if (mode === 'agent') {
    return requestJson(apiBase, '/agent/chat', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }
  return requestJson(apiBase, '/chat', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

function patchMessage(setMessages, id, patch) {
  setMessages((items) => items.map((item) => (item.id === id ? { ...item, ...patch } : item)));
}

function App() {
  const [view, setView] = useState(getInitialView);
  const [theme, setTheme] = useStoredState(THEME_KEY, 'light');
  const [apiBase, setApiBase] = useStoredState(API_BASE_KEY, defaultApiBase());
  const [userId, setUserId] = useStoredState(USER_ID_KEY, '1');
  const [sessionId, setSessionId] = useStoredState(SESSION_ID_KEY, '1');
  const [messages, setMessages] = useStoredMessages();
  const [prompt, setPrompt] = useState('');
  const [mode, setMode] = useState('agent');
  const [assistantTab, setAssistantTab] = useState('conversation');
  const [status, setStatus] = useState({ state: 'idle', text: '等待输入' });
  const [lastAnswer, setLastAnswer] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.body.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    const onPop = () => setView(getInitialView());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const identity = useMemo(() => ({
    userId: toLong(userId),
    sessionId: toLong(sessionId),
  }), [userId, sessionId]);

  function navigate(nextView) {
    setQuickOpen(false);
    setActivityOpen(false);
    setProfileOpen(false);
    setView(nextView);
    if (typeof window !== 'undefined') {
      window.history.pushState(null, '', `/${nextView}`);
    }
  }

  function closePanels() {
    setQuickOpen(false);
    setActivityOpen(false);
    setProfileOpen(false);
  }

  async function submitPrompt(options = {}) {
    const stream = Boolean(options.stream);
    const text = String(options.text ?? prompt).trim();
    if (!text || !identity.userId || !identity.sessionId || status.state === 'busy') return;

    const assistantId = randomId();
    setPrompt('');
    setMessages((items) => [
      ...items,
      { id: randomId(), role: 'user', author: '你', time: nowTime(), text },
      { id: assistantId, role: 'assistant', author: 'Infinite 助手', time: nowTime(), text: stream ? '' : '正在整理...' },
    ]);
    setStatus({ state: 'busy', text: stream ? '流式生成中' : '生成中' });

    try {
      if (stream && mode === 'direct') {
        let answer = '';
        const response = await fetch(`${trimSlash(apiBase)}/streamChat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...identity, prompt: text }),
        });
        await readSse(response, (event) => {
          if (event.type === 'delta' || event.text) {
            answer += event.text || '';
            patchMessage(setMessages, assistantId, { text: answer || '正在生成...' });
          }
          if (event.type === 'error') throw new Error(event.message || '生成失败');
        });
        setLastAnswer({ answer, mode, at: nowTime(), citations: [] });
      } else {
        const data = await callMode(apiBase, mode, { ...identity, prompt: text });
        const answer = extractAnswer(data);
        patchMessage(setMessages, assistantId, { text: answer });
        setLastAnswer({ ...data, answer, mode, at: nowTime(), trace: extractTrace(data) });
      }
      setStatus({ state: 'ok', text: '已生成' });
    } catch (error) {
      patchMessage(setMessages, assistantId, { text: `处理失败：${error.message}` });
      setStatus({ state: 'error', text: '连接异常' });
    }
  }

  const app = {
    apiBase,
    setApiBase,
    userId,
    setUserId,
    sessionId,
    setSessionId,
    identity,
    theme,
    setTheme,
    messages,
    setMessages,
    prompt,
    setPrompt,
    mode,
    setMode,
    status,
    setStatus,
    lastAnswer,
    setLastAnswer,
    assistantTab,
    setAssistantTab,
    submitPrompt,
    navigate,
  };

  return (
    <div className="app-root">
      <AppHeader
        view={view}
        theme={theme}
        status={status}
        onNavigate={navigate}
        onTheme={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        onSettings={() => setSettingsOpen(true)}
        onQuick={() => { setQuickOpen((open) => !open); setActivityOpen(false); setProfileOpen(false); }}
        onActivity={() => { setActivityOpen((open) => !open); setQuickOpen(false); setProfileOpen(false); }}
        onProfile={() => { setProfileOpen((open) => !open); setQuickOpen(false); setActivityOpen(false); }}
      />
      <Rail view={view} onNavigate={navigate} />

      {quickOpen && <QuickEntryPanel app={app} onClose={() => setQuickOpen(false)} />}
      {activityOpen && <ActivityPanel app={app} onClose={() => setActivityOpen(false)} />}
      {profileOpen && <ProfilePanel app={app} onClose={() => setProfileOpen(false)} onSettings={() => { closePanels(); setSettingsOpen(true); }} />}

      <main className={`workspace stage ${view}-stage`} id="main-content">
        <section className={`workspace-shell ${view}-workspace-shell`}>
          {view === 'home' && <HomeView app={app} />}
          {view === 'chat' && <ChatView app={app} />}
          {view === 'contacts' && <ContactsView app={app} />}
          {view === 'discover' && <DiscoverView app={app} />}
          {view === 'agent' && <AgentView app={app} />}
          {view === 'settings' && <SettingsView app={app} />}
        </section>
      </main>

      {settingsOpen && (
        <ConnectionDialog app={app} onClose={() => setSettingsOpen(false)} />
      )}
    </div>
  );
}

function AppHeader({ view, theme, status, onNavigate, onTheme, onQuick, onActivity, onProfile }) {
  const title = railItems.find((item) => item.id === view)?.label || '消息';
  return (
    <header className="app-header">
      <button className="brand-block" type="button" onClick={() => onNavigate('home')} aria-label="回到首页">
        <span className="brand-mark">∞</span>
        <span className="brand-copy">
          <strong>InfiniteChat</strong>
        </span>
      </button>

      <div className="mobile-title">{title}</div>

      <div className="header-actions">
        <Button className="toolbar-button quick-button quick-trigger" size="sm" variant="bordered" onPress={onQuick}>
          <Command size={16} />
          <span>快速入口</span>
        </Button>
        <Chip className={`status-chip ${status.state}`}>
          {status.state === 'busy' ? <Spinner size="sm" /> : <StatusIcon state={status.state} />}
          <span>{status.text}</span>
        </Chip>
        <Button className="icon-button activity-trigger" isIconOnly variant="bordered" onPress={onActivity} aria-label="提醒">
          <Bell size={18} />
        </Button>
        <Button className="toolbar-button theme-button theme-toggle" size="sm" variant="bordered" onPress={onTheme} aria-pressed={theme === 'dark'}>
          {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
          <span>{theme === 'dark' ? '日间' : '夜间'}</span>
        </Button>
        <Button className="icon-button profile-trigger" isIconOnly variant="bordered" onPress={onProfile} aria-label="账户与连接">
          <User size={18} />
        </Button>
      </div>
    </header>
  );
}

function StatusIcon({ state }) {
  if (state === 'error') return <CircleAlert size={14} />;
  if (state === 'ok') return <CircleCheck size={14} />;
  return <span className="status-dot" />;
}

function Rail({ view, onNavigate }) {
  return (
    <aside className="rail" aria-label="主导航">
      <button
        type="button"
        className="rail-brand-button"
        onClick={() => onNavigate('home')}
        aria-label="回到工作台"
      >
        ∞
      </button>
      {railItems.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          className={`rail-button ${view === id ? 'active' : ''}`}
          aria-current={view === id ? 'page' : undefined}
          onClick={() => onNavigate(id)}
          title={label}
        >
          <Icon size={20} />
          <span>{label}</span>
        </button>
      ))}
    </aside>
  );
}

function QuickEntryPanel({ app, onClose }) {
  const [quickText, setQuickText] = useState(app.prompt);
  const canSend = quickText.trim() && app.identity.userId && app.identity.sessionId && app.status.state !== 'busy';
  const actions = [
    {
      icon: MessageCircle,
      title: '继续当前会话',
      text: app.messages.at(-1)?.text || '进入消息页输入真实内容。',
      action: () => app.navigate('chat'),
    },
    {
      icon: Database,
      title: '查找相关资料',
      text: '切到知识问答，使用已入库资料回答。',
      action: () => { app.setAssistantTab('knowledge'); app.navigate('agent'); },
    },
    {
      icon: FileUp,
      title: '导入资料',
      text: '上传文件、粘贴文本或读取本地路径。',
      action: () => { app.setAssistantTab('ingest'); app.navigate('agent'); },
    },
    {
      icon: Settings,
      title: '检查连接',
      text: app.apiBase,
      action: () => app.navigate('settings'),
    },
  ];

  function submitQuick() {
    if (!canSend) return;
    app.submitPrompt({ text: quickText });
    onClose();
    app.navigate('chat');
  }

  return (
    <Card className="floating-panel quick-entry" role="dialog" aria-label="快速入口">
      <Card.Content>
        <FloatingHeader title="快速入口" text="直接进入真实工作流" onClose={onClose} closeLabel="关闭快速入口" />
        <div className="quick-compose">
          <Input
            value={quickText}
            onChange={(event) => setQuickText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                submitQuick();
              }
            }}
            placeholder="输入后直接交给助手处理"
            startContent={<Command size={17} />}
          />
          <Button
            color="primary"
            className="primary-button"
            isDisabled={!canSend}
            onPress={submitQuick}
          >
            <Send size={17} />
            发送
          </Button>
        </div>
        <div className="quick-list">
          {actions.map(({ icon: Icon, title, text, action }) => (
            <button key={title} type="button" onClick={action}>
              <span><Icon size={18} /></span>
              <div>
                <strong>{title}</strong>
                <p>{text}</p>
              </div>
            </button>
          ))}
        </div>
      </Card.Content>
    </Card>
  );
}

function ActivityPanel({ app, onClose }) {
  const userInputs = app.messages.filter((item) => item.role === 'user').length;
  const citations = app.lastAnswer?.citations?.length || 0;
  return (
    <Card className="floating-panel activity-panel" role="dialog" aria-label="提醒中心">
      <Card.Content>
        <FloatingHeader title="状态中心" text={app.status.text} onClose={onClose} closeLabel="关闭提醒中心" />
        <div className="activity-list">
          <OpenRow icon={ShieldCheck} title="服务状态" text={app.status.state === 'error' ? '最近请求失败，请检查后端服务。' : '当前没有阻塞提醒。'} meta={app.status.text} />
          <OpenRow icon={MessageCircle} title="会话输入" text="当前本机会话保存的真实用户输入。" meta={`${userInputs} 条`} />
          <OpenRow icon={Database} title="引用资料" text="来自最近一次知识问答返回。" meta={`${citations} 条`} />
        </div>
      </Card.Content>
    </Card>
  );
}

function ProfilePanel({ app, onClose, onSettings }) {
  return (
    <Card className="floating-panel profile-panel" role="dialog" aria-label="账号状态">
      <Card.Content>
        <FloatingHeader title="账户与连接" text={`用户 ${app.userId || '-'} · 会话 ${app.sessionId || '-'}`} onClose={onClose} closeLabel="关闭账号状态" />
        <div className="profile-summary">
          <span className="profile-avatar"><User size={20} /></span>
          <div>
            <strong>当前工作身份</strong>
            <p>{app.apiBase}</p>
          </div>
        </div>
        <div className="home-card-row">
          <span>主题</span>
          <b>{app.theme === 'dark' ? '夜间' : '日间'}</b>
        </div>
        <div className="home-card-row">
          <span>最近状态</span>
          <b>{app.status.text}</b>
        </div>
        <Button color="primary" className="primary-button" fullWidth onPress={onSettings}>调整连接</Button>
      </Card.Content>
    </Card>
  );
}

function FloatingHeader({ title, text, onClose, closeLabel }) {
  return (
    <div className="floating-head">
      <div>
        <h2>{title}</h2>
        <p>{text}</p>
      </div>
      <Button isIconOnly variant="bordered" className="icon-button" onPress={onClose} aria-label={closeLabel}>
        <X size={16} />
      </Button>
    </div>
  );
}

function HomeView({ app }) {
  const userInputs = app.messages.filter((item) => item.role === 'user');
  const latestUser = userInputs.at(-1);
  const citations = app.lastAnswer?.citations || [];
  const progress = Math.min(100, 16 + userInputs.length * 14 + citations.length * 8 + (app.lastAnswer?.answer ? 24 : 0));
  const priorityRows = [
    {
      icon: MessageCircle,
      title: '当前会话',
      text: latestUser?.text || '还没有真实输入。进入消息页后，第一条待处理内容会出现在这里。',
      meta: `${userInputs.length} 条输入`,
      action: () => app.navigate('chat'),
    },
    {
      icon: Database,
      title: '最近引用',
      text: citations.length ? `最近回答返回了 ${citations.length} 条可追溯引用。` : '知识问答完成后，这里会显示来源和引用片段。',
      meta: citations.length ? '可查看' : '等待资料',
      action: () => { app.setAssistantTab('knowledge'); app.navigate('agent'); },
    },
    {
      icon: ShieldCheck,
      title: '连接状态',
      text: app.status.state === 'error' ? '最近一次请求连接异常，请检查服务地址和后端状态。' : `当前服务地址：${app.apiBase}`,
      meta: app.status.text,
      action: () => app.navigate('settings'),
    },
  ];

  return (
    <div className="home-layout">
      <section className="home-hero">
          <p className="eyebrow">今日工作台</p>
          <h1>处理真实消息、资料和助手结果。</h1>
          <p className="hero-copy">从当前会话开始，按处理模式生成建议，再核对引用与状态后采用。</p>
          <div className="home-actions">
            <Button color="primary" className="primary-button" onPress={() => app.navigate('chat')}>
              <MessageCircle size={18} />
              继续消息
            </Button>
            <Button variant="bordered" className="secondary-button" onPress={() => app.navigate('agent')}>
              <Sparkles size={18} />
              打开助手
            </Button>
            <Button variant="bordered" className="secondary-button" onPress={() => { app.setAssistantTab('ingest'); app.navigate('agent'); }}>
              <FileUp size={18} />
              导入资料
            </Button>
          </div>

          <div className="focus-flow" aria-label="处理流程">
            {[
              ['输入真实内容', '消息、问题或资料'],
              ['选择处理模式', modeLabel(app.mode)],
              ['核对引用依据', citations.length ? `${citations.length} 条引用` : '等待回答'],
              ['确认后采用', app.lastAnswer?.answer ? '已有结果' : '未生成'],
            ].map(([label, note], index) => (
              <span key={label}>
                <b>{index + 1}</b>
                <em>{label}</em>
                <small>{note}</small>
              </span>
            ))}
          </div>

          <div className="priority-list" aria-label="优先事项">
            <div className="priority-list-head">
              <span>优先事项</span>
              <b>{app.status.text}</b>
            </div>
            {priorityRows.map((row) => (
              <PriorityRow key={row.title} {...row} />
            ))}
          </div>
      </section>

      <aside className="home-card-grid" aria-label="实时状态">
        <HomeSignalCard
          icon={MessageCircle}
          title="会话"
          value={app.messages.length}
          note="保存在本机浏览器"
          progress={Math.min(100, 18 + app.messages.length * 10)}
        />
        <HomeSignalCard
          icon={Database}
          title="资料"
          value={citations.length}
          note={citations.length ? '来自最近一次知识回答' : '等待真实引用'}
          progress={Math.min(100, citations.length * 20)}
        />
        <section className="home-card home-card-live">
            <div className="home-card-kicker">
              <Brain size={18} />
              <span>当前模式</span>
            </div>
            <strong>{modeLabel(app.mode)}</strong>
            <p>{app.lastAnswer?.answer ? '最近结果已生成，可在消息页继续编辑。' : '发送前可以切换助手编排、知识引用或直接回复。'}</p>
            <div className="home-card-progress" style={{ '--progress': `${progress}%` }} />
            <div className="home-card-row">
              <span>用户</span>
              <b>{app.userId || '-'}</b>
            </div>
            <div className="home-card-row">
              <span>会话</span>
              <b>{app.sessionId || '-'}</b>
            </div>
        </section>
      </aside>
    </div>
  );
}

function PriorityRow({ icon: Icon, title, text, meta, action }) {
  return (
    <button className="priority-row" type="button" onClick={action}>
      <span className="priority-dot"><Icon size={16} /></span>
      <span>
        <strong>{title}</strong>
        <small>{text}</small>
      </span>
      <b>{meta}</b>
    </button>
  );
}

function HomeSignalCard({ icon: Icon, title, value, note, progress }) {
  return (
    <section className="home-card">
        <div className="home-card-kicker">
          <Icon size={18} />
          <span>{title}</span>
        </div>
        <strong>{value}</strong>
        <p>{note}</p>
        <div className="home-card-progress" style={{ '--progress': `${progress}%` }} />
    </section>
  );
}

function ChatView({ app }) {
  return (
    <div className="chat-workspace chat-layout">
      <ConversationList app={app} />
      <ChatRoom app={app} />
      <AssistantSummary app={app} />
    </div>
  );
}

function ConversationList({ app }) {
  const [query, setQuery] = useState('');
  const rows = [
    {
      id: 'current',
      title: '当前会话',
      text: app.messages.at(-1)?.text || '开始一段新的沟通',
      icon: MessageCircle,
      action: () => app.navigate('chat'),
      count: Math.max(0, app.messages.filter((item) => item.role === 'user').length),
    },
    {
      id: 'knowledge',
      title: '知识问答',
      text: '切到知识模式并引用已入库资料',
      icon: Database,
      action: () => { app.setAssistantTab('knowledge'); app.navigate('agent'); },
    },
    {
      id: 'ingest',
      title: '导入资料',
      text: '上传文件、粘贴文本或读取本地路径',
      icon: FileUp,
      action: () => { app.setAssistantTab('ingest'); app.navigate('agent'); },
    },
    {
      id: 'settings',
      title: '连接设置',
      text: '服务地址、用户、会话和主题',
      icon: Settings,
      action: () => app.navigate('settings'),
    },
  ].filter((item) => `${item.title}${item.text}`.includes(query.trim()));

  return (
    <Card className="work-panel conversation-list">
      <Card.Content>
        <PanelHeader eyebrow="工作区" title="消息上下文">
          <Button isIconOnly variant="bordered" className="icon-button" aria-label="清空当前对话" onPress={() => app.setMessages([welcomeMessage])}>
            <Archive size={17} />
          </Button>
        </PanelHeader>
        <Input
          className="search-input"
          placeholder="搜索当前入口"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          startContent={<Search size={17} />}
        />
        <div className="context-list">
          {rows.map(({ id, title, text, icon: Icon, action, count }) => (
            <button key={id} className={`context-row ${id === 'current' ? 'active' : ''}`} type="button" onClick={action}>
              <span className="context-icon"><Icon size={18} /></span>
              <span>
                <strong>{title}</strong>
                <small>{text}</small>
              </span>
              {typeof count === 'number' && <b>{count}</b>}
            </button>
          ))}
        </div>
      </Card.Content>
    </Card>
  );
}

function ChatRoom({ app }) {
  const feedRef = useRef(null);

  useEffect(() => {
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight, behavior: 'smooth' });
  }, [app.messages]);

  return (
    <Card className="work-panel chat-main">
      <Card.Content>
        <div className="room-header">
          <div>
            <p className="eyebrow">真实会话 / 智能辅助</p>
            <h1>当前会话</h1>
            <p>用户 {app.userId || '-'} · 会话 {app.sessionId || '-'}</p>
          </div>
          <div className="room-state">
            <Chip className="quiet-chip">{modeLabel(app.mode)}</Chip>
            <Chip className={`status-chip ${app.status.state}`}>
              <StatusIcon state={app.status.state} />
              <span>{app.status.text}</span>
            </Chip>
          </div>
        </div>

        <ModePicker mode={app.mode} onChange={app.setMode} />

        <div className={`message-feed ${app.status.state === 'busy' ? 'is-busy' : ''}`} ref={feedRef} aria-live="polite">
          {app.messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))}
        </div>

        <Composer app={app} />
      </Card.Content>
    </Card>
  );
}

function MessageBubble({ message }) {
  const isUser = message.role === 'user';
  const isThinking = !isUser && (!message.text || message.text === '正在整理...' || message.text === '正在生成...');
  return (
    <article className={`message-row ${isUser ? 'from-user' : 'from-assistant'}`}>
      {!isUser && (
        <Avatar className="avatar-blue" size="sm"><Avatar.Fallback>AI</Avatar.Fallback></Avatar>
      )}
      <div className="bubble-wrap">
        <div className="bubble-meta">
          <strong>{message.author}</strong>
          <time>{message.time}</time>
        </div>
        <div className={`message-bubble ${isThinking ? 'thinking-bubble' : ''}`}>
          {isThinking ? <TypingDots text={message.text || '正在生成'} /> : message.text}
        </div>
      </div>
    </article>
  );
}

function TypingDots({ text }) {
  return (
    <span className="typing-indicator">
      <span>{text}</span>
      <i />
      <i />
      <i />
    </span>
  );
}

function ModePicker({ mode, onChange }) {
  return (
    <div className="mode-strip" aria-label="回复模式">
      {assistantModes.map(({ id, label, icon: Icon, hint }) => (
        <button key={id} type="button" className={mode === id ? 'active' : ''} aria-pressed={mode === id} onClick={() => onChange(id)}>
          <Icon size={16} />
          <span>{label}</span>
          <small>{hint}</small>
        </button>
      ))}
    </div>
  );
}

function Composer({ app }) {
  const busy = app.status.state === 'busy';
  const canSend = app.prompt.trim() && app.identity.userId && app.identity.sessionId && !busy;
  const currentMode = assistantModes.find((item) => item.id === app.mode) || assistantModes[0];
  const CurrentModeIcon = currentMode.icon;
  const count = app.prompt.length;

  function onKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      app.submitPrompt();
    }
  }

  return (
    <div className={`composer ${busy ? 'is-busy' : ''}`}>
      <div className="composer-head">
        <span className="composer-mode">
          <CurrentModeIcon size={15} />
          {modeLabel(app.mode)}
        </span>
        <span className={`composer-status ${app.status.state}`}>
          {busy ? <Spinner size="sm" /> : <StatusIcon state={canSend ? 'ok' : app.status.state} />}
          {busy ? app.status.text : canSend ? '准备发送' : '等待输入'}
        </span>
      </div>
      <TextArea
        className="composer-input"
        value={app.prompt}
        onChange={(event) => app.setPrompt(event.target.value)}
        onKeyDown={onKeyDown}
        placeholder="输入要回复、总结或查询的真实内容"
        minRows={2}
        maxLength={500}
        fullWidth
      />
      <div className="composer-footer">
        <div className="composer-meta">
          <span>Enter 发送，Shift + Enter 换行</span>
          <b>{count}/500</b>
        </div>
        <div className="composer-actions">
          <Button variant="bordered" className="secondary-button" onPress={() => { app.setAssistantTab('ingest'); app.navigate('agent'); }}>
            <Paperclip size={16} />
            添加资料
          </Button>
          <Button variant="bordered" className="secondary-button" onPress={() => app.setMode('knowledge')}>
            <Database size={16} />
            引用资料
          </Button>
          <Button variant="bordered" className="secondary-button stream-action" onPress={() => app.submitPrompt({ stream: true })} isDisabled={!canSend || app.mode !== 'direct'}>
            <RefreshCw size={16} />
            流式
          </Button>
          <Button color="primary" className="primary-button send-button" onPress={() => app.submitPrompt()} isDisabled={!canSend} isLoading={busy}>
            <Send size={18} />
            发送
          </Button>
        </div>
      </div>
    </div>
  );
}

function AssistantSummary({ app }) {
  const citations = app.lastAnswer?.citations || [];
  const trace = app.lastAnswer?.trace || extractTrace(app.lastAnswer);
  return (
    <Card className="work-panel assistant-side assistant-panel">
      <Card.Content>
        <PanelHeader eyebrow="智能辅助" title="智能助手">
          <Chip className={`status-chip ${app.status.state}`}>
            <StatusIcon state={app.status.state} />
            <span>{app.status.text}</span>
          </Chip>
        </PanelHeader>
        <SummaryBlock title="最近结果">
          {app.lastAnswer?.answer ? app.lastAnswer.answer.slice(0, 140) : '还没有生成结果。发送内容后，摘要会出现在这里。'}
        </SummaryBlock>
        <SummaryBlock title="知识引用">
          {citations.length ? `已返回 ${citations.length} 条引用。` : '知识模式会展示可追溯来源。'}
        </SummaryBlock>
        <SummaryBlock title="处理步骤">
          {trace.length ? `记录到 ${trace.length} 个步骤。` : '助手编排会保留计划、行动和观察。'}
        </SummaryBlock>
        <div className="summary-actions">
          <Button variant="bordered" className="secondary-button" onPress={() => app.navigate('agent')}>查看</Button>
          <Button color="primary" className="primary-button" onPress={() => app.setPrompt(app.lastAnswer?.answer || app.prompt)} isDisabled={!app.lastAnswer?.answer}>采用</Button>
        </div>
      </Card.Content>
    </Card>
  );
}

function SummaryBlock({ title, children }) {
  return (
    <section className="summary-block">
      <h3>{title}</h3>
      <p>{children}</p>
    </section>
  );
}

function AgentView({ app }) {
  if (app.assistantTab === 'conversation') {
    return <AgentConversationView app={app} />;
  }

  return (
    <div className="agent-layout">
      <section className="agent-command-card agent-hero">
          <div className="agent-command-header">
            <div>
              <p className="eyebrow">Infinite 助手</p>
              <h1>把对话、资料、记忆放进同一个处理流程。</h1>
              <p>输入目标后，助手会按当前模式生成结果，并把引用、状态和可采用内容留在工作区里。</p>
            </div>
            <div className="command-strip" aria-label="助手能力">
              {assistantTabs.map(({ id, label, icon: Icon }) => (
                <button key={id} type="button" className={app.assistantTab === id ? 'active' : ''} aria-pressed={app.assistantTab === id} onClick={() => app.setAssistantTab(id)}>
                  <Icon size={17} />
                  {label}
                </button>
              ))}
            </div>
          </div>
          <AgentFlow app={app} />
      </section>

      {app.assistantTab === 'conversation' && <AssistantConversation app={app} />}
      {app.assistantTab === 'knowledge' && <KnowledgePanel app={app} />}
      {app.assistantTab === 'ingest' && <IngestPanel app={app} />}
      {app.assistantTab === 'memory' && <MemoryPanel app={app} />}
    </div>
  );
}

function AgentConversationView({ app }) {
  return (
    <div className="agent-conversation-layout">
      <section className="agent-command-card agent-hero">
        <div className="agent-command-header">
          <div>
            <p className="eyebrow">Infinite 助手</p>
            <h1>把对话、资料、记忆放进同一个处理流程。</h1>
            <p>输入目标后，助手会按当前模式生成结果，并把引用、状态和可采用内容留在工作区里。</p>
          </div>
        </div>
        <AgentFlow app={app} />
        <ModePicker mode={app.mode} onChange={app.setMode} />
        <TextArea
          className="agent-prompt"
          minRows={5}
          placeholder="写下需要处理的消息、背景或问题"
          value={app.prompt}
          onChange={(event) => app.setPrompt(event.target.value)}
        />
        <div className="agent-live-preview">
          <span>{app.status.text}</span>
          <p>{app.lastAnswer?.answer ? app.lastAnswer.answer.slice(0, 180) : '生成后，最新结果会先在这里预览；你可以回到消息页继续编辑或采用。'}</p>
        </div>
        <div className="button-row">
          <Button color="primary" className="primary-button" onPress={() => app.submitPrompt()} isDisabled={!app.prompt.trim() || app.status.state === 'busy'}>
            <Sparkles size={18} />
            生成建议
          </Button>
          <Button variant="bordered" className="secondary-button" onPress={() => app.navigate('chat')}>
            <MessageCircle size={18} />
            回到消息
          </Button>
        </div>
      </section>
      <aside className="agent-side-panel">
        <div className="command-strip" aria-label="助手能力">
          {assistantTabs.map(({ id, label, icon: Icon }) => (
            <button key={id} type="button" className={app.assistantTab === id ? 'active' : ''} aria-pressed={app.assistantTab === id} onClick={() => app.setAssistantTab(id)}>
              <Icon size={17} />
              {label}
            </button>
          ))}
        </div>
        <h2>采用前确认</h2>
        <p className="muted">助手只给建议，最终发送和保存都由你确认。</p>
        <CheckRow text="保留当前会话上下文" />
        <CheckRow text="知识模式显示引用依据" />
        <CheckRow text="失败时保留错误信息" />
        <Button fullWidth color="primary" className="primary-button" onPress={() => app.navigate('chat')}>打开消息页</Button>
      </aside>
    </div>
  );
}

function AgentFlow({ app }) {
  const hasPrompt = Boolean(app.prompt.trim());
  const hasResult = Boolean(app.lastAnswer?.answer);
  const rows = [
    { title: '整理目标', text: hasPrompt ? '已收到待处理内容' : '等待输入真实内容', done: hasPrompt, active: !hasPrompt },
    { title: '调用能力', text: `当前模式：${modeLabel(app.mode)}`, done: hasResult, active: app.status.state === 'busy' },
    { title: '核对结果', text: hasResult ? '已有可采用结果' : '生成后展示摘要和引用', done: hasResult, active: false },
  ];

  return (
    <div className="agent-flow" aria-label="助手处理状态">
      {rows.map((row, index) => (
        <div key={row.title} className={`agent-flow-step ${row.done ? 'done' : ''} ${row.active ? 'active' : ''}`}>
          <b>{index + 1}</b>
          <span>
            <strong>{row.title}</strong>
            <small>{row.text}</small>
          </span>
        </div>
      ))}
    </div>
  );
}

function AssistantConversation({ app }) {
  return (
    <div className="utility-grid">
      <Card className="work-panel utility-main">
        <Card.Content>
          <PageHeading
            eyebrow="对话处理"
            title="生成前先整理目标，生成后再确认采用。"
            text="这里和消息页共用同一个输入框状态，你可以直接输入并让助手处理。"
          />
          <ModePicker mode={app.mode} onChange={app.setMode} />
          <TextArea
            className="agent-prompt"
            minRows={5}
            placeholder="写下需要处理的消息、背景或问题"
            value={app.prompt}
            onChange={(event) => app.setPrompt(event.target.value)}
          />
          <div className="agent-live-preview">
            <span>{app.status.text}</span>
            <p>{app.lastAnswer?.answer ? app.lastAnswer.answer.slice(0, 180) : '生成后，最新结果会先在这里预览；你可以回到消息页继续编辑或采用。'}</p>
          </div>
          <div className="button-row">
            <Button color="primary" className="primary-button" onPress={() => app.submitPrompt()} isDisabled={!app.prompt.trim() || app.status.state === 'busy'}>
              <Sparkles size={18} />
              生成建议
            </Button>
            <Button variant="bordered" className="secondary-button" onPress={() => app.navigate('chat')}>
              <MessageCircle size={18} />
              回到消息
            </Button>
          </div>
        </Card.Content>
      </Card>
      <Card className="work-panel utility-side">
        <Card.Content>
          <h2>采用前确认</h2>
          <p className="muted">助手只给建议，最终发送和保存都由你确认。</p>
          <CheckRow text="保留当前会话上下文" />
          <CheckRow text="知识模式显示引用依据" />
          <CheckRow text="失败时保留错误信息" />
          <Button fullWidth color="primary" className="primary-button" onPress={() => app.navigate('chat')}>打开消息页</Button>
        </Card.Content>
      </Card>
    </div>
  );
}

function KnowledgePanel({ app }) {
  const citations = app.lastAnswer?.citations || [];
  return (
    <div className="utility-grid">
      <Card className="work-panel utility-main">
        <Card.Content>
          <PageHeading
            eyebrow="知识问答"
            title="从已导入资料里找到有依据的答案。"
            text="切换到知识引用模式后提问，回答会尽量返回命中状态和引用片段。"
          />
          <div className="button-row">
            <Button color="primary" className="primary-button" onPress={() => { app.setMode('knowledge'); app.navigate('chat'); }}>
              <Database size={18} />
              去提问
            </Button>
            <Button variant="bordered" className="secondary-button" onPress={() => app.setAssistantTab('ingest')}>
              <FileUp size={18} />
              导入资料
            </Button>
          </div>
          <div className="citation-list">
            {citations.length ? citations.map((item, index) => (
              <article key={`${item.source || 'source'}-${index}`}>
                <b>{index + 1}</b>
                <div>
                  <strong>{item.title || item.source || '资料片段'}</strong>
                  <p>{item.snippet || item.content || '该引用没有返回摘要。'}</p>
                </div>
              </article>
            )) : (
              <EmptyLine icon={Database} title="还没有引用资料" text="完成一次知识问答后，这里会展示来源、摘要和引用片段。" />
            )}
          </div>
        </Card.Content>
      </Card>
      <Card className="work-panel utility-side">
        <Card.Content>
          <h2>回答状态</h2>
          <StatusList answer={app.lastAnswer} />
        </Card.Content>
      </Card>
    </div>
  );
}

function IngestPanel({ app }) {
  const [file, setFile] = useState(null);
  const [textTitle, setTextTitle] = useState('');
  const [textContent, setTextContent] = useState('');
  const [localPath, setLocalPath] = useState('');
  const [jobs, setJobs] = useState([]);

  async function track(job) {
    if (!job?.jobId) return;
    setJobs((items) => [job, ...items.filter((item) => item.jobId !== job.jobId)]);
  }

  async function uploadFile() {
    if (!file) return;
    app.setStatus({ state: 'busy', text: '导入中' });
    try {
      const body = new FormData();
      body.append('file', file);
      const job = await requestJson(app.apiBase, '/rag/documents/upload', { method: 'POST', body });
      track(job);
      app.setStatus({ state: 'ok', text: '已开始导入' });
    } catch (error) {
      app.setStatus({ state: 'error', text: error.message });
    }
  }

  async function uploadText() {
    if (!textContent.trim()) return;
    app.setStatus({ state: 'busy', text: '保存中' });
    try {
      const job = await requestJson(app.apiBase, '/rag/documents/text', {
        method: 'POST',
        body: JSON.stringify({
          title: textTitle || '手动资料',
          fileName: `${textTitle || 'manual-note'}.md`,
          content: textContent,
          sourceType: 'manual_text',
        }),
      });
      track(job);
      app.setStatus({ state: 'ok', text: '已开始导入' });
    } catch (error) {
      app.setStatus({ state: 'error', text: error.message });
    }
  }

  async function ingestLocal() {
    if (!localPath.trim()) return;
    app.setStatus({ state: 'busy', text: '读取中' });
    try {
      const job = await requestJson(app.apiBase, `/rag/documents/local-ingest?path=${encodeURIComponent(localPath.trim())}`, {
        method: 'POST',
      });
      track(job);
      app.setStatus({ state: 'ok', text: '已开始导入' });
    } catch (error) {
      app.setStatus({ state: 'error', text: error.message });
    }
  }

  async function refreshJob(jobId) {
    try {
      const job = await requestJson(app.apiBase, `/rag/documents/jobs/${jobId}`);
      setJobs((items) => items.map((item) => (item.jobId === jobId ? job : item)));
    } catch (error) {
      app.setStatus({ state: 'error', text: error.message });
    }
  }

  return (
    <div className="utility-grid">
      <Card className="work-panel utility-main">
        <Card.Content>
          <PageHeading eyebrow="导入资料" title="把可引用内容放进知识库。" text="支持文件、粘贴文本和本地路径。任务返回后会显示在右侧列表。" />
          <div className="ingest-grid">
            <section>
              <h3><Upload size={18} /> 上传文件</h3>
              <Input type="file" onChange={(event) => setFile(event.target.files?.[0] || null)} />
              <Button color="primary" className="primary-button" onPress={uploadFile} isDisabled={!file}>开始导入</Button>
            </section>
            <section>
              <h3><Archive size={18} /> 粘贴资料</h3>
              <Input placeholder="资料标题" value={textTitle} onChange={(event) => setTextTitle(event.target.value)} />
              <TextArea minRows={5} placeholder="粘贴需要入库的内容" value={textContent} onChange={(event) => setTextContent(event.target.value)} />
              <Button color="primary" className="primary-button" onPress={uploadText} isDisabled={!textContent.trim()}>保存并导入</Button>
            </section>
            <section>
              <h3><FileUp size={18} /> 本地路径</h3>
              <Input placeholder="例如 src/main/resources/docs" value={localPath} onChange={(event) => setLocalPath(event.target.value)} />
              <Button variant="bordered" className="secondary-button" onPress={ingestLocal} isDisabled={!localPath.trim()}>读取路径</Button>
            </section>
          </div>
        </Card.Content>
      </Card>
      <Card className="work-panel utility-side">
        <Card.Content>
          <h2>导入任务</h2>
          <div className="job-list">
            {jobs.length ? jobs.map((job) => (
              <article key={job.jobId}>
                <div>
                  <strong>{job.fileName || job.path || job.jobId}</strong>
                  <p>{job.message || job.status}</p>
                </div>
                <Button size="sm" variant="bordered" className="icon-button" isIconOnly onPress={() => refreshJob(job.jobId)} aria-label="刷新任务">
                  <RefreshCw size={15} />
                </Button>
              </article>
            )) : (
              <EmptyLine icon={Archive} title="暂无导入任务" text="上传文件或粘贴资料后，任务会显示在这里。" />
            )}
          </div>
        </Card.Content>
      </Card>
    </div>
  );
}

function MemoryPanel({ app }) {
  const [memoryText, setMemoryText] = useState('');
  const [memories, setMemories] = useState([]);

  async function writeMemory() {
    if (!memoryText.trim()) return;
    app.setStatus({ state: 'busy', text: '保存中' });
    try {
      await requestJson(app.apiBase, '/memory/write', {
        method: 'POST',
        body: JSON.stringify({
          userId: app.identity.userId,
          content: memoryText,
          memoryType: 'PREFERENCE',
          source: 'USER',
        }),
      });
      setMemoryText('');
      app.setStatus({ state: 'ok', text: '记忆已保存' });
      await loadMemories();
    } catch (error) {
      app.setStatus({ state: 'error', text: error.message });
    }
  }

  async function loadMemories() {
    try {
      const list = await requestJson(app.apiBase, `/memory/user/${app.identity.userId}?limit=8`);
      setMemories(Array.isArray(list) ? list : []);
      app.setStatus({ state: 'ok', text: '记忆已刷新' });
    } catch (error) {
      app.setStatus({ state: 'error', text: error.message });
    }
  }

  return (
    <div className="utility-grid">
      <Card className="work-panel utility-main">
        <Card.Content>
          <PageHeading eyebrow="记忆空间" title="保存会影响后续回答的偏好。" text="写入前请确认这是长期有效的偏好或背景。" />
          <TextArea minRows={6} placeholder="例如：回复时先给结论，再补充依据。" value={memoryText} onChange={(event) => setMemoryText(event.target.value)} />
          <div className="button-row">
            <Button color="primary" className="primary-button" onPress={writeMemory} isDisabled={!memoryText.trim()}>保存记忆</Button>
            <Button variant="bordered" className="secondary-button" onPress={loadMemories}>查看记忆</Button>
          </div>
        </Card.Content>
      </Card>
      <Card className="work-panel utility-side">
        <Card.Content>
          <h2>已保存</h2>
          <div className="memory-list">
            {memories.length ? memories.map((item) => (
              <article key={item.id || item.memoryId || item.content}>
                <strong>{item.memoryType || '记忆'}</strong>
                <p>{item.content}</p>
              </article>
            )) : (
              <EmptyLine icon={Brain} title="还没有展示记忆" text="保存或刷新后，长期记忆会出现在这里。" />
            )}
          </div>
        </Card.Content>
      </Card>
    </div>
  );
}

function ContactsView({ app }) {
  return (
    <div className="utility-grid">
      <Card className="work-panel utility-main">
        <Card.Content>
          <PageHeading eyebrow="联系人" title="真实联系人会在接入账号后显示。" text="这里不放置虚构联系人。接入通讯录或登录后，会展示联系人、群组和请求。" />
          <div className="signal-strip">
            <span><b>0</b>联系人</span>
            <span><b>0</b>新请求</span>
            <span><b>0</b>群组</span>
          </div>
          <EmptyLine icon={Users} title="等待真实数据" text="当前会话仍可通过消息页和助手页处理真实输入。" />
        </Card.Content>
      </Card>
      <Card className="work-panel utility-side">
        <Card.Content>
          <h2>接入状态</h2>
          <CheckRow text={`用户 ${app.userId || '-'}`} />
          <CheckRow text={`会话 ${app.sessionId || '-'}`} />
          <CheckRow text="联系人数据未接入" />
          <Button fullWidth color="primary" className="primary-button" onPress={() => app.navigate('settings')}>打开设置</Button>
        </Card.Content>
      </Card>
    </div>
  );
}

function DiscoverView({ app }) {
  return (
    <div className="utility-grid">
      <Card className="work-panel utility-main">
        <Card.Content>
          <PageHeading eyebrow="发现" title="把常用能力变成可继续的工作流。" text="这里保留可执行入口，不放置虚构推荐动态。" />
          <div className="workflow-list">
            <WorkflowCard icon={MessageCircle} title="整理会话" text="把当前输入变成摘要、回复和下一步。" action={() => app.navigate('chat')} />
            <WorkflowCard icon={Database} title="知识问答" text="对入库资料提问，并保留引用依据。" action={() => { app.setAssistantTab('knowledge'); app.navigate('agent'); }} />
            <WorkflowCard icon={FileUp} title="导入资料" text="上传文档或粘贴文本，后续回答可引用。" action={() => { app.setAssistantTab('ingest'); app.navigate('agent'); }} />
            <WorkflowCard icon={Brain} title="保存偏好" text="把长期有效的偏好写入记忆空间。" action={() => { app.setAssistantTab('memory'); app.navigate('agent'); }} />
          </div>
        </Card.Content>
      </Card>
      <Card className="work-panel utility-side">
        <Card.Content>
          <h2>使用节奏</h2>
          <OpenRow icon={MessageCircle} title="先输入" text="从一条真实消息或问题开始。" />
          <OpenRow icon={Sparkles} title="再生成" text="选择助手、知识或直接回复。" />
          <OpenRow icon={CheckCircle2} title="后确认" text="采用前可以继续编辑。" />
        </Card.Content>
      </Card>
    </div>
  );
}

function SettingsView({ app }) {
  const [checking, setChecking] = useState(false);
  const [health, setHealth] = useState('');

  async function checkHealth() {
    setChecking(true);
    try {
      const data = await requestJson(app.apiBase, '/actuator/health');
      setHealth(data?.status || '已连接');
      app.setStatus({ state: 'ok', text: '连接正常' });
    } catch (error) {
      setHealth(error.message);
      app.setStatus({ state: 'error', text: '连接异常' });
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="utility-grid settings-layout">
      <Card className="work-panel utility-main">
        <Card.Content>
          <PageHeading eyebrow="设置" title="工作台偏好" text="保持应用可用、界面清爽，重要动作由你确认。" />
          <div className="settings-control-strip">
            <label>
              <span>服务地址</span>
              <Input value={app.apiBase} onChange={(event) => app.setApiBase(trimSlash(event.target.value))} />
            </label>
            <label>
              <span>用户</span>
              <Input value={app.userId} onChange={(event) => app.setUserId(event.target.value)} />
            </label>
            <label>
              <span>会话</span>
              <Input value={app.sessionId} onChange={(event) => app.setSessionId(event.target.value)} />
            </label>
          </div>
          <div className="settings-list">
            <SettingRow title="纯黑夜间模式" note="深色模式保持纯黑背景">
              <Switch isSelected={app.theme === 'dark'} onChange={() => app.setTheme(app.theme === 'dark' ? 'light' : 'dark')} />
            </SettingRow>
            <SettingRow title="清空当前对话" note="只清除本机浏览器里的会话记录">
              <Button variant="bordered" className="secondary-button" onPress={() => app.setMessages([welcomeMessage])}>清空</Button>
            </SettingRow>
            <SettingRow title="连接检查" note={health || '检查当前服务地址是否可用'}>
              <Button color="primary" className="primary-button" onPress={checkHealth} isLoading={checking}>检查</Button>
            </SettingRow>
          </div>
        </Card.Content>
      </Card>
      <Card className="work-panel utility-side">
        <Card.Content>
          <h2>账户状态</h2>
          <CheckRow text={`用户 ${app.userId || '-'}`} />
          <CheckRow text={`会话 ${app.sessionId || '-'}`} />
          <CheckRow text={health || '等待检查'} />
        </Card.Content>
      </Card>
    </div>
  );
}

function ConnectionDialog({ app, onClose }) {
  return (
    <div className="dialog-backdrop" role="dialog" aria-modal="true">
      <Card className="connection-dialog">
        <Card.Content>
          <PanelHeader eyebrow="账户与连接" title="确认当前连接">
            <Button isIconOnly variant="bordered" className="icon-button" onPress={onClose} aria-label="关闭">
              <X size={16} />
            </Button>
          </PanelHeader>
          <label className="dialog-field">
            <span>服务地址</span>
            <Input value={app.apiBase} onChange={(event) => app.setApiBase(trimSlash(event.target.value))} />
          </label>
          <div className="dialog-grid">
            <label>
              <span>用户</span>
              <Input value={app.userId} onChange={(event) => app.setUserId(event.target.value)} />
            </label>
            <label>
              <span>会话</span>
              <Input value={app.sessionId} onChange={(event) => app.setSessionId(event.target.value)} />
            </label>
          </div>
          <Button color="primary" className="primary-button" fullWidth onPress={onClose}>完成</Button>
        </Card.Content>
      </Card>
    </div>
  );
}

function PageHeading({ eyebrow, title, text }) {
  return (
    <div className="page-heading">
      <p className="eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      {text && <p>{text}</p>}
    </div>
  );
}

function PanelHeader({ eyebrow, title, children }) {
  return (
    <div className="panel-title-row">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
      </div>
      {children}
    </div>
  );
}

function StepItem({ index, title, note, done, active }) {
  return (
    <article className={`step-item ${done ? 'done' : ''} ${active ? 'active' : ''}`}>
      <b>{index}</b>
      <div>
        <strong>{title}</strong>
        <p>{note}</p>
      </div>
      <span>{done ? '已完成' : active ? '进行中' : '等待'}</span>
    </article>
  );
}

function StatusList({ answer }) {
  const rows = [
    ['已回答', Boolean(answer?.answer)],
    ['命中资料', answer?.retrievalHit],
    ['需要追问', answer?.needFollowUp],
    ['策略', answer?.strategy || modeLabel(answer?.mode)],
  ];
  return (
    <div className="status-list">
      {rows.map(([label, value]) => (
        <div key={label}>
          <span>{label}</span>
          <b>{typeof value === 'boolean' ? (value ? '是' : '否') : value || '-'}</b>
        </div>
      ))}
    </div>
  );
}

function MetricRow({ icon: Icon, title, value, note }) {
  return (
    <article className="metric-row">
      <Icon size={18} />
      <div>
        <strong>{title}</strong>
        <p>{note}</p>
      </div>
      <b>{value}</b>
    </article>
  );
}

function WorkflowCard({ icon: Icon, title, text, action }) {
  return (
    <article className="workflow-card">
      <Icon size={20} />
      <div>
        <h3>{title}</h3>
        <p>{text}</p>
      </div>
      <Button variant="bordered" className="secondary-button" onPress={action}>打开</Button>
    </article>
  );
}

function OpenRow({ icon: Icon, title, text, meta }) {
  return (
    <article className="open-row">
      <Icon size={18} />
      <div>
        <strong>{title}</strong>
        <p>{text}</p>
      </div>
      {meta && <span>{meta}</span>}
    </article>
  );
}

function EmptyLine({ icon: Icon, title, text }) {
  return (
    <div className="empty-line">
      <Icon size={20} />
      <div>
        <strong>{title}</strong>
        <p>{text}</p>
      </div>
    </div>
  );
}

function CheckRow({ text }) {
  return (
    <div className="check-row">
      <CheckCircle2 size={16} />
      <span>{text}</span>
    </div>
  );
}

function SettingRow({ title, note, children }) {
  return (
    <article className="setting-row">
      <div>
        <strong>{title}</strong>
        <p>{note}</p>
      </div>
      {children}
    </article>
  );
}

function modeLabel(mode) {
  return assistantModes.find((item) => item.id === mode)?.label || '-';
}

createRoot(document.getElementById('root')).render(<App />);
