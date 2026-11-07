import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity, AlertTriangle, ArrowRight, Bell, BrainCircuit,
  Check, CheckCircle2, ChevronDown, ChevronRight, CircleHelp, ExternalLink,
  Eye, FileSearch, Gauge, Globe2, KeyRound, Layers3, Loader2,
  LogOut, Menu, MessageSquareText, MoreHorizontal, Moon, Sun, Play, Plus, RefreshCw, Search,
  Settings2, ShieldCheck, Sparkles, Target, Trash2, TrendingUp, X, Zap, Wrench, Filter,
} from 'lucide-react';
import { api, setProviderKeys, setToken } from './lib/api';
import { IntentPage, DiagnosticsPage, NotificationsPage, PromptEditorModal } from './WorkspacePages';

const NAV = [
  { label: 'WORKSPACE', items: [
    { id: 'overview', label: 'Overview', icon: Gauge },
    { id: 'prompts', label: 'Prompt library', icon: MessageSquareText },
    { id: 'runs', label: 'Tracking', icon: Activity },
    { id: 'analysis', label: 'Run analysis', icon: BrainCircuit },
  ]},
  { label: 'INTELLIGENCE', items: [
    { id: 'sources', label: 'Sources & citations', icon: FileSearch },
    { id: 'competitors', label: 'Competitors', icon: Layers3 },
    { id: 'diagnostics', label: 'Diagnostics', icon: Wrench },
  ]},
];

const PROVIDER_PRESETS = [
  { id: 'openai', name: 'ChatGPT', model: 'OR: openai/gpt-4o-mini', route: 'OpenRouter', mark: 'O', icon: 'openai' },
  { id: 'gemini', name: 'Gemini', model: 'OR: google/gemini-2.5-flash', route: 'OpenRouter', mark: '✦', icon: 'googlegemini' },
  { id: 'claude', name: 'Claude', model: 'OR: anthropic/claude-3.5-sonnet', route: 'OpenRouter', mark: 'A', icon: 'claude' },
  { id: 'perplexity', name: 'Perplexity', model: 'OR: perplexity/sonar-pro', route: 'OpenRouter', mark: 'P', icon: 'perplexity' },
  { id: 'groq', name: 'Groq', model: 'GROQ: llama-3.3-70b-versatile', route: 'Groq', mark: 'G', iconUrl: 'https://groq.com/favicon.ico' },
  { id: 'deepseek', name: 'DeepSeek', model: 'DS: deepseek-chat', route: 'DeepSeek', mark: 'D', icon: 'deepseek' },
];

const cx = (...parts) => parts.filter(Boolean).join(' ');
const pct = (v) => `${Number(v || 0).toFixed(1).replace(/\.0$/, '')}%`;
const number = (v) => new Intl.NumberFormat('en-US').format(Number(v || 0));
const shortDate = (value) => value ? new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '—';
const dateTime = (value) => value ? new Date(value).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—';
const domainName = (value = '') => { const raw=String(value||'').trim(); if(!raw)return ''; try { return new URL(raw.includes('://')?raw:`https://${raw}`).hostname.replace(/^www\./i,'').toLowerCase(); } catch { return raw.replace(/^https?:\/\//i,'').replace(/^www\./i,'').split('/')[0].toLowerCase(); } };
const matchesOwnDomain = (sourceDomain, domains=[]) => { const source=domainName(sourceDomain); return (Array.isArray(domains)?domains:[domains]).some(value=>{const target=domainName(value);return target && (source===target || source.endsWith(`.${target}`));}); };
const sentimentTone = (value = '') => value.toLowerCase().includes('pos') ? 'positive' : value.toLowerCase().includes('neg') ? 'negative' : 'neutral';

function BrandMark() {
  return <div className="brand-mark"><span className="brand-wave"><i /><i /><i /><i /><i /></span></div>;
}

function ProviderMark({ provider }) {
  const src = provider.icon ? `https://cdn.simpleicons.org/${provider.icon}` : provider.iconUrl;
  return <span className={`provider-mark provider-${provider.id}`} data-provider={provider.id}>{src && <img src={src} alt="" loading="lazy" onLoad={e => { e.currentTarget.parentElement.dataset.logo = 'true'; }} onError={e => e.currentTarget.remove()} />}<span>{provider.mark}</span></span>;
}

function IconButton({ icon: Icon, label, onClick, className = '', disabled = false }) {
  return <button className={cx('icon-button', className)} onClick={onClick} aria-label={label} title={label} disabled={disabled}><Icon size={17} strokeWidth={1.8} /></button>;
}

function Button({ children, icon: Icon, variant = 'primary', size = '', onClick, disabled = false, type = 'button', className = '' }) {
  return <button type={type} className={cx('button', `button-${variant}`, size && `button-${size}`, className)} onClick={onClick} disabled={disabled}>{Icon && <Icon size={16} strokeWidth={1.9} />}{children}</button>;
}

function StatusPill({ status }) {
  const key = (status || 'unknown').toLowerCase();
  const label = key === 'done' ? 'Completed' : key === 'running' ? 'Running' : key === 'queued' ? 'Queued' : key === 'failed' ? 'Failed' : key;
  return <span className={`status-pill status-${key}`}><i />{label}</span>;
}

function EmptyState({ icon: Icon = FileSearch, title, description, action }) {
  return <div className="empty-state"><div className="empty-icon"><Icon size={22} /></div><h3>{title}</h3><p>{description}</p>{action}</div>;
}

function SectionHeading({ eyebrow, title, description, action }) {
  return <div className="section-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1>{description && <p>{description}</p>}</div>{action && <div className="heading-action">{action}</div>}</div>;
}

function MetricCard({ label, value, detail, icon: Icon, accent = 'blue', footnote }) {
  return <article className="metric-card"><div className="metric-top"><span>{label}</span><span className={`metric-icon metric-${accent}`}><Icon size={17} /></span></div><div className="metric-value">{value}</div><div className="metric-bottom"><span>{detail}</span>{footnote && <span className="metric-footnote">{footnote}</span>}</div></article>;
}

function VisibilityChart({ results }) {
  const series = useMemo(() => {
    const done = results.filter(r => r.status === 'done' && r.created_at).slice().sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    if (!done.length) return [];
    const groups = new Map();
    done.forEach(run => {
      const key = new Date(run.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      const entry = groups.get(key) || { label: key, total: 0, mentioned: 0 };
      entry.total += 1;
      if ((run.brand_mentions || []).length) entry.mentioned += 1;
      groups.set(key, entry);
    });
    return [...groups.values()].slice(-10).map(d => ({ ...d, value: d.total ? (d.mentioned / d.total) * 100 : 0 }));
  }, [results]);
  if (!series.length) return <div className="chart-empty"><Activity size={22} /><span>Visibility history will appear after your first tracking run.</span></div>;
  const width = 640, height = 208, left = 28, right = 14, top = 16, bottom = 34;
  const max = Math.max(100, ...series.map(s => s.value));
  const points = series.map((d, i) => ({ ...d, x: left + (series.length === 1 ? (width - left - right) / 2 : i * (width - left - right) / (series.length - 1)), y: top + (100 - d.value) / 100 * (height - top - bottom) }));
  const path = points.map((p, i) => `${i ? 'L' : 'M'} ${p.x} ${p.y}`).join(' ');
  const area = `${path} L ${points.at(-1).x} ${height - bottom} L ${points[0].x} ${height - bottom} Z`;
  return <div className="chart-wrap"><div className="chart-legend"><span><i className="legend-dot" /> Brand mention rate</span><span className="chart-period">Observed across completed runs</span></div><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Brand mention rate across completed runs"><defs><linearGradient id="visibility-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#2c756b" stopOpacity=".18"/><stop offset="100%" stopColor="#2c756b" stopOpacity="0"/></linearGradient></defs>{[0, 25, 50, 75, 100].map(v => { const y = top + (100 - v) / 100 * (height - top - bottom); return <g key={v}><line x1={left} x2={width - right} y1={y} y2={y} className="chart-grid"/><text x="0" y={y + 4} className="chart-axis">{v}%</text></g>; })}<path d={area} fill="url(#visibility-fill)"/><path d={path} className="chart-line"/>{points.map((p, i) => <g key={`${p.label}-${i}`}><circle cx={p.x} cy={p.y} r="4" className="chart-point"/><text x={p.x} y={height - 10} textAnchor="middle" className="chart-axis">{p.label}</text></g>)}</svg></div>;
}

function CitationBars({ citations, limit = 5, ownDomains = [] }) {
  const own = citations.find(x => matchesOwnDomain(x.domain, [ownDomains[0]]));
  let items = citations.slice(0, limit);
  if (own && !items.some(x => matchesOwnDomain(x.domain, [ownDomains[0]]))) items = [...items.slice(0, Math.max(0, limit - 1)), own];
  const max = Math.max(1, ...items.map(x => x.retrieved || 0));
  if (!items.length) return <div className="muted-empty">No source data yet.</div>;
  return <div className="citation-bars">{items.map((item, i) => <div className={`citation-bar-row ${matchesOwnDomain(item.domain, ownDomains)?'own-domain-row':''}`} key={item.domain}><div className={`citation-domain ${matchesOwnDomain(item.domain, ownDomains)?'own-domain':''}`}><span className="domain-rank">{String(citations.findIndex(x=>x.domain===item.domain)+1).padStart(2, '0')}</span><span>{domainName(item.domain)}{matchesOwnDomain(item.domain, ownDomains) ? <em>Your brand</em> : null}</span></div><div className="bar-track"><span style={{ width: `${Math.max(3, (item.retrieved / max) * 100)}%` }} /></div><div className="bar-count">{item.cited}<small> / {item.retrieved}</small></div></div>)}</div>;
}

function Modal({ title, subtitle, onClose, children, wide = false }) {
  return <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && onClose()}><section className={cx('modal', wide && 'modal-wide')}><header className="modal-header"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div><IconButton icon={X} label="Close dialog" onClick={onClose} /></header>{children}</section></div>;
}

function App() {
  const [tokenReady, setTokenReady] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authView, setAuthView] = useState(() => ({'/login':'login','/register':'register','/forgot-password':'reset'}[window.location.pathname] || 'landing'));
  const [authMessage, setAuthMessage] = useState('');
  const [theme, setTheme] = useState(() => localStorage.getItem('pp_theme') || 'light');
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [sidebarProfileOpen, setSidebarProfileOpen] = useState(false);
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);
  const projectMenuRef = useRef(null);
  const [notificationMenuOpen, setNotificationMenuOpen] = useState(false);
  const [projectStep, setProjectStep] = useState(1);
  const [projectConfig, setProjectConfig] = useState({ frequency: 'manual', models: ['OR: openai/gpt-4o-mini'], autoRun: false, scheduleTime: '09:00', brandContext: {} });
  const [selectedModels, setSelectedModels] = useState(['OR: openai/gpt-4o-mini']);
  const [queuedModels, setQueuedModels] = useState([]);
  const [completedProviderRuns, setCompletedProviderRuns] = useState(0);
  const [activeAnalysisRunId, setActiveAnalysisRunId] = useState(null);
  const previousVisibility = useRef(null);
  const [profile, setProfile] = useState({ username: 'demo', role: 'demo', is_demo: true });
  const [projects, setProjects] = useState([]);
  const [projectId, setProjectId] = useState(() => sessionStorage.getItem('promptpulse_project') || '');
  const [project, setProject] = useState(null);
  const [models, setModels] = useState({ default_model: '', supported_models: [] });
  const [selectedModel, setSelectedModel] = useState('');
  const [page, setPage] = useState(() => { const path=window.location.pathname.replace(/^\//,'').replace(/\/$/,''); return path && path!=='dashboard' ? path : 'overview'; });
  const [mobileNav, setMobileNav] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pageLoading, setPageLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [prompts, setPrompts] = useState([]);
  const [summary, setSummary] = useState(null);
  const [citations, setCitations] = useState([]);
  const [results, setResults] = useState([]);
  const [quota, setQuota] = useState(null);
  const [activeBatch, setActiveBatch] = useState(null);
  const [modal, setModal] = useState('');
  const [selectedRun, setSelectedRun] = useState(null);
  const [promptSearch, setPromptSearch] = useState('');
  const [runFilter, setRunFilter] = useState('all');
  const [runSearchQuery, setRunSearchQuery] = useState('');
  const [sourceSearch, setSourceSearch] = useState('');
  const [competitorSearchQuery, setCompetitorSearchQuery] = useState('');
  const [workspaceSearch, setWorkspaceSearch] = useState('');
  const [providerKeys, setKeys] = useState({ openrouter: '', groq: '', deepseek: '', tavily: '' });
  const [toast, setToast] = useState('');
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false);
  const [runForm, setRunForm] = useState({ rounds: 1, model: '' });
  const [comparePrompt, setComparePrompt] = useState('');
  const [compareReport, setCompareReport] = useState(null);
  const [compareLoading, setCompareLoading] = useState(false);
  const [variantData, setVariantData] = useState(null);
  const [variantSelected, setVariantSelected] = useState([]);
  const [variantCount, setVariantCount] = useState(5);
  const [variantTopic, setVariantTopic] = useState('');
  const [variantLoading, setVariantLoading] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [projectForm, setProjectForm] = useState({ brand_name: '', domain: '', aliases: '', competitors: '', description: '', industry: '', market: '', audience: '', topics: '' });
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [loginLoading, setLoginLoading] = useState(false);
  const [registerForm, setRegisterForm] = useState({ username: '', email: '', password: '' });
  const [resetEmail, setResetEmail] = useState('');
  const [accountMode, setAccountMode] = useState('profile');
  const [profileEdit, setProfileEdit] = useState({ username: '', email: '' });
  const [passwordChange, setPasswordChange] = useState({ current_password: '', new_password: '' });
  const [intentDetails, setIntentDetails] = useState({});
  const [intentLoading, setIntentLoading] = useState(false);
  const [cacheStats, setCacheStats] = useState(null);
  const [cacheLoading, setCacheLoading] = useState(false);
  const [apiHealth, setApiHealth] = useState(null);
  const [editingPrompt, setEditingPrompt] = useState(null);
  const [projectEdit, setProjectEdit] = useState({ brand_name: '', domain: '', aliases: '', competitors: '' });
  const [notifications, setNotifications] = useState([]);

  const notify = useCallback((message) => { setToast(message); window.setTimeout(() => setToast(''), 3200); }, []);
  const loadProjectData = useCallback(async (id, quiet = false) => {
    if (!id) return;
    if (!quiet) setPageLoading(true);
    setError('');
    const tasks = await Promise.allSettled([
      api(`/projects/${id}`), api(`/projects/${id}/prompts`), api(`/projects/${id}/summary`),
      api(`/projects/${id}/citations`), api(`/projects/${id}/results`), api(`/auth/quota/${id}`), api(`/projects/${id}/settings`),
    ]);
    const [p, pr, su, ci, re, qu, settings] = tasks;
    if (p.status === 'fulfilled') setProject(p.value);
    if (settings.status === 'fulfilled') { const cfg=settings.value; const savedModels=cfg.models?.length?cfg.models:['OR: openai/gpt-4o-mini']; setProjectConfig({models:savedModels,brandContext:cfg.brand_context||{},frequency:cfg.schedule?.frequency||'manual',autoRun:!!cfg.schedule?.enabled,scheduleTime:cfg.schedule?.time||'09:00'}); setSelectedModels(savedModels); }
    if (pr.status === 'fulfilled') setPrompts(pr.value);
    if (su.status === 'fulfilled') setSummary(su.value);
    if (ci.status === 'fulfilled') setCitations(ci.value);
    if (re.status === 'fulfilled') setResults(re.value);
    if (qu.status === 'fulfilled') setQuota(qu.value);
    const failed = tasks.find(x => x.status === 'rejected');
    if (failed && !quiet) setError(failed.reason?.message || 'Some project data could not be loaded.');
    if (!quiet) setPageLoading(false);
    return !failed;
  }, []);

  const loadProjects = useCallback(async () => {
    const list = await api('/projects');
    setProjects(list);
    const wanted = list.some(p => String(p.id) === String(projectId)) ? String(projectId) : list[0] ? String(list[0].id) : '';
    setProjectId(wanted);
    if (wanted) sessionStorage.setItem('promptpulse_project', wanted);
    else sessionStorage.removeItem('promptpulse_project');
    return wanted;
  }, [projectId]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const currentToken = sessionStorage.getItem('promptpulse_token');
      if (!currentToken) {
        if (alive) { setLoading(false); setTokenReady(true); }
        return;
      }
      try {
        const [me, modelData] = await Promise.all([api('/auth/me'), api('/models')]);
        if (!alive) return;
        setProfile(me); setIsAuthenticated(true);
        setProfileEdit({ username: me.username || '', email: me.email || '', avatar_url:me.avatar_url||null });
        setModels(modelData); setSelectedModel(modelData.default_model);
        setRunForm(f => ({ ...f, model: modelData.default_model }));
        const id = await loadProjects();
        if (id) await loadProjectData(id, true);
      } catch (e) {
        setToken('');
        if (alive) { setIsAuthenticated(false); setError(e.message || 'Unable to connect to PromptPulse API.'); }
      } finally { if (alive) { setLoading(false); setTokenReady(true); } }
    })();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    const onPointerDown = (event) => {
      const inTopPopover = !!event.target.closest?.('.top-popover-wrap');
      const inProjectPopover = !!projectMenuRef.current?.contains(event.target);
      if (!inTopPopover) { setProfileMenuOpen(false); setNotificationMenuOpen(false); }
      if (!event.target.closest?.('.sidebar-profile-wrap')) setSidebarProfileOpen(false);
      if (!event.target.closest?.('.workspace-search-wrap')) setGlobalSearchOpen(false);
      if (!inProjectPopover) setProjectMenuOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, []);

  useEffect(() => {
    const routeToPage = () => {
      const pathname = window.location.pathname;
      const authRoutes = { '/':'landing', '/login':'login', '/register':'register', '/forgot-password':'reset' };
      if (authRoutes[pathname]) setAuthView(authRoutes[pathname]);
      const path = pathname.replace(/^\//, '').replace(/\/$/, '');
      const next = path === '' || path === 'dashboard' ? 'overview' : path;
      const known = [...NAV.flatMap(group => group.items.map(item => item.id)), 'settings', 'profile', 'notifications', 'intent', 'model-lab'];
      if (known.includes(next)) setPage(next);
      setModal(''); setMobileNav(false); setProfileMenuOpen(false); setSidebarProfileOpen(false); setNotificationMenuOpen(false); setProjectMenuOpen(false); setGlobalSearchOpen(false);
    };
    window.addEventListener('popstate', routeToPage);
    return () => window.removeEventListener('popstate', routeToPage);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('pp_theme', theme);
  }, [theme]);

  useEffect(() => {
    if (!tokenReady || !isAuthenticated || !projectId) return;
    sessionStorage.setItem('promptpulse_project', projectId);
    loadProjectData(projectId);
    setCompareReport(null);
    setIntentDetails({});
  }, [projectId, tokenReady, isAuthenticated, loadProjectData]);

  
  useEffect(() => { const current=summary?.visibility_percentage; if (current==null) return; if (previousVisibility.current!=null && Math.abs(current-previousVisibility.current)>=5) addNotification('Brand visibility changed', `Visibility moved from ${previousVisibility.current.toFixed(1)}% to ${Number(current).toFixed(1)}%.`, current>previousVisibility.current?'success':'warning'); previousVisibility.current=Number(current); }, [summary?.visibility_percentage]);

  const loadDiagnostics = useCallback(async () => {
    setCacheLoading(true);
    const [cache, health] = await Promise.allSettled([api('/cache/stats'), api('/health')]);
    if (cache.status === 'fulfilled') setCacheStats(cache.value);
    if (health.status === 'fulfilled') setApiHealth(health.value);
    setCacheLoading(false);
  }, []);
  useEffect(() => { if (page === 'diagnostics' && (profile.is_admin || profile.is_demo)) loadDiagnostics(); }, [page, loadDiagnostics, profile.is_admin, profile.is_demo]);
  useEffect(() => { const openDiagnostics=()=>go('diagnostics'); window.addEventListener('pp-open-diagnostics',openDiagnostics); return ()=>window.removeEventListener('pp-open-diagnostics',openDiagnostics); }, []);
  useEffect(() => { if (page === 'notifications') api('/notifications').then(data => Array.isArray(data) && setNotifications(data)).catch(() => {}); }, [page]);

  useEffect(() => {
    if (!activeBatch || !projectId) return undefined;
    let cancelled = false;
    const poll = async () => {
      try {
        const batch = await api(activeBatch.is_multi ? `/cycles/${activeBatch.id}` : `/batches/${activeBatch.id}`);
        if (cancelled) return;
        setActiveBatch(old => ({ ...(old || {}), ...batch }));
        const terminal = ['done', 'failed', 'completed', 'cancelled'].includes(batch.status);
        if (terminal) {
          await loadProjectData(projectId, true);
          const succeeded = ['done','completed'].includes(batch.status);
          if (!activeBatch.is_multi) setCompletedProviderRuns(old => old + (batch.completed_runs || 0));
          const cycleFinished = activeBatch.is_multi || queuedModels.length === 0;
          addNotification(cycleFinished ? (succeeded ? 'Tracking cycle completed' : 'Tracking cycle failed') : (succeeded ? 'Provider batch completed' : 'Provider batch failed'), `${activeBatch.is_multi ? `Cycle ${activeBatch.id}` : `Batch #${batch.id}`} · ${batch.completed_runs || 0} completed, ${batch.failed_runs || 0} failed executions.`, succeeded ? 'success' : 'warning');
          if (!activeBatch.is_multi && queuedModels.length) {
            const [nextModel, ...remaining] = queuedModels;
            try {
              const nextBatch = await api(`/projects/${projectId}/runs`, { method: 'POST', body: JSON.stringify({ rounds: Number(runForm.rounds), model: nextModel }) });
              setQueuedModels(remaining);
              setActiveBatch({ ...nextBatch, current_model: nextModel, model_queue: remaining, total_runs: activeBatch.total_runs, completed_runs: 0, is_multi: false });
              notify(`Next provider started: ${nextModel}`);
            } catch (queueError) { setQueuedModels([]); setActiveBatch(null); setError(`Could not continue provider queue: ${queueError.message}`); }
          } else {
            setActiveBatch(null);
            notify('All selected provider runs have finished.');
          }
        } else {
          await loadProjectData(projectId, true);
        }
      } catch (e) { if (!cancelled) setError(e.message); }
    };
    const timer = window.setInterval(poll, 3500);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [activeBatch?.id, activeBatch?.current_model, queuedModels, runForm.rounds, selectedModel, projectId, loadProjectData, notify]);

  const activePrompts = prompts.filter(p => p.active);
  const filteredPrompts = prompts.filter(p => p.text.toLowerCase().includes(promptSearch.toLowerCase()));
  const filteredCitations = citations.filter(c => c.domain.toLowerCase().includes(sourceSearch.toLowerCase()));
  const doneResults = results.filter(r => r.status === 'done');
  const recentResults = results.slice(0, 6);

  const refresh = async () => { if (!projectId) return; const ok = await loadProjectData(projectId, false); if (ok) notify('Workspace data refreshed.'); };
  const startBatch = async () => {
    if (!projectId || !activePrompts.length) return;
    const modelsToRun = selectedModels.length ? selectedModels : [runForm.model || selectedModel];
    try {
      try {
        const cycle = await api(`/projects/${projectId}/runs/multi-model`, { method: 'POST', body: JSON.stringify({ rounds: Number(runForm.rounds), models: modelsToRun, execution_mode: 'parallel', prompt_scope: 'active' }) });
        const cycleId = cycle.cycle_id || cycle.id;
        setQueuedModels([]);
        setActiveBatch({ id: cycleId, status: cycle.status || 'queued', total_runs: cycle.total_runs || activePrompts.length * Number(runForm.rounds) * modelsToRun.length, completed_runs: cycle.completed_runs || 0, failed_runs: cycle.failed_runs || 0, is_multi: true });
        setModal(''); notify(`Multi-engine tracking cycle started across ${modelsToRun.length} AI engines.`); await loadProjectData(projectId, true); return;
      } catch (multiError) {
        if (![404,405].includes(multiError.status)) throw multiError;
        // Existing backend only supports one model per batch. Fall back to a safe sequential provider queue.
      }
      const [first, ...rest] = modelsToRun;
      const batch = await api(`/projects/${projectId}/runs`, { method: 'POST', body: JSON.stringify({ rounds: Number(runForm.rounds), model: first }) });
      setQueuedModels(rest);
      setActiveBatch({ ...batch, current_model: first, model_queue: rest, total_runs: activePrompts.length * Number(runForm.rounds) * modelsToRun.length, is_multi: false });
      setModal(''); notify(`Tracking started across ${modelsToRun.length} selected AI engines.`); await loadProjectData(projectId, true);
    } catch (e) { setError(e.message); }
  };
  const runSingle = async (prompt) => {
    try {
      notify(`Running prompt #${prompt.id}…`);
      const result = await api(`/prompts/${prompt.id}/run-once?model=${encodeURIComponent(selectedModel)}`, { method: 'POST' });
      setSelectedRun(result); setModal('run-detail'); await loadProjectData(projectId, true);
    } catch (e) { setError(e.message); }
  };
  const addBulkPrompts = async () => {
    const texts = bulkText.split('\n').map(s => s.trim()).filter(Boolean);
    if (!texts.length) return;
    try {
      await api(`/projects/${projectId}/prompts/bulk`, { method: 'POST', body: JSON.stringify({ texts }) });
      setBulkText(''); setModal(''); await loadProjectData(projectId, true); notify(`${texts.length} prompts added.`);
    } catch (e) { setError(e.message); }
  };
  const togglePrompt = async (prompt) => {
    const nextActive = !prompt.active;
    setPrompts(old => old.map(p => p.id === prompt.id ? { ...p, active: nextActive } : p));
    try { await api(`/prompts/${prompt.id}`, { method: 'PATCH', body: JSON.stringify({ active: nextActive }) }); await loadProjectData(projectId, true); }
    catch (e) { setPrompts(old => old.map(p => p.id === prompt.id ? { ...p, active: prompt.active } : p)); setError(e.message); }
  };
  const deletePrompt = async (prompt) => requestConfirm({ title:'Delete prompt?', description:'This also removes the execution history associated with this prompt. This action cannot be undone.', confirmLabel:'Delete prompt', onConfirm:async()=>{ await api(`/prompts/${prompt.id}`,{method:'DELETE'}); setPrompts(old=>old.filter(p=>p.id!==prompt.id)); notify('Prompt deleted.'); } });
  const deleteExecution = async (id) => requestConfirm({ title:'Delete execution?', description:`Execution #${id} and its stored analysis will be permanently deleted.`, confirmLabel:'Delete execution', onConfirm:async()=>{ await api(`/executions/${id}`,{method:'DELETE'}); await loadProjectData(projectId,true); notify('Execution deleted.'); } });
  const clearResults = async () => requestConfirm({ title:'Clear tracking history?', description:'All executions and their associated source and analysis records for this project will be deleted. This cannot be undone.', confirmLabel:'Clear history', danger:true, onConfirm:async()=>{ await api(`/projects/${projectId}/results`,{method:'DELETE'}); await loadProjectData(projectId,true); notify('Tracking history cleared.'); } });
  const generateVariants = async () => {
    setVariantLoading(true); setError('');
    try {
      const data = await api(`/projects/${projectId}/prompts/generate-variants`, { method: 'POST', body: JSON.stringify({ count: Number(variantCount), seed_topic: variantTopic || null, model: selectedModel }) });
      setVariantData(data); setVariantSelected(data.variants.map((_, i) => i));
    } catch (e) { setError(e.message); }
    finally { setVariantLoading(false); }
  };
  const saveVariants = async () => {
    if (!variantData) return;
    try {
      const chosen = variantData.variants.filter((_, i) => variantSelected.includes(i));
      if (chosen.length) await api(`/projects/${projectId}/prompts/bulk`, { method: 'POST', body: JSON.stringify({ texts: chosen.map(v => v.text) }) });
      setModal(''); setVariantData(null); await loadProjectData(projectId, true); notify(`${chosen.length} generated prompts added.`);
    } catch (e) { setError(e.message); }
  };
  const createProject = async () => {
    if (!projectForm.brand_name.trim()) return;
    const list = (s) => s.split(',').map(x => x.trim()).filter(Boolean);
    try {
      const created = await api('/projects', { method: 'POST', body: JSON.stringify({ brand_name: projectForm.brand_name.trim(), domain: list(projectForm.domain), aliases: list(projectForm.aliases), competitors: list(projectForm.competitors) }) });
      const all = await api('/projects'); setProjects(all); setProjectId(String(created.id)); const finalConfig={...projectConfig,brandContext:{description:projectForm.description,industry:projectForm.industry,market:projectForm.market,audience:projectForm.audience,topics:list(projectForm.topics)}}; setProjectConfig(finalConfig); setSelectedModels(projectConfig.models); try { await api(`/projects/${created.id}/settings`, {method:'PUT',body:JSON.stringify({models:finalConfig.models,brand_context:finalConfig.brandContext,schedule:{frequency:finalConfig.frequency,enabled:finalConfig.frequency!=='manual',timezone:Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC',time:finalConfig.scheduleTime||'09:00'}})}); } catch (settingsError) { if (![404,405].includes(settingsError.status)) setError(`Project created, but settings could not be synced: ${settingsError.message}`); }
      const firstComp = list(projectForm.competitors)[0];
      const starterTexts = [
        `What are the best ${projectForm.industry || 'recommended'} solutions in 2026?`,
        `How does ${projectForm.brand_name.trim()} compare to alternatives?`,
        firstComp ? `Is ${projectForm.brand_name.trim()} better than ${firstComp}?` : `Top features and reviews of ${projectForm.brand_name.trim()}`
      ];
      try {
        await api(`/projects/${created.id}/prompts/bulk`, {
          method: 'POST',
          body: JSON.stringify({ texts: starterTexts })
        });
      } catch (_) {}
      setQueuedModels([]); setProjectStep(1); setProjectForm({ brand_name: '', domain: '', aliases: '', competitors: '', description: '', industry: '', market: '', audience: '', topics: '' }); setModal(''); setPage('overview'); notify('Project created and onboarding preferences saved.');
    } catch (e) { setError(e.message); }
  };
  const deleteProject = async () => {
    if (!project) return;
    requestConfirm({ title:`Delete ${project.brand_name}?`, description:'This permanently removes the project, its prompts, tracking batches, executions and analysis.', confirmLabel:'Delete project', danger:true, onConfirm:async()=>{ await api(`/projects/${project.id}`, { method:'DELETE' }); const all=await api('/projects'); setProjects(all); const next=all[0]?String(all[0].id):''; setProjectId(next); setProject(null); go('overview'); notify('Project deleted.'); } });
  };
  const compareModels = async () => {
    if (!comparePrompt.trim()) return;
    setCompareLoading(true); setError('');
    try { const data = await api(`/projects/${projectId}/compare-models`, { method: 'POST', body: JSON.stringify({ prompt_text: comparePrompt.trim() }) }); setCompareReport(data); }
    catch (e) { setError(e.message); }
    finally { setCompareLoading(false); }
  };
  const classifyPrompts = async () => {
    setIntentLoading(true);
    const entries = await Promise.allSettled(prompts.map(p => api('/intent/classify', { method: 'POST', body: JSON.stringify({ text: p.text }) })));
    const next = { ...intentDetails };
    entries.forEach((result, i) => { if (result.status === 'fulfilled') next[prompts[i].id] = result.value; });
    setIntentDetails(next);
    setIntentLoading(false);
    notify(`Intent details loaded for ${entries.filter(x => x.status === 'fulfilled').length} prompts.`);
  };
  const savePromptText = async (text) => {
    try { const updated=await api(`/prompts/${editingPrompt.id}/content`, { method: 'PATCH', body: JSON.stringify({ text }) }); setPrompts(old => old.map(p => p.id === editingPrompt.id ? { ...p, ...updated } : p)); setEditingPrompt(null); notify('Prompt text saved.'); }
    catch (e) { setError(e.message); }
  };
  const saveProjectDetails = async () => {
    const list = value => value.split(',').map(x => x.trim()).filter(Boolean);
    const patch = { brand_name: projectEdit.brand_name.trim(), domain: list(projectEdit.domain), aliases: list(projectEdit.aliases), competitors: list(projectEdit.competitors) };
    try { const updated=await api(`/projects/${projectId}`, { method: 'PATCH', body: JSON.stringify(patch) }); setProject(updated); setModal(''); notify('Brand identity saved.'); }
    catch (e) { setError(e.message); }
  };
  const addNotification = (title, message, type = 'info') => setNotifications(old => [{ id: `n_${Date.now()}`, title, message, type, read: false, created_at: new Date().toISOString() }, ...old].slice(0, 50));
  const saveNotificationPreferences = async preferences => { try { await api('/notification-preferences', { method: 'PUT', body: JSON.stringify(preferences) }); notify('Notification preferences saved to the backend.'); } catch (e) { if ([404,405].includes(e.status)) notify('Notification preferences saved in this browser only.'); else setError(e.message); } };
  const saveProjectConfig = async () => {
    const payload={models:projectConfig.models||[],brand_context:projectConfig.brandContext||{},schedule:{frequency:projectConfig.frequency||'manual',enabled:projectConfig.frequency!=='manual',timezone:Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC',time:projectConfig.scheduleTime||'09:00'}};
    try { const saved = await api(`/projects/${project.id}/settings`,{method:'PUT',body:JSON.stringify(payload)}); setProjectConfig(old=>({...old,brandContext:saved.brand_context||old.brandContext,models:saved.models||old.models,frequency:saved.schedule?.frequency||old.frequency,scheduleTime:saved.schedule?.time||old.scheduleTime})); setSelectedModels(saved.models||[]); notify('Project settings saved.'); }
    catch(e) { setError(e.message || 'Unable to save project settings.'); }
  };

  const updateAccountProfile = async () => {
    try { const updated = await api('/auth/me', { method: 'PATCH', body: JSON.stringify(profileEdit) }); setProfile(old => ({ ...old, ...updated })); setProfileEdit(updated); setModal(''); notify('Account profile updated.'); }
    catch (e) { setError(e.message); }
  };
  const changeAccountPassword = async () => {
    try { await api('/auth/change-password', { method: 'POST', body: JSON.stringify(passwordChange) }); notify('Password changed.'); setPasswordChange({ current_password: '', new_password: '' }); }
    catch (e) { if ([404,405].includes(e.status)) notify('Password change endpoint is not implemented yet; no password was changed.'); else setError(e.message); }
  };

  const registerAccount = async () => {
    try {
      const data = await api('/auth/register', { method: 'POST', body: JSON.stringify(registerForm) });
      if (data?.access_token) {
        setToken(data.access_token); setProfile(data.user || { username: registerForm.username }); setProfileEdit({username:data.user?.username||registerForm.username,email:data.user?.email||registerForm.email,avatar_url:data.user?.avatar_url||null}); setIsAuthenticated(true); setAuthMessage('');
        const modelData = await api('/models'); setModels(modelData); setSelectedModel(modelData.default_model); setRunForm(f => ({ ...f, model: modelData.default_model }));
        const id = await loadProjects(); window.history.replaceState({}, '', '/dashboard'); if (!id) openCreateProject(); else go('overview');
      } else { setAuthMessage('Account created. Login to continue.'); setError(''); setAccountMode('login'); navigateAuth('login'); }
    } catch (e) { setError(e.message || 'Unable to create your account.'); }
  };
  const requestPasswordReset = async () => {
    try { await api('/auth/password-reset', { method: 'POST', body: JSON.stringify({ email: resetEmail }) }); setAuthMessage('If the account exists, password reset instructions will be sent to that email.'); setError(''); }
    catch (e) { setError('Password reset is not available yet: the backend needs POST /auth/password-reset.'); }
  };

  const signIn = async (e) => {
    e.preventDefault(); setLoginLoading(true);
    try { const data = await api('/auth/login', { method: 'POST', body: JSON.stringify(loginForm) }); setToken(data.access_token); setProfile(data.user); setProfileEdit({ username: data.user.username || '', email: data.user.email || '', avatar_url:data.user.avatar_url||null }); setIsAuthenticated(true); setPage('overview'); setModal(''); setAuthView('landing'); const modelData = await api('/models'); setModels(modelData); setSelectedModel(modelData.default_model); setRunForm(f => ({ ...f, model: modelData.default_model })); const id = await loadProjects(); if (id) await loadProjectData(id, true); window.history.replaceState({}, '', '/dashboard'); notify(`Signed in as ${data.user.username}.`); }
    catch (err) { setError(err.message); }
    finally { setLoginLoading(false); }
  };
  const signOut = () => { setToken(''); setKeys({openrouter:'',groq:'',deepseek:'',tavily:''}); setProviderKeys({}); setNotifications([]); setIsAuthenticated(false); setProfile({ username: '', role: '', is_demo: false }); setProjects([]); setProject(null); setProjectId(''); setProfileMenuOpen(false); setSidebarProfileOpen(false); setAuthView('landing'); window.history.replaceState({}, '', '/'); };

  const enterDemo = async () => {
    setLoginLoading(true);
    try { const data = await api('/auth/demo-login', { method: 'POST' }); setToken(data.access_token); setProfile(data.user || { username: 'demo', is_demo: true }); setProfileEdit({username:'demo',email:'',avatar_url:null}); setIsAuthenticated(true); setPage('overview'); const md = await api('/models'); setModels(md); setSelectedModel(md.default_model); setRunForm(f => ({ ...f, model: md.default_model })); const id = await loadProjects(); if (id) await loadProjectData(id, true); window.history.replaceState({}, '', '/dashboard'); notify('Demo workspace ready.'); }
    catch (e) { setError(e.message); } finally { setLoginLoading(false); }
  };

  const openRun = (run) => { setSelectedRun(run); setModal('run-detail'); };
  const navigateAuth = (view) => { setAuthView(view); const url = ({landing:'/',login:'/login',register:'/register',reset:'/forgot-password'})[view] || '/'; if (window.location.pathname !== url) window.history.pushState({ authView:view }, '', url); };
  const go = (id) => { setPage(id); setMobileNav(false); setProfileMenuOpen(false); setSidebarProfileOpen(false); setNotificationMenuOpen(false); setProjectMenuOpen(false); setGlobalSearchOpen(false); setError(''); const url = id === 'overview' ? '/dashboard' : `/${id}`; if (window.location.pathname !== url) window.history.pushState({ page: id }, '', url); };
  const requestConfirm = (config) => setConfirmDialog(config);
  const navigateWorkspaceSearch = (query) => {
    const q = query.trim().toLowerCase(); if (!q) return;
    const promptMatch = prompts.find(p => p.text.toLowerCase().includes(q));
    const runMatch = results.find(r => `${r.prompt_text||''} ${r.model||''} ${r.id} ${r.batch_id||''}`.toLowerCase().includes(q));
    const sourceMatch = citations.find(c => `${c.domain||''}`.toLowerCase().includes(q)) || results.some(r => (r.web_search_results||[]).some(src => `${src.title||''} ${src.domain||''}`.toLowerCase().includes(q)));
    const competitorMatch = (summary?.top_competitors||[]).find(c => c.brand.toLowerCase().includes(q));
    const navMatch = [...NAV.flatMap(g=>g.items),{id:'settings',label:'project settings'},{id:'profile',label:'my profile'},{id:'notifications',label:'notifications'},{id:'runs',label:'runs'},{id:'analysis',label:'analysis'},{id:'sources',label:'citations'},{id:'prompts',label:'prompts'}].find(n=>n.label.toLowerCase().includes(q) || q.includes(n.label));
    if (promptMatch) { setPromptSearch(query); go('prompts'); }
    else if (runMatch) { setRunFilter('all'); setRunSearchQuery(query); go('runs'); }
    else if (sourceMatch) { setSourceSearch(query); go('sources'); }
    else if (competitorMatch) { setCompetitorSearchQuery(query); go('competitors'); }
    else if (navMatch) go(navMatch.id);
    else { setPromptSearch(query); go('prompts'); }
  };
  const openCreateProject = () => { setProjectForm({brand_name:'',domain:'',aliases:'',competitors:'',description:'',industry:'',market:'',audience:'',topics:''}); setProjectConfig({frequency:'manual',models:['OR: openai/gpt-4o-mini'],autoRun:false,scheduleTime:'09:00'}); setProjectStep(1); setModal('create-project'); };

  if (loading) return <div className="boot-screen"><BrandMark /><div className="boot-line" /><p>Preparing your workspace</p></div>;
  if (!isAuthenticated) return <PublicLanding view={authView} setView={navigateAuth} loginForm={loginForm} setLoginForm={setLoginForm} registerForm={registerForm} setRegisterForm={setRegisterForm} resetEmail={resetEmail} setResetEmail={setResetEmail} onSignIn={signIn} onDemo={enterDemo} onRegister={registerAccount} onReset={requestPasswordReset} loading={loginLoading} error={error} message={authMessage} theme={theme} setTheme={setTheme}/>;

  return <div className="app-shell">
    <aside className={cx('sidebar', mobileNav && 'sidebar-open')}>
      <div className="brand-lockup"><button className="brand-home-hit" onClick={() => go('overview')} aria-label="PromptPulse home"><BrandMark /></button><button className="brand-home-text" onClick={() => go('overview')}><strong>prompt<span>pulse</span></strong><small>AI visibility workspace</small></button><button className="mobile-close" onClick={() => setMobileNav(false)}><X size={18}/></button></div>
      <div className="workspace-label">PROJECT</div>
      <div className="project-switch-wrap" ref={projectMenuRef}><button className="workspace-select" onClick={() => { setProjectMenuOpen(v => !v); setProfileMenuOpen(false); setNotificationMenuOpen(false); }} aria-expanded={projectMenuOpen}><span className="workspace-avatar">{project?.brand_name?.slice(0, 1)?.toUpperCase() || 'P'}</span><span className="workspace-copy"><strong>{project?.brand_name || 'Choose a project'}</strong><small>{project ? domainName(project.domain?.[0] || 'Brand workspace') : 'No active project'}</small></span><ChevronDown size={15}/></button>{projectMenuOpen && <div className="project-switch-menu">{projects.map(item => <button key={item.id} className={String(item.id)===String(projectId)?'selected':''} onClick={() => { setProjectId(String(item.id)); setProjectMenuOpen(false); go('overview'); }}>{item.brand_name}<small>{item.domain?.[0] || 'Brand workspace'}</small></button>)}<button className="project-create-option" onClick={() => { setProjectMenuOpen(false); openCreateProject(); }}><Plus size={14}/> Create new project</button></div>}</div>
      <nav className="side-nav">{NAV.map(group => <div className="nav-group" key={group.label}><div className="nav-group-label">{group.label}</div>{group.items.filter(item => item.id !== 'diagnostics' || profile.is_admin || profile.is_demo).map(item => <button key={item.id} onClick={() => go(item.id)} className={cx('nav-item', page === item.id && 'nav-active')}><item.icon size={17} strokeWidth={1.8}/><span>{item.label}</span>{item.id === 'runs' && activeBatch && <i className="nav-live-dot"/>}</button>)}</div>)}</nav>
      <div className="sidebar-spacer" />
      <div className="sidebar-bottom"><div className="quota-card"><div className="quota-top"><span>Tracking allowance</span><span>{quota?.is_unlimited ? 'Unlimited' : `${quota?.remaining ?? 0} left`}</span></div><div className="quota-track"><span style={{ width: quota?.is_unlimited ? '100%' : `${Math.min(100, ((quota?.used_prompts || 0) / Math.max(1, quota?.limit || 5)) * 100)}%` }}/></div><p>{quota?.is_unlimited ? 'Your workspace has no run limit.' : `${quota?.used_prompts || 0} of ${quota?.limit || 5} tracked executions used`}</p></div>
        <div className="sidebar-profile-wrap"><button className="profile-row" onClick={() => {setSidebarProfileOpen(v=>!v);setProfileMenuOpen(false);setNotificationMenuOpen(false);}} aria-expanded={sidebarProfileOpen}><span className="profile-avatar">{profile.avatar_url?<img src={profile.avatar_url} alt=""/>:(profile.username || 'D').slice(0, 1).toUpperCase()}</span><span className="profile-copy"><strong>{profile.username || 'Demo user'}</strong><small>{profile.is_admin ? 'Administrator' : profile.is_demo ? 'Demo workspace' : 'Workspace member'}</small></span><MoreHorizontal size={17}/></button>{sidebarProfileOpen&&<div className="sidebar-profile-menu"><button onClick={()=>go('profile')}>My Profile</button><button onClick={()=>go('settings')}>Project Settings</button><button className="profile-signout" onClick={signOut}>Logout</button></div>}</div>
      </div>
    </aside>
    <div className="main-column">
      <header className="topbar"><div className="topbar-left"><button className="mobile-menu" onClick={() => setMobileNav(true)}><Menu size={20}/></button><div className="top-project-context"><span>{project?.brand_name || 'Workspace setup'}</span><strong>{NAV.flatMap(g => g.items).find(n => n.id === page)?.label || (page === 'settings' ? 'Project Settings' : page === 'profile' ? 'My Profile' : page === 'notifications' ? 'Notifications' : 'Overview')}</strong></div></div><div className="workspace-search-wrap"><label className="workspace-global-search"><Search size={16}/><input value={workspaceSearch} onFocus={()=>setGlobalSearchOpen(true)} onChange={e=>{setWorkspaceSearch(e.target.value);setGlobalSearchOpen(true);}} onKeyDown={e=>{if(e.key==='Enter')navigateWorkspaceSearch(workspaceSearch);if(e.key==='Escape')setGlobalSearchOpen(false);}} placeholder="Search workspace…"/><kbd>↵</kbd></label>{globalSearchOpen&&workspaceSearch.trim()&&<div className="workspace-search-results"><button onClick={()=>navigateWorkspaceSearch(workspaceSearch)}><Search size={14}/><span>Search for <strong>{workspaceSearch}</strong></span></button><button onClick={()=>{setPromptSearch(workspaceSearch);go('prompts')}}><MessageSquareText size={14}/><span>Search prompts</span></button><button onClick={()=>{setSourceSearch(workspaceSearch);go('sources')}}><FileSearch size={14}/><span>Search sources & citations</span></button><button onClick={()=>{setRunSearchQuery(workspaceSearch);go('runs')}}><Activity size={14}/><span>Search tracking runs</span></button><button onClick={()=>{setCompetitorSearchQuery(workspaceSearch);go('competitors')}}><Layers3 size={14}/><span>Search competitors</span></button></div>}</div><div className="topbar-actions"><button className="top-icon theme-toggle" title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`} onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>{theme === 'light' ? <Moon size={17}/> : <Sun size={17}/>}</button><button className="top-icon" title="Refresh data" onClick={refresh}><RefreshCw size={16}/></button><div className="top-popover-wrap"><button className="top-icon notification-button" title="Notifications" onClick={() => { setNotificationMenuOpen(v => !v); setProfileMenuOpen(false); }}><Bell size={17}/>{notifications.some(n => !n.read) && <i/>}</button>{notificationMenuOpen && <div className="top-popover notification-popover"><div className="popover-head"><div><strong>Notifications</strong><small>{notifications.filter(n => !n.read).length} unread updates</small></div><button onClick={() => go('notifications')}>View all</button></div>{notifications.length ? notifications.slice(0,4).map(n => <button className="popover-notice" key={n.id} onClick={() => { setNotifications(old => old.map(x => x.id === n.id ? {...x,read:true} : x)); go('notifications'); }}><i className={`notice-dot ${n.type || 'info'}`}/><span><strong>{n.title}</strong><small>{n.message}</small></span></button>) : <div className="popover-empty">You're all caught up.</div>}</div>}</div><div className="top-popover-wrap"><button className="top-avatar" onClick={() => { setProfileMenuOpen(v => !v); setNotificationMenuOpen(false); }}>{profile.avatar_url?<img src={profile.avatar_url} alt=""/>:(profile.username || 'D').slice(0, 1).toUpperCase()}</button>{profileMenuOpen && <div className="top-popover profile-popover"><div className="profile-popover-user"><span className="profile-avatar">{profile.avatar_url?<img src={profile.avatar_url} alt=""/>:(profile.username || 'D').slice(0,1).toUpperCase()}</span><div><strong>{profile.username || 'Account'}</strong><small>{profile.is_demo ? 'Demo account' : profile.role || 'Member'}</small></div></div><button onClick={() => go('profile')}>Profile</button><button onClick={() => go('settings')}>Settings</button><button className="profile-signout" onClick={signOut}><LogOut size={15}/> Logout</button></div>}</div></div></header>
      <main className="content-area">
        {!project && page !== 'profile' && <div className="workspace-empty"><div className="workspace-empty-mark"><BrandMark/></div><span className="eyebrow"><!-- ZERO STATE ONBOARDING --> YOUR WORKSPACE IS READY</span><h1>Start with your first brand.</h1><p>Create a project to define your brand identity, choose the AI engines you want to track, and set a manual or recurring tracking schedule. Your dashboard will fill with real visibility data after the first completed cycle.</p><div className="workspace-empty-actions"><Button icon={Plus} onClick={openCreateProject}>Create a project</Button></div><div className="workspace-empty-steps"><span><b>01</b> Brand identity</span><span><b>02</b> AI engines</span><span><b>03</b> Tracking schedule</span></div></div>}
        {error && <div className="alert alert-error"><AlertTriangle size={16}/><span>{error}</span><button onClick={() => setError('')}><X size={15}/></button></div>}
        {notice && <div className="alert alert-info"><CheckCircle2 size={16}/><span>{notice}</span><button onClick={() => setNotice('')}><X size={15}/></button></div>}
        {activeBatch && <div className="batch-banner"><span className="batch-spinner"><Loader2 size={16}/></span><div><strong>{activeBatch.is_multi ? `Tracking cycle ${activeBatch.id}` : `Tracking batch #${activeBatch.id}`} is {activeBatch.status}</strong><small>{(activeBatch.is_multi ? (activeBatch.completed_runs || 0) : completedProviderRuns + (activeBatch.completed_runs || 0))} of {activeBatch.total_runs || 0} executions completed · {activeBatch.failed_runs || 0} failed</small></div><div className="batch-progress"><span style={{ width: `${activeBatch.total_runs ? (((activeBatch.is_multi ? (activeBatch.completed_runs || 0) : completedProviderRuns + (activeBatch.completed_runs || 0)) / activeBatch.total_runs) * 100) : 0}%` }}/></div><button onClick={() => go('runs')}>View runs <ArrowRight size={14}/></button></div>}
        {project && page === 'overview' && <OverviewPage project={project} summary={summary} prompts={prompts} results={results} citations={citations} onRun={() => setModal('run-batch')} onNavigate={go} onOpenRun={openRun} loading={pageLoading}/>}
        {project && page === 'prompts' && <PromptsPage prompts={filteredPrompts} allCount={prompts.length} activeCount={activePrompts.length} search={promptSearch} setSearch={setPromptSearch} onBulk={() => setModal('bulk-prompts')} onGenerate={() => { setVariantData(null); setModal('generate-prompts'); }} onToggle={togglePrompt} onRun={runSingle} onDelete={deletePrompt} onEdit={setEditingPrompt} loading={pageLoading}/>}
        {project && page === 'analysis' && <AnalysisPage results={results} prompts={prompts} project={project} activeRunId={activeAnalysisRunId} setActiveRunId={setActiveAnalysisRunId}/>}
        {project && page === 'runs' && <RunsPage results={results} filter={runFilter} setFilter={setRunFilter} search={runSearchQuery} setSearch={setRunSearchQuery} onRun={() => setModal('run-batch')} onOpen={run => { setActiveAnalysisRunId(run.id); go('analysis'); }} onDelete={deleteExecution} onClear={clearResults} loading={pageLoading}/>}
        {project && page === 'sources' && <SourcesPage citations={filteredCitations} allCitations={citations} project={project} search={sourceSearch} setSearch={setSourceSearch} results={results} loading={pageLoading}/>}
        {project && page === 'competitors' && <CompetitorsPage summary={summary} results={results} project={project} search={competitorSearchQuery} setSearch={setCompetitorSearchQuery} loading={pageLoading}/>}
        {project && page === 'model-lab' && <ModelLabPage prompts={prompts} comparePrompt={comparePrompt} setComparePrompt={setComparePrompt} report={compareReport} loading={compareLoading} onCompare={compareModels}/>}


        {project && page === 'intent' && <IntentPage prompts={prompts} classifications={intentDetails} onClassify={classifyPrompts} loading={intentLoading}/>}
        {project && page === 'diagnostics' && (profile.is_admin || profile.is_demo) && <DiagnosticsPage cacheStats={cacheStats} cacheLoading={cacheLoading} onRefresh={loadDiagnostics} keys={providerKeys} apiHealth={apiHealth} profile={profile}/>}
        {project && page === 'notifications' && <NotificationsPage items={notifications} onRead={id => { api(`/notifications/${id}`, { method: 'PATCH', body: JSON.stringify({ read: true }) }).catch(() => {}); setNotifications(old => old.map(n => n.id === id ? {...n, read:true} : n)); }} onReadAll={() => { api('/notifications/bulk-read', { method: 'PATCH' }).catch(() => {}); setNotifications(old => old.map(n => ({...n,read:true}))); }} onDismiss={id => { api(`/notifications/${id}`, { method: 'DELETE' }).catch(() => {}); setNotifications(old => old.filter(n => n.id !== id)); }} onSavePreferences={saveNotificationPreferences}/>}
        {page === 'profile' && <ProfilePage profile={profile} profileEdit={profileEdit} setProfileEdit={setProfileEdit} passwordChange={passwordChange} setPasswordChange={setPasswordChange} keys={providerKeys} setKeys={setKeys} onSave={updateAccountProfile} onChangePassword={changeAccountPassword} onSaveKeys={()=>{setProviderKeys(providerKeys);notify('Provider keys are active for this browser session.');}}/> }
        {project && page === 'settings' && <SettingsPage project={project} canViewDiagnostics={profile.is_admin||profile.is_demo} projectConfig={projectConfig} setProjectConfig={setProjectConfig} onSaveProjectConfig={saveProjectConfig} onDeleteProject={deleteProject} onEditProject={() => { setProjectEdit({ brand_name: project.brand_name || '', domain: (project.domain || []).join(', '), aliases: (project.aliases || []).join(', '), competitors: (project.competitors || []).join(', ') }); setModal('edit-project'); }}/>}
      </main>
    </div>
    {mobileNav && <button className="mobile-scrim" onClick={() => setMobileNav(false)} aria-label="Close navigation"/>}
    {confirmDialog && <ConfirmDialog config={confirmDialog} onClose={()=>setConfirmDialog(null)} onConfirm={async()=>{const action=confirmDialog.onConfirm;setConfirmDialog(null);try{await action();}catch(e){setError(e.message||'The action could not be completed.');}}}/> }
    {toast && <div className="toast"><CheckCircle2 size={16}/>{toast}</div>}


    {modal === 'create-project' && <Modal title="Set up a brand workspace" subtitle={`Step ${projectStep} of 3 · Configure the identity and engines you want to track.`} onClose={() => { setModal(''); setProjectStep(1); }} wide><div className="onboarding-progress"><i style={{width:`${projectStep/3*100}%`}}/></div>{projectStep === 1 && <div className="project-wizard"><div className="wizard-intro"><span className="wizard-step">01 / BRAND IDENTITY</span><h3>Tell us what to look for.</h3><p>These details help PromptPulse recognise your brand across AI-generated answers and cited sources.</p></div><div className="form-grid project-identity-grid"><label>Brand name <b>*</b><input value={projectForm.brand_name} onChange={e => setProjectForm({ ...projectForm, brand_name: e.target.value })} placeholder="e.g. Northstar Audio" autoFocus/></label><label>Primary website <b>*</b><input value={projectForm.domain} onChange={e => setProjectForm({ ...projectForm, domain: e.target.value })} placeholder="northstaraudio.com"/></label><label>Industry / category<input value={projectForm.industry} onChange={e=>setProjectForm({...projectForm,industry:e.target.value})} placeholder="Consumer electronics"/></label><label>Primary market<input value={projectForm.market} onChange={e=>setProjectForm({...projectForm,market:e.target.value})} placeholder="India, United States, Global…"/></label><label className="identity-wide">Brand description<textarea rows="2" value={projectForm.description} onChange={e=>setProjectForm({...projectForm,description:e.target.value})} placeholder="What does your brand offer, and what makes it distinct?"/></label><label>Target audience<input value={projectForm.audience} onChange={e=>setProjectForm({...projectForm,audience:e.target.value})} placeholder="Students, professionals, SMBs…"/></label><label>Core topics / product areas <span className="field-hint">Comma separated</span><input value={projectForm.topics} onChange={e=>setProjectForm({...projectForm,topics:e.target.value})} placeholder="wireless audio, travel, ANC"/></label><label>Brand aliases <span className="field-hint">Optional · comma separated</span><input value={projectForm.aliases} onChange={e => setProjectForm({ ...projectForm, aliases: e.target.value })} placeholder="Northstar, Northstar Audio Co."/></label><label>Known competitors <span className="field-hint">Optional · comma separated</span><input value={projectForm.competitors} onChange={e => setProjectForm({ ...projectForm, competitors: e.target.value })} placeholder="Acme Audio, Soundhaus"/></label></div><div className="wizard-footer"><span>* Required fields</span><Button icon={ArrowRight} onClick={() => setProjectStep(2)} disabled={!projectForm.brand_name.trim() || !projectForm.domain.trim()}>Continue to AI engines</Button></div></div>}{projectStep === 2 && <div className="project-wizard"><div className="wizard-intro"><span className="wizard-step">02 / AI ENGINES</span><h3>Choose where your brand should appear.</h3><p>Select the AI engines you want to include in each tracking cycle. You can change this later in settings.</p></div><div className="provider-choice-grid">{PROVIDER_PRESETS.map(provider => <button key={provider.id} className={`provider-choice ${projectConfig.models.includes(provider.model)?'provider-choice-active':''}`} onClick={() => setProjectConfig(old => ({...old,models:old.models.includes(provider.model)?old.models.filter(x=>x!==provider.model):[...old.models,provider.model]}))}><ProviderMark provider={provider}/><span><strong>{provider.name}</strong><small>{provider.route} connection</small></span><i>{projectConfig.models.includes(provider.model)?<Check size={15}/>:<Plus size={15}/>}</i></button>)}</div><div className="wizard-key-note"><KeyRound size={16}/><span>Provider credentials belong to your account. Add or update them under My Profile → Provider API keys. You can configure engines here without entering credentials during project setup.</span></div><div className="wizard-footer"><Button variant="secondary" onClick={() => setProjectStep(1)}>Back</Button><Button icon={ArrowRight} onClick={() => setProjectStep(3)} disabled={!projectConfig.models.length}>Set tracking schedule</Button></div></div>}{projectStep === 3 && <div className="project-wizard"><div className="wizard-intro"><span className="wizard-step">03 / TRACKING SCHEDULE</span><h3>Choose how often to check.</h3><p>Choose a preferred cadence for this project. Automatic execution requires a configured scheduler; manual runs remain available at any time.</p></div><div className="schedule-options">{[{id:'manual',title:'Manual only',desc:'Run a tracking cycle whenever you choose.'},{id:'daily',title:'Every day',desc:'Automatically check your brand once per day.'},{id:'weekly',title:'Every week',desc:'A weekly pulse across your selected AI engines.'},{id:'monthly',title:'Every month',desc:'A monthly snapshot of your AI visibility.'}].map(item=><button key={item.id} className={`schedule-option ${projectConfig.frequency===item.id?'schedule-option-active':''}`} onClick={() => setProjectConfig(old=>({...old,frequency:item.id,autoRun:item.id!=='manual'}))}><span className="schedule-radio"/ ><span><strong>{item.title}</strong><small>{item.desc}</small></span></button>)}</div>{projectConfig.frequency!=='manual'&&<label className="schedule-time-field">Preferred run time<input type="time" value={projectConfig.scheduleTime||'09:00'} onChange={e=>setProjectConfig(old=>({...old,scheduleTime:e.target.value}))}/></label>}<div className="wizard-summary"><strong>Workspace summary</strong><span>{projectForm.brand_name} · {projectConfig.models.length} AI engines · {projectConfig.frequency==='manual'?'Manual runs':projectConfig.frequency+' schedule'}</span></div><div className="wizard-footer"><Button variant="secondary" onClick={() => setProjectStep(2)}>Back</Button><Button icon={Check} onClick={createProject}>Create workspace</Button></div></div>}</Modal>}
    {modal === 'bulk-prompts' && <Modal title="Add Prompt(s)" subtitle="Enter one prompt per line. Use Shift + Enter to add another prompt." onClose={() => setModal('')}><div className="form-stack"><label>Prompt list<textarea className="bulk-prompt-textarea" rows="8" value={bulkText} onChange={e => setBulkText(e.target.value)} placeholder={'Enter your prompt. Press Shift + Enter to add individual prompts on individual lines.'} autoFocus/></label><div className="modal-actions"><Button variant="secondary" onClick={() => setModal('')}>Cancel</Button><Button icon={Plus} onClick={addBulkPrompts} disabled={!bulkText.trim()}>Add Prompt(s)</Button></div></div></Modal>}
    {modal === 'generate-prompts' && <Modal title="Discover customer prompts" subtitle="Generate brand-agnostic questions based on your market and customer intent." onClose={() => setModal('')} wide><div className="form-stack"><div className="form-grid"><label>Number of ideas<select value={variantCount} onChange={e => setVariantCount(Number(e.target.value))}>{[3,5,8,10].map(n => <option key={n}>{n}</option>)}</select></label><label>Seed topic <span className="field-hint">Optional</span><input value={variantTopic} onChange={e => setVariantTopic(e.target.value)} placeholder="e.g. travel headphones"/></label></div><div className="modal-actions modal-actions-start"><Button icon={Sparkles} onClick={generateVariants} disabled={variantLoading}>{variantLoading ? 'Generating…' : 'Generate ideas'}</Button></div>{variantLoading && <div className="inline-loading"><Loader2 size={18}/> Generating prompt ideas with {selectedModel}…</div>}{variantData && <><div className="variant-toolbar"><span>{variantData.variants.length} ideas generated</span><button onClick={() => setVariantSelected(variantSelected.length === variantData.variants.length ? [] : variantData.variants.map((_, i) => i))}>{variantSelected.length === variantData.variants.length ? 'Deselect all' : 'Select all'}</button></div><div className="variant-list">{variantData.variants.map((v, i) => <label className={cx('variant-item', variantSelected.includes(i) && 'variant-selected')} key={`${v.text}-${i}`}><input type="checkbox" checked={variantSelected.includes(i)} onChange={e => setVariantSelected(old => e.target.checked ? [...old, i] : old.filter(x => x !== i))}/><span className="variant-body"><strong>{v.text}</strong><span className="variant-meta"><span>{v.intent_category}</span><span>{v.rationale}</span></span></span></label>)}</div><div className="modal-actions"><Button variant="secondary" onClick={() => setVariantData(null)}>Regenerate</Button><Button icon={Check} onClick={saveVariants} disabled={!variantSelected.length}>Add {variantSelected.length} selected</Button></div></>}</div></Modal>}
    {modal === 'run-batch' && <Modal title="Start a tracking cycle" subtitle={`Run all ${activePrompts.length} active prompts across every selected AI engine.`} onClose={() => setModal('')} wide><div className="run-setup"><div className="run-setup-summary"><div><span>Active prompts</span><strong>{activePrompts.length}</strong></div><div><span>AI engines</span><strong>{selectedModels.length}</strong></div><div><span>Estimated executions</span><strong>{activePrompts.length*selectedModels.length*Number(runForm.rounds)}</strong></div></div><div className="run-setup-heading"><h3>AI engines in this cycle</h3><div className="run-setup-links"><button onClick={() => go('settings')}>Manage engines <ArrowRight size={13}/></button><button onClick={() => go('profile')}>API keys <ArrowRight size={13}/></button></div></div><div className="provider-run-grid">{PROVIDER_PRESETS.map(provider=><button key={provider.id} className={`provider-run-choice ${selectedModels.includes(provider.model)?'selected':''}`} onClick={()=>{const next=selectedModels.includes(provider.model)?selectedModels.filter(x=>x!==provider.model):[...selectedModels,provider.model];setSelectedModels(next);setProjectConfig(old=>({...old,models:next}));}}><ProviderMark provider={provider}/><span><strong>{provider.name}</strong><small>{provider.route}</small></span><i>{selectedModels.includes(provider.model)?<Check size={15}/>:null}</i></button>)}</div><div className="form-grid run-options"><label>Rounds per prompt<select value={runForm.rounds} onChange={e => setRunForm({ ...runForm, rounds: Number(e.target.value) })}>{[1,2,3].map(n => <option value={n} key={n}>{n} {n === 1 ? 'round' : 'rounds'}</option>)}</select></label><label>Fallback model<select value={runForm.model || selectedModel} onChange={e => setRunForm({ ...runForm, model: e.target.value })}>{models.supported_models.map(m => <option key={m}>{m}</option>)}</select></label></div><div className="run-engine-note"><Activity size={16}/><span>The current execution API runs one engine per batch. Selected engines are queued sequentially so each engine produces a separate, traceable set of results.</span></div>{quota && !quota.is_unlimited && <div className="quota-warning"><ShieldCheck size={16}/><span>{quota.remaining} free executions remaining. Your current quota may not cover all selected engines and prompts.</span></div>}<div className="modal-actions"><Button variant="secondary" onClick={() => setModal('')}>Cancel</Button><Button icon={Play} onClick={startBatch} disabled={!activePrompts.length || !selectedModels.length || !!activeBatch}>Start {selectedModels.length} engine cycle</Button></div></div></Modal>}
    {modal === 'run-detail' && selectedRun && <RunDetailModal run={selectedRun} ownDomains={project?.domain||[]} onClose={() => setModal('')} onDelete={() => { setModal(''); deleteExecution(selectedRun.id); }}/>}
    {modal === 'edit-project' && <Modal title="Edit brand identity" subtitle="Update the brand details used throughout this project." onClose={() => setModal('')}><div className="form-stack"><label>Brand name<input value={projectEdit.brand_name} onChange={e=>setProjectEdit({...projectEdit,brand_name:e.target.value})}/></label><label>Website domains<input value={projectEdit.domain} onChange={e=>setProjectEdit({...projectEdit,domain:e.target.value})}/></label><label>Brand aliases<input value={projectEdit.aliases} onChange={e=>setProjectEdit({...projectEdit,aliases:e.target.value})}/></label><label>Known competitors<input value={projectEdit.competitors} onChange={e=>setProjectEdit({...projectEdit,competitors:e.target.value})}/></label><div className="modal-actions"><Button variant="secondary" onClick={()=>setModal('')}>Cancel</Button><Button icon={Check} onClick={saveProjectDetails}>Save brand details</Button></div></div></Modal>}
    {editingPrompt && <PromptEditorModal prompt={editingPrompt} onClose={() => setEditingPrompt(null)} onSave={savePromptText}/> }

  </div>;
}

function ConfirmDialog({ config, onClose, onConfirm }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={e=>e.target===e.currentTarget&&onClose()}><section className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title"><div className={cx('confirm-dialog-icon',config.danger&&'is-danger')}>{config.danger?<AlertTriangle size={20}/>:<Trash2 size={20}/>}</div><h2 id="confirm-title">{config.title}</h2><p>{config.description}</p><div className="modal-actions"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button variant={config.danger?'danger':'primary'} onClick={onConfirm}>{config.confirmLabel||'Confirm'}</Button></div></section></div>;
}

function ProfilePage({ profile, profileEdit, setProfileEdit, passwordChange, setPasswordChange, keys, setKeys, onSave, onChangePassword, onSaveKeys }) {
  const [avatarPreview,setAvatarPreview]=useState(profile.avatar_url||''); const [avatarError,setAvatarError]=useState('');
  const handleAvatar = (file) => { if(!file)return; if(!['image/jpeg','image/png','image/webp'].includes(file.type)){setAvatarError('Choose a JPG, PNG or WebP image.');return;} if(file.size>1_500_000){setAvatarError('Choose an image smaller than 1.5 MB.');return;} setAvatarError(''); const reader=new FileReader();reader.onload=()=>{const value=String(reader.result||'');setAvatarPreview(value);setProfileEdit(old=>({...old,avatar_url:value}));};reader.readAsDataURL(file); };
  return <><SectionHeading eyebrow="ACCOUNT" title="My Profile" description="Manage the personal details and sign-in credentials for your PromptPulse account."/><div className="profile-page-grid"><section className="panel profile-page-card"><div className="profile-page-heading"><div><h2>Personal information</h2><p>These details belong to your account, not an individual project.</p></div></div><div className="profile-avatar-editor"><span className="profile-avatar profile-avatar-large">{avatarPreview?<img src={avatarPreview} alt="Profile avatar"/>:(profile.username||'U').slice(0,1).toUpperCase()}</span><label className="button button-secondary button-small">Upload photo<input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>handleAvatar(e.target.files?.[0])} hidden/></label><small>JPG, PNG or WebP · up to 1.5 MB</small>{avatarError&&<small className="field-error">{avatarError}</small>}</div><div className="form-stack"><label>Username<input value={profileEdit.username||''} onChange={e=>setProfileEdit(old=>({...old,username:e.target.value}))} pattern="[A-Za-z0-9_.-]{3,80}" minLength={3} maxLength={80} placeholder="3–80 characters; letters, numbers, . _ -"/></label><label>Email address<input type="email" value={profileEdit.email||''} onChange={e=>setProfileEdit(old=>({...old,email:e.target.value}))}/></label><Button onClick={onSave} disabled={profile.is_demo||profile.is_admin||!profileEdit.username?.trim()||!profileEdit.email?.trim()}>Save profile</Button></div></section><section className="panel profile-page-card"><div className="profile-page-heading"><div><h2>Change password</h2><p>Choose a new password with at least eight characters.</p></div></div><div className="form-stack"><label>Current password<input type="password" autoComplete="current-password" value={passwordChange.current_password} onChange={e=>setPasswordChange(old=>({...old,current_password:e.target.value}))}/></label><label>New password<input type="password" autoComplete="new-password" minLength={8} value={passwordChange.new_password} onChange={e=>setPasswordChange(old=>({...old,new_password:e.target.value}))}/></label><Button variant="secondary" onClick={onChangePassword} disabled={profile.is_demo||profile.is_admin||!passwordChange.current_password||passwordChange.new_password.length<8}>Update password</Button></div><div className="profile-access-note">{profile.is_demo?'Demo accounts cannot change account details or passwords. Create an account to use these settings.':'Your profile changes are saved to your account.'}</div></section><section className="panel profile-page-card"><div className="profile-page-heading"><div><h2>Provider API keys</h2><p>These credentials belong to your account and are available across your projects in this browser session.</p></div></div><div className="form-stack">{[['openrouter','OpenRouter'],['groq','Groq'],['deepseek','DeepSeek'],['tavily','Tavily Search']].map(([key,label])=><label key={key}>{label}<input type="password" autoComplete="off" value={keys[key]||''} onChange={e=>setKeys(old=>({...old,[key]:e.target.value}))} placeholder={`Paste ${label} API key`}/></label>)}<Button variant="secondary" onClick={onSaveKeys}>Apply provider keys</Button></div><div className="profile-access-note">Keys stay in memory for the current app session, are sent only with PromptPulse API requests, and are cleared when you log out or refresh.</div></section></div></>;
}

function PublicLanding({ view, setView, loginForm, setLoginForm, registerForm, setRegisterForm, resetEmail, setResetEmail, onSignIn, onDemo, onRegister, onReset, loading, error, message, theme, setTheme }) {
  const [showPassword, setShowPassword] = useState(false);
  return <div className="public-site">
    <header className="public-nav"><button className="public-brand" onClick={()=>setView('landing')}><BrandMark/><span>prompt<strong>pulse</strong></span></button><div className="public-nav-actions"><button className="public-theme" onClick={()=>setTheme(theme==='light'?'dark':'light')}>{theme==='light'?'Dark mode':'Light mode'}</button><button className="public-link" onClick={()=>setView('login')}>Login</button><button className="public-cta" onClick={()=>setView('register')}>Create account <ArrowRight size={15}/></button></div></header>
    {view==='landing' ? <><section className="hero-section"><div className="hero-copy"><span className="hero-kicker"><i/> THE AI VISIBILITY WORKSPACE</span><h1>Be the brand<br/>AI <em>chooses.</em></h1><p>Understand how AI engines discover, describe and recommend your brand. Track every answer, inspect the sources behind it, and understand visibility gaps.</p><div className="hero-actions"><button className="public-cta public-cta-large" onClick={()=>setView('register')}>Create your workspace <ArrowRight size={17}/></button><button className="public-secondary" onClick={onDemo}><Play size={15}/> Explore the demo</button></div><div className="hero-proof"><span><CheckCircle2 size={15}/> Multi-engine tracking</span><span><CheckCircle2 size={15}/> Source-level evidence</span><span><CheckCircle2 size={15}/> Clear visibility insights</span></div></div><div className="hero-visual"><div className="visual-orbit orbit-one"/><div className="visual-orbit orbit-two"/><div className="visual-core"><BrandMark/><span>prompt<strong>pulse</strong></span><small>AI visibility intelligence</small></div><div className="visual-float float-chatgpt"><b>O</b><span>ChatGPT<small>Brand mentioned</small></span><i/></div><div className="visual-float float-gemini"><b>✦</b><span>Gemini<small>Source discovered</small></span><i/></div><div className="visual-float float-claude"><b>A</b><span>Claude<small>Answer analysed</small></span><i/></div><div className="visual-float float-perplexity"><b>P</b><span>Perplexity<small>Visibility tracked</small></span><i/></div></div></section><section className="public-strip"><span>ONE WORKSPACE, FOUR LAYERS OF CLARITY</span><div><strong>01</strong> Track prompts</div><div><strong>02</strong> Compare AI engines</div><div><strong>03</strong> Inspect citations</div><div><strong>04</strong> Understand visibility</div></section><section className="public-feature-section"><div><span className="hero-kicker">BUILT FOR THE WAY AI SEARCH WORKS</span><h2>From one prompt to<br/><em>the complete picture.</em></h2></div><div className="public-feature-grid"><article><span>01</span><Activity/><h3>Track at scale</h3><p>Run an entire prompt set across the AI engines your team cares about.</p></article><article><span>02</span><Globe2/><h3>See the evidence</h3><p>Follow answers back to retrieved domains, cited sources and search queries.</p></article><article><span>03</span><BrainCircuit/><h3>Understand the story</h3><p>Explore brand sentiment, competitor mentions and model-by-model differences.</p></article><article><span>04</span><TrendingUp/><h3>Know what to do next</h3><p>Understand visibility gaps across your content and brand.</p></article></div></section><footer className="public-footer"><span>prompt<strong>pulse</strong></span><small>AI visibility, made observable.</small></footer></> : <section className="auth-layout"><div className="auth-aside"><span className="hero-kicker"><i/> PROMPTPULSE WORKSPACE</span><h1>{view==='register'?'Start measuring your AI visibility.':view==='reset'?'Get back to your workspace.':<>Welcome <em>back.</em></>}</h1><p>{view==='register'?'Create an account, set up your brand, choose your AI engines and start your first tracking cycle.':'Your prompts, AI answers and visibility history are ready when you are.'}</p><div className="auth-aside-mark"><BrandMark/><span>prompt<strong>pulse</strong></span></div></div><div className="auth-card"><button className="auth-back" onClick={()=>setView('landing')}><ArrowRight size={14}/> Back to home</button>{view==='login'&&<><span className="auth-eyebrow">ACCOUNT ACCESS</span><h2>Login</h2><p>Continue to your PromptPulse workspace.</p><form onSubmit={onSignIn}><label>Username<input required value={loginForm.username} onChange={e=>setLoginForm({...loginForm,username:e.target.value})} placeholder="Enter your username"/></label><label>Password<div className="password-field"><input required type={showPassword?'text':'password'} value={loginForm.password} onChange={e=>setLoginForm({...loginForm,password:e.target.value})} placeholder="Enter your password"/><button type="button" onClick={()=>setShowPassword(v=>!v)}>{showPassword?'Hide':'Show'}</button></div></label><button className="auth-submit" disabled={loading}>{loading?'Logging in…':'Login'} <ArrowRight size={16}/></button></form><button className="auth-text-link" onClick={()=>setView('reset')}>Forgot password?</button><div className="auth-switch">New to PromptPulse? <button onClick={()=>setView('register')}>Create an account</button></div></>}{view==='register'&&<><span className="auth-eyebrow">GET STARTED</span><h2>Create your account</h2><p>Your workspace starts with a brand, a few prompts and the AI engines you choose.</p><form onSubmit={e=>{e.preventDefault();onRegister();}}><label>Username<input required value={registerForm.username} onChange={e=>setRegisterForm({...registerForm,username:e.target.value})} placeholder="Choose a username" pattern="[A-Za-z0-9_.-]{3,80}" minLength={3} maxLength={80}/></label><label>Work email<input required type="email" value={registerForm.email} onChange={e=>setRegisterForm({...registerForm,email:e.target.value})} placeholder="you@company.com"/></label><label>Password<input required type="password" minLength={8} value={registerForm.password} onChange={e=>setRegisterForm({...registerForm,password:e.target.value})} placeholder="At least 8 characters"/></label><button className="auth-submit" disabled={loading}>Create account <ArrowRight size={16}/></button></form><div className="auth-switch">Already have an account? <button onClick={()=>setView('login')}>Login</button></div></>}{view==='reset'&&<><span className="auth-eyebrow">ACCOUNT RECOVERY</span><h2>Reset password</h2><p>Enter the email associated with your account. The reset flow will activate when the backend endpoint is available.</p><form onSubmit={e=>{e.preventDefault();onReset();}}><label>Email address<input required type="email" value={resetEmail} onChange={e=>setResetEmail(e.target.value)} placeholder="you@company.com"/></label><button className="auth-submit">Request reset link <ArrowRight size={16}/></button></form><div className="auth-switch"><button onClick={()=>setView('login')}>Return to Login</button></div></>}{message&&<div className="auth-message">{message}</div>}{error&&<div className="auth-error">{error}</div>}</div></section>}
  </div>;
}

function MarkdownAnswer({ text }) {
  const inline = (value) => value.split(/(\*\*[^*]+\*\*|`[^`]+`|\[[0-9]+(?:[,\s]+[0-9]+)*\]|\[[^\]]+\]\(https?:\/\/[^)\s]+\))/g).filter(Boolean).map((part,i)=>{
    if(part.startsWith('**')&&part.endsWith('**')) return <strong key={i}>{part.slice(2,-2)}</strong>;
    if(part.startsWith('`')&&part.endsWith('`')) return <code key={i}>{part.slice(1,-1)}</code>;
    if(/^\[[0-9]/.test(part)) return <span className="answer-citation" key={i}>{part}</span>;
    const link=part.match(/^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)$/); if(link) return <a key={i} href={link[2]} target="_blank" rel="noreferrer">{link[1]}</a>;
    return part;
  });
  const visibleText=String(text||'').replace(/\r/g,'').replace(/\n?CITED:[ \t]*[\d, ]+\s*$/i,'').replace(/\n?Cited\s+\d+\s*$/i,'');
  const lines=visibleText.split('\n'); const nodes=[]; let list=[]; let listType='';
  const flush=()=>{if(list.length){const Tag=listType==='ol'?'ol':'ul';nodes.push(<Tag key={`list-${nodes.length}`}>{list.map((item,i)=><li key={i}>{inline(item)}</li>)}</Tag>);list=[];listType='';}};
  lines.forEach((line,i)=>{const trimmed=line.trim();if(!trimmed){flush();return;}const heading=trimmed.match(/^(#{1,4})\s+(.+)$/);const bullet=trimmed.match(/^[-*+]\s+(.+)$/);const ordered=trimmed.match(/^\d+[.)]\s+(.+)$/);if(heading){flush();const level=heading[1].length;const Tag=`h${Math.min(level+1,5)}`;nodes.push(<Tag key={i}>{inline(heading[2])}</Tag>);}else if(bullet||ordered){const type=bullet?'ul':'ol';if(listType&&listType!==type)flush();listType=type;list.push((bullet||ordered)[1]);}else{flush();nodes.push(<p key={i}>{inline(trimmed)}</p>);}});flush();return <div className="markdown-answer">{nodes}</div>;
}

function AnalysisPage({ results = [], prompts = [], project, activeRunId, setActiveRunId }) {
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState('answer');
  const [competitorPage, setCompetitorPage] = useState(1);
  const [runScope, setRunScope] = useState('all');
  const promptGroups = useMemo(() => {
    const filtered = results.filter(r => runScope==='all' || String(r.cycle_id || r.batch_id || 'single')===runScope);
    const groups = new Map();
    filtered.forEach(r => {
      const key = String(r.prompt_id || r.prompt_text || r.id);
      if (!groups.has(key)) groups.set(key,{key,prompt_id:r.prompt_id,prompt_text:r.prompt_text||`Prompt #${r.prompt_id}`,runs:[]});
      groups.get(key).runs.push(r);
    });
    return [...groups.values()].map(g=>({...g,runs:g.runs.sort((a,b)=>new Date(b.created_at||0)-new Date(a.created_at||0))})).filter(g=>g.prompt_text.toLowerCase().includes(query.toLowerCase())).sort((a,b)=>new Date(b.runs[0]?.created_at||0)-new Date(a.runs[0]?.created_at||0));
  },[results,runScope,query]);
  const [selectedPromptKey,setSelectedPromptKey]=useState('');
  const selectedPrompt=promptGroups.find(g=>g.key===selectedPromptKey)||promptGroups.find(g=>g.runs.some(r=>String(r.id)===String(activeRunId)))||promptGroups[0];
  const activeRun=selectedPrompt?.runs.find(r=>String(r.id)===String(activeRunId))||selectedPrompt?.runs[0];
  const visibleResponseOptions = selectedPrompt?.runs.slice(0, 30) || []; const ownDomains=project?.domain||[];
  useEffect(()=>{if(selectedPrompt&&!promptGroups.some(g=>g.key===selectedPromptKey))setSelectedPromptKey(selectedPrompt.key);},[selectedPrompt,promptGroups,selectedPromptKey]);
  useEffect(()=>{if(activeRun&&String(activeRun.id)!==String(activeRunId))setActiveRunId(activeRun.id);},[activeRun,activeRunId,setActiveRunId]);
  return <><SectionHeading eyebrow="RUN INTELLIGENCE" title="Analysis" description={`Inspect every prompt from ${project?.brand_name||'this project'}, compare the engines that answered it, and follow the evidence behind each response.`}/><div className="analysis-workbench"><aside className="analysis-prompt-rail"><div className="analysis-rail-head"><div><strong>Prompt results</strong><small>{promptGroups.length} prompts · {results.length} executions</small></div><span>{results.length}</span></div><div className="analysis-filter-stack"><label className="analysis-search"><Search size={15}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Find a prompt…"/></label><label className="analysis-search"><Filter size={14}/><select value={runScope} onChange={e=>setRunScope(e.target.value)}><option value="all">All batches</option>{[...new Set(results.map(r=>String(r.cycle_id||r.batch_id||'single')))].map(id=><option value={id} key={id}>{id==='single'?'Single runs':`Batch ${id}`}</option>)}</select></label></div><div className="analysis-prompt-list">{promptGroups.map((g,i)=><button key={g.key} className={`analysis-prompt-item ${selectedPrompt?.key===g.key?'active':''}`} onClick={()=>{setSelectedPromptKey(g.key);setActiveRunId(g.runs[0]?.id);setTab('answer');setCompetitorPage(1)}}><span className="analysis-prompt-number">{String(i+1).padStart(2,'0')}</span><span><strong>{g.prompt_text}</strong><small>{g.runs.length} execution{g.runs.length===1?'':'s'} · {shortDate(g.runs[0]?.created_at)}</small></span><ChevronRight size={15}/></button>)}</div></aside><section className="analysis-detail-pane">{selectedPrompt&&activeRun?<><div className="analysis-detail-heading"><div><span className="analysis-label">PROMPT</span><h2>{selectedPrompt.prompt_text}</h2><div className="analysis-meta-line"><span><StatusPill status={activeRun.status}/></span><span>{dateTime(activeRun.created_at)}</span><span>Round {activeRun.round||1}</span><span>{activeRun.batch_id?`Batch ${activeRun.batch_id}`:'Single run'}</span></div></div><div className="analysis-response-select"><span>AI ENGINE</span><select className="analysis-run-select" value={activeRun.id} onChange={e=>setActiveRunId(Number(e.target.value))}>{visibleResponseOptions.map(r=><option key={r.id} value={r.id}>{(r.model||'Unknown model').replace(/^(OR|GROQ|DS):\s*/, '')} · {shortDate(r.created_at)} · Round {r.round||1} · {r.batch_id?`Batch ${r.batch_id}`:'Single run'}</option>)}</select></div></div><div className="analysis-tabs">{[['answer','Final answer'],['brand','Sentiment'],['competitors','Competitors'],['sources',`Sources (${activeRun.web_search_results?.length||0})`],['searches',`Search queries (${activeRun.search_queries?.length||0})`]].map(([id,label])=><button key={id} className={tab===id?'active':''} onClick={()=>setTab(id)}>{label}</button>)}</div><div className="analysis-content" key={`${activeRun.id}-${tab}`}>{tab==='answer'&&<div className="analysis-answer"><div className="analysis-answer-meta"><span>{activeRun.duration_ms?`${(activeRun.duration_ms/1000).toFixed(1)}s response time`:'Latency unavailable'}</span></div>{activeRun.raw_answer?<MarkdownAnswer text={activeRun.raw_answer}/>:<div className="muted-empty">No final answer was stored for this execution.</div>}</div>}{tab==='brand'&&<div className="analysis-brand-grid"><article className="analysis-brand-card analysis-sentiment-card"><span>Target sentiment</span><strong className={`sentiment-chip ${sentimentTone(activeRun.analysis?.target_sentiment||'')}`}>{activeRun.analysis?.target_sentiment||'Not classified'}</strong></article><article className="analysis-brand-card analysis-remark-card"><span>Brand remark</span><p>{activeRun.analysis?.target_remark||'No brand remark was recorded.'}</p></article><section className="analysis-mentions-section"><h3>Matched brand mentions</h3>{(activeRun.brand_mentions||[]).length?(activeRun.brand_mentions||[]).map((m,i)=><article className="analysis-mention-card" key={i}><strong>{m.matched_as}</strong><p>{m.sentence}</p></article>):<div className="muted-empty">No matched brand mentions were recorded.</div>}</section></div>}{tab==='competitors'&&<div className="analysis-compact-list">{(activeRun.analysis?.other_brands||[]).length?<><div className="analysis-list-head">{activeRun.analysis.other_brands.length} brands detected in this answer</div>{activeRun.analysis.other_brands.slice((competitorPage-1)*10,competitorPage*10).map((brand,i)=><div className="analysis-compact-row" key={brand}><span>{String((competitorPage-1)*10+i+1).padStart(2,'0')}</span><strong>{brand}</strong><small>Detected in this response</small></div>)}<Pagination page={competitorPage} pages={Math.max(1,Math.ceil(activeRun.analysis.other_brands.length/10))} onChange={setCompetitorPage}/></>:<div className="muted-empty">No competing brands were detected in this answer.</div>}</div>}{tab==='sources'&&(activeRun.web_search_results?.length?<div className="analysis-compact-list">{activeRun.web_search_results.map((src,i)=>{const isOwn=matchesOwnDomain(src.domain||src.url,ownDomains);return <a className={cx('analysis-source-compact',isOwn&&'own-source-row')} key={`${src.url}-${i}`} href={src.url} target="_blank" rel="noreferrer"><span className="analysis-source-number"><img src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(domainName(src.domain))}&sz=32`} alt="" onError={e=>e.currentTarget.style.display='none'}/><b>{String(i+1).padStart(2,'0')}</b></span><span><strong>{src.title||src.domain}{isOwn&&<em>Your brand</em>}</strong><small>{domainName(src.domain)}</small></span><b className={src.cited?'cited':'retrieved'}>{src.cited?'Cited':'Retrieved'}</b></a>})}</div>:<div className="muted-empty">No source records were stored for this execution.</div>)}{tab==='searches'&&(activeRun.search_queries?.length?<ol className="analysis-query-list">{activeRun.search_queries.map((q,i)=><li key={i}><span>{String(i+1).padStart(2,'0')}</span>{q.query}</li>)}</ol>:<div className="muted-empty">No search queries were stored for this execution.</div>)}</div></>:<div className="analysis-empty"><BrainCircuit size={28}/><h3>No run analysis yet</h3><p>Once a tracking cycle has completed, select a prompt here to inspect its answer, sentiment, competitors, sources and search queries in one place.</p></div>}</section></div></>;
}

function OverviewPage({ project, summary, prompts, results, citations, onRun, onNavigate, onOpenRun, loading }) {
  const topCompetitors = summary?.top_competitors || [];
  const mentions = summary?.mentioned_count || 0;
  return <>
    <SectionHeading eyebrow="WORKSPACE OVERVIEW" title="Visibility overview" description={`A clear view of how ${project.brand_name} appears across AI-generated answers.`} action={<Button icon={Play} onClick={onRun}>Run tracking</Button>}/>
    <div className="overview-meta"><span className="meta-brand"><span className="brand-mini">{project.brand_name.slice(0,1).toUpperCase()}</span><strong>{project.brand_name}</strong></span><span className="meta-separator"/><span><Target size={14}/>{prompts.filter(p => p.active).length} active prompts</span></div>
    <div className="dashboard-grid dashboard-grid-main"><section className="panel visibility-panel"><div className="panel-heading"><div><h2>Brand visibility</h2><p>Share of completed answers that mention your brand</p></div><span className="panel-period">ALL TIME</span></div><div className="visibility-summary"><div className="visibility-rate"><strong>{pct(summary?.visibility_percentage)}</strong><span>Brand mention rate</span></div><div className="visibility-run-count"><span>Completed runs</span><strong>{number(results.filter(r => r.status === 'done').length)}</strong></div></div><VisibilityChart results={results}/></section><section className="panel source-panel"><div className="panel-heading"><div><h2>Top cited sources</h2><p>Domains appearing in AI answers</p></div><button className="text-action" onClick={() => onNavigate('sources')}>View all <ArrowRight size={14}/></button></div><div className="overview-domain-signal"><div><span>Domain citation rate</span><strong>{pct(summary?.own_domain_citation_percentage)}</strong></div><div><span>Answers citing your domain</span><strong>{number(summary?.own_domain_cited_count || 0)}</strong></div></div><CitationBars citations={citations} limit={5} ownDomains={project.domain||[]}/><div className="panel-footnote"><span>Retrieved / cited appearances</span><span className="footnote-key"><i/> Cited</span></div></section></div>
    <div className="dashboard-grid dashboard-grid-bottom"><section className="panel table-panel"><div className="panel-heading"><div><h2>Recent tracking activity</h2><p>Latest completed runs across this project</p></div><button className="text-action" onClick={() => onNavigate('runs')}>All runs <ArrowRight size={14}/></button></div>{results.length ? <div className="table-wrap"><table><thead><tr><th>Prompt</th><th>Model</th><th>Status</th><th>Duration</th><th>Run date</th><th/></tr></thead><tbody>{results.slice(0,5).map(r => <tr key={r.id} onClick={() => onOpenRun(r)} className="click-row"><td><span className="prompt-cell">{r.prompt_text || `Prompt #${r.prompt_id}`}</span></td><td><span className="model-cell">{(r.model || '—').replace(/^(OR|GROQ|DS):\s*/, '')}</span></td><td><StatusPill status={r.status}/></td><td>{r.duration_ms ? `${(r.duration_ms / 1000).toFixed(1)}s` : '—'}</td><td>{shortDate(r.created_at)}</td><td><ChevronRight size={15}/></td></tr>)}</tbody></table></div> : <EmptyState icon={Activity} title="No tracking activity yet" description="Run your active prompts to start collecting real AI visibility data." action={<Button size="small" onClick={onRun} icon={Play}>Start first run</Button>}/>}</section><section className="panel competitor-panel"><div className="panel-heading"><div><h2>Competitor mentions</h2><p>Brands appearing alongside yours</p></div><button className="text-action" onClick={() => onNavigate('competitors')}>Explore <ArrowRight size={14}/></button></div>{topCompetitors.length ? <div className="competitor-list">{topCompetitors.slice(0,5).map((c, i) => <div className="competitor-row" key={c.brand}><span className="competitor-rank">{String(i + 1).padStart(2, '0')}</span><span className="competitor-name">{c.brand}</span><span className="competitor-count">{c.count} <small>mentions</small></span></div>)}</div> : <div className="muted-empty">Competitor intelligence will appear as completed answers are analysed.</div>}</section></div>
    {loading && <div className="page-loading"><Loader2 size={15}/> Updating project data…</div>}
  </>;
}

function PromptsPage({ prompts, allCount, activeCount, search, setSearch, onBulk, onGenerate, onToggle, onRun, onDelete, onEdit, loading }) {
  const [showActive,setShowActive]=useState(true), [showPaused,setShowPaused]=useState(true), [pageNumber,setPageNumber]=useState(1);
  useEffect(()=>setPageNumber(1),[search,showActive,showPaused]);
  const filtered=prompts.filter(p=>(p.active&&showActive)||(!p.active&&showPaused));
  const pages=Math.max(1,Math.ceil(filtered.length/10)); const rows=filtered.slice((pageNumber-1)*10,pageNumber*10);
  return <><SectionHeading eyebrow="PROMPT MANAGEMENT" title="Prompt library" description="The questions your customers ask and the prompts you use to measure your visibility." action={<div className="button-row"><Button variant="secondary" icon={Sparkles} onClick={onGenerate}>Generate ideas</Button><Button icon={Plus} onClick={onBulk}>Add Prompt(s)</Button></div>}/><section className="panel prompt-library-panel"><div className="prompt-library-toolbar"><label className="search-field prompt-library-search"><Search size={17}/><input value={search} onChange={e=>{setSearch(e.target.value);setPageNumber(1)}} placeholder="Search your prompt library…"/><span className="search-clear" onClick={()=>{setSearch('');setPageNumber(1)}} role="button" aria-label="Clear search">×</span></label><strong className="prompt-count"><b>{filtered.length}</b><span>prompts</span></strong><label className="prompt-check-filter"><input type="checkbox" checked={showActive} onChange={e=>{setShowActive(e.target.checked);setPageNumber(1)}}/> Active</label><label className="prompt-check-filter"><input type="checkbox" checked={showPaused} onChange={e=>{setShowPaused(e.target.checked);setPageNumber(1)}}/> Paused</label></div>{rows.length ? <><div className="prompt-list">{rows.map((p,i)=><article className="prompt-item" key={p.id}><span className="prompt-index">{String((pageNumber-1)*10+i+1).padStart(2,'0')}</span><div className="prompt-main"><p>{p.text}</p><div className="prompt-tags"><span className="intent-tag">{p.intent_display || p.intent || 'Customer query'}</span><span className={cx('prompt-state',p.active?'state-active':'state-paused')}>{p.active?'Active':'Paused'}</span></div></div><div className="prompt-actions"><button className="subtle-action" onClick={()=>onRun(p)} title="Run this prompt"><Play size={15}/><span>Run</span></button><button className="subtle-action" onClick={()=>onEdit(p)} title="Edit prompt"><Settings2 size={14}/><span>Edit</span></button><button className={cx('toggle-switch',p.active&&'toggle-on')} onClick={()=>onToggle(p)} aria-label={p.active?'Pause prompt':'Activate prompt'}><i/></button><IconButton icon={Trash2} label="Delete prompt" onClick={()=>onDelete(p)} className="danger-icon"/></div></article>)}</div><div className="prompt-pagination"><span>{filtered.length} prompts · {activeCount} active of {allCount}</span><Pagination page={pageNumber} pages={pages} onChange={setPageNumber}/></div></>:<EmptyState icon={MessageSquareText} title={allCount?'No prompts match these filters':'Your prompt library is empty'} description={allCount?'Adjust the search text or turn Active/Paused back on.':'Add customer questions or generate a starting set of prompts for this brand.'} action={!search&&<div className="button-row"><Button variant="secondary" icon={Sparkles} onClick={onGenerate}>Generate ideas</Button><Button icon={Plus} onClick={onBulk}>Add Prompt(s)</Button></div>}/>}</section>{loading&&<div className="page-loading"><Loader2 size={15}/> Updating prompts…</div>}</>;
}

function RunsPage({ results, filter, setFilter, search, setSearch, onRun, onOpen, onDelete, onClear, loading }) {
  const [roundFilter, setRoundFilter] = useState('all');
  const [batchFilter, setBatchFilter] = useState('all');
  const runSearch = search; const setRunSearch = setSearch;
  const batchIds=[...new Set(results.map(r=>r.batch_id).filter(Boolean).map(String))];
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const counts = { all: results.length, done: results.filter(r => r.status === 'done').length, failed: results.filter(r => r.status === 'failed').length, running: results.filter(r => ['running','queued'].includes(r.status)).length };
  const statusRows = results.filter(r => filter === 'all' || (filter === 'running' ? ['running','queued'].includes(r.status) : r.status === filter));
  const visible = statusRows.filter(r => `${r.prompt_text||''} ${r.model||''} ${r.id}`.toLowerCase().includes(runSearch.toLowerCase()) && (roundFilter === 'all' || String(r.round) === roundFilter) && (batchFilter === 'all' || String(r.batch_id||'') === batchFilter) && (!fromDate || new Date(r.created_at) >= new Date(`${fromDate}T00:00:00`)) && (!toDate || new Date(r.created_at) <= new Date(`${toDate}T23:59:59`)));
  return <><SectionHeading eyebrow="EXECUTION HISTORY" title="Tracking runs" description="Inspect individual executions, batch progress and the evidence behind every answer." action={<div className="button-row"><Button variant="secondary" icon={Trash2} onClick={onClear} disabled={!results.length}>Clear history</Button><Button icon={Play} onClick={onRun}>New tracking cycle</Button></div>}/><section className="panel"><div className="list-toolbar"><div className="filter-tabs">{[['all','All runs'],['done','Completed'],['failed','Failed'],['running','In progress']].map(([id,label]) => <button key={id} onClick={(event) => { const scrollContainer = document.querySelector('.content-area'); const y = scrollContainer?.scrollTop || 0; setFilter(id); requestAnimationFrame(() => { if (scrollContainer) scrollContainer.scrollTop = y; }); }} className={filter === id ? 'filter-active' : ''}>{label}<span>{counts[id]}</span></button>)}</div><span className="toolbar-count">Newest first</span></div><div className="run-filter-row"><label className="run-search-field"><Search size={14}/><input value={runSearch} onChange={e=>setRunSearch(e.target.value)} placeholder="Search prompt or model…"/></label><label>Batch<select value={batchFilter} onChange={e=>setBatchFilter(e.target.value)}><option value="all">All batches</option>{batchIds.map(id=><option key={id} value={id}>Batch {id}</option>)}</select></label><label>Round<select value={roundFilter} onChange={e=>setRoundFilter(e.target.value)}><option value="all">All rounds</option><option value="1">Round 1</option><option value="2">Round 2</option><option value="3">Round 3</option></select></label><label>From<input type="date" value={fromDate} onChange={e=>setFromDate(e.target.value)}/></label><label>To<input type="date" value={toDate} onChange={e=>setToDate(e.target.value)}/></label><button onClick={()=>{setRunSearch('');setRoundFilter('all');setBatchFilter('all');setFromDate('');setToDate('');}}>Reset filters</button></div>{visible.length ? <div className="table-wrap"><table className="runs-table"><thead><tr><th>Prompt</th><th>Batch</th><th>Model</th><th>Status</th><th>Duration</th><th>Created</th><th/></tr></thead><tbody>{visible.map(r => <tr key={r.id} className="click-row" onClick={() => onOpen(r)}><td><span className="prompt-cell">{r.prompt_text || `Prompt #${r.prompt_id}`}</span><small className="table-subline">Execution #{r.id} · Round {r.round}</small></td><td>{r.batch_id ? <span className="batch-tag">Batch {r.batch_id}</span> : 'Single'}</td><td><span className="model-cell">{r.model || '—'}</span></td><td><StatusPill status={r.status}/></td><td>{r.duration_ms ? `${(r.duration_ms / 1000).toFixed(1)}s` : '—'}</td><td>{dateTime(r.created_at)}</td><td><button className="row-more" onClick={e => { e.stopPropagation(); onDelete(r.id); }} title="Delete execution"><Trash2 size={15}/></button></td></tr>)}</tbody></table></div> : <EmptyState icon={Activity} title="No runs in this view" description="Adjust the filters or start a tracking batch to see executions." action={<Button icon={Play} onClick={onRun}>Start tracking</Button>}/>}</section>{loading && <div className="page-loading"><Loader2 size={15}/> Refreshing execution history…</div>}</>;
}

function SourcesPage({ citations, allCitations, project, search, setSearch, results, loading }) {
  const [pageNumber,setPageNumber]=useState(1);
  useEffect(()=>setPageNumber(1),[search]);
  const [domainOpen,setDomainOpen]=useState(true);
  const totalRetrieved=allCitations.reduce((n,c)=>n+(c.retrieved||0),0), totalCited=allCitations.reduce((n,c)=>n+(c.cited||0),0);
  const sourceRows=results.flatMap(r=>(r.web_search_results||[]).map(s=>({...s,execution:r.id,prompt:r.prompt_text,created_at:r.created_at,model:r.model})));
  const filteredRows=sourceRows.filter(s=>`${s.domain} ${s.title||''} ${s.snippet||''}`.toLowerCase().includes(search.toLowerCase()));
  const pages=Math.max(1,Math.ceil(filteredRows.length/10)); const pageRows=filteredRows.slice((pageNumber-1)*10,pageNumber*10);
  const ownDomains=project?.domain||[];
  const rankedDomains=allCitations.slice().sort((a,b)=>(b.retrieved||0)-(a.retrieved||0));
  const topDomains=rankedDomains.slice(0,10);
  const ownCitation=rankedDomains.find(x=>matchesOwnDomain(x.domain, [ownDomains[0]]));
  if(ownCitation && !topDomains.some(x=>matchesOwnDomain(x.domain,[ownDomains[0]]))) { if(topDomains.length===10) topDomains[9]=ownCitation; else topDomains.push(ownCitation); }
  return <><SectionHeading eyebrow="SOURCE INTELLIGENCE" title="Sources & citations" description="Workspace-wide source intelligence across every completed tracking cycle."/>
    <div className="source-overview-grid"><section className={`panel source-rank-panel ${domainOpen?'is-expanded':'is-collapsed'}`}><div className="panel-heading"><div><h2>Domain performance</h2><p>Domains ranked by retrieved and cited appearances</p></div><div className="domain-heading-actions"><button className="collapse-control icon-collapse" aria-label={domainOpen?'Collapse domain performance':'Expand domain performance'} onClick={()=>setDomainOpen(v=>!v)}><ChevronDown className={domainOpen?'rotated':''} size={17}/></button></div></div>{domainOpen&&<><div className="citation-bars">{topDomains.length?topDomains.map((item,i)=>{const max=Math.max(1,...rankedDomains.map(x=>x.retrieved||0));const isOwn=matchesOwnDomain(item.domain, ownDomains);const rank=rankedDomains.findIndex(x=>x.domain===item.domain)+1;return <div className={`citation-bar-row ${isOwn?'own-domain-row':''}`} key={item.domain}><div className="citation-domain"><span className="domain-rank">{String(rank).padStart(2,'0')}</span><span>{domainName(item.domain)}{isOwn&&<em>Your brand</em>}</span></div><div className="bar-track"><span style={{width:`${Math.max(3,(item.retrieved/max)*100)}%`}}/></div><div className="bar-count">{item.cited}<small> / {item.retrieved}</small></div></div>}) : <div className="muted-empty">No source domain data yet.</div>}</div></>}</section>
      <div className="source-summary-strip"><span><strong>{number(allCitations.length)}</strong> domains observed</span><span><strong>{number(totalRetrieved)}</strong> retrieved appearances</span><span><strong>{number(totalCited)}</strong> cited appearances</span><span><strong>{allCitations.length?Math.round(totalCited/Math.max(totalRetrieved,1)*100):0}%</strong> citation rate</span></div></div>
    <section className="panel source-table-panel"><div className="panel-heading"><div><h2>Observed sources</h2><p>Individual pages referenced by AI answers</p></div><div className="source-heading-tools"><span className="toolbar-count">{filteredRows.length} sources</span><Pagination page={pageNumber} pages={pages} onChange={setPageNumber}/></div></div><div className="list-toolbar" id="observed-source-toolbar"><div className="search-field"><Search size={16}/><input value={search} onChange={e=>{setSearch(e.target.value);setPageNumber(1)}} placeholder="Search domains or source titles…"/></div><span className="toolbar-count">{pageRows.length} on this page</span></div>{pageRows.length?<div className="table-wrap"><table><thead><tr><th>Source</th><th>Reference</th></tr></thead><tbody>{pageRows.map((src,i)=>{const isOwn=matchesOwnDomain(src.domain||src.url,ownDomains);return <tr className={isOwn?'own-source-row':''} key={`${src.execution}-${src.url}-${i}`}><td><a className="source-title" href={src.url} target="_blank" rel="noreferrer">{src.title||src.url}{isOwn&&<em>Your brand</em>}<ExternalLink size={12}/></a></td><td><span className={cx('citation-state',src.cited?'citation-yes':'citation-no')}>{src.cited?'Cited':'Retrieved'}</span></td></tr>})}</tbody></table></div>:<div className="table-empty">No matching source records.</div>}<Pagination page={pageNumber} pages={pages} onChange={setPageNumber}/>{loading&&<div className="page-loading"><Loader2 size={15}/> Updating sources…</div>}</section></>;
}

function CompetitorsPage({ summary, results, project, search, setSearch, loading }) {
  const [pageNumber,setPageNumber]=useState(1);
  const [competitorsOpen,setCompetitorsOpen]=useState(true);
  const allCounts=summary?.top_competitors||[]; const total=allCounts.reduce((s,c)=>s+c.count,0);
  const counts=allCounts.filter(c=>c.brand.toLowerCase().includes((search||'').toLowerCase()));
  const pages=Math.max(1,Math.ceil(counts.length/10)); const pageRows=counts.slice((pageNumber-1)*10,pageNumber*10);
  useEffect(()=>setPageNumber(1),[search,pages]);
  return <><SectionHeading eyebrow="COMPETITIVE LANDSCAPE" title="Competitor intelligence" description={`Understand which brands appear alongside ${project.brand_name} across AI-generated answers.`}/>
    <div className="competitor-board"><section className={`panel competitor-rank-panel ${competitorsOpen?'is-expanded':'is-collapsed'}`}><div className="panel-heading"><div><h2>Most-mentioned competitors</h2><p>Brands appearing in analysed answers</p></div><div className="competitor-heading-actions"><label className="competitor-search"><Search size={14}/><input value={search||''} onChange={e=>setSearch(e.target.value)} placeholder="Search competitors…"/></label><span className="panel-period">{counts.length} BRANDS</span>{pages>1&&<Pagination page={pageNumber} pages={pages} onChange={setPageNumber}/>}<button className="collapse-control icon-collapse" aria-label={competitorsOpen?'Collapse competitors':'Expand competitors'} onClick={()=>setCompetitorsOpen(v=>!v)}><ChevronDown className={competitorsOpen?'rotated':''} size={17}/></button></div></div>{competitorsOpen ? (pageRows.length ? <><div className="ranked-competitors">{pageRows.map((c,i)=><div className="ranked-competitor" key={c.brand}><span className="competitor-rank">{String((pageNumber-1)*10+i+1).padStart(2,'0')}</span><div className="ranked-main"><div><strong>{c.brand}</strong><span>{c.count} mentions</span></div><div className="rank-track"><i style={{width:`${Math.max(2,c.count/Math.max(total,1)*100)}%`}}/></div></div><strong className="rank-share">{total?pct(c.count/total*100):'0%'}</strong></div>)}</div>{pages>1&&<Pagination page={pageNumber} pages={pages} onChange={setPageNumber}/>}</>:<EmptyState icon={Layers3} title="No competitor mentions yet" description="Competitor co-mentions will appear after completed answers have been analysed."/>) : null}</section>
</div>
    {loading&&<div className="page-loading"><Loader2 size={15}/> Updating competitor data…</div>}</>;
}

function Pagination({page,pages,onChange}) { const values=[...new Set([1, ...(page>3?[null]:[]), ...Array.from({length:pages},(_,i)=>i+1).filter(n=>n>=Math.max(2,page-1)&&n<=Math.min(pages-1,page+1)), ...(page<pages-2?[null]:[]), ...(pages>1?[pages]:[])])]; return <div className="pagination"><div><button disabled={page<=1} onClick={()=>onChange(page-1)}>Previous</button>{values.map((n,i)=>n===null?<span className="pagination-ellipsis" key={`e${i}`}>…</span>:<button key={n} className={page===n?'current':''} aria-current={page===n?'page':undefined} onClick={()=>onChange(n)}>{n}</button>)}<button disabled={page>=pages} onClick={()=>onChange(page+1)}>Next</button></div></div>; }

function ModelLabPage({ prompts, comparePrompt, setComparePrompt, report, loading, onCompare }) {
  return <><SectionHeading eyebrow="MODEL INTELLIGENCE" title="Model comparison" description="Run the same customer question across multiple AI engines and compare how each one represents your brand."/><section className="panel compare-form-panel"><div className="compare-intro"><div className="compare-icon"><BrainCircuit size={21}/></div><div><h2>Set up an evaluation</h2><p>Choose a saved prompt or enter a custom customer question.</p></div></div><label>Prompt to evaluate<select value={comparePrompt} onChange={e => setComparePrompt(e.target.value)}><option value="">Choose a saved prompt…</option>{prompts.map(p => <option value={p.text} key={p.id}>{p.text}</option>)}</select></label><div className="or-divider"><span>OR WRITE YOUR OWN</span></div><label>Custom prompt<textarea rows="3" value={comparePrompt} onChange={e => setComparePrompt(e.target.value)} placeholder="Which brands offer the best value for money in this category?"/></label><div className="compare-submit"><span><ShieldCheck size={15}/> Evaluates mention presence, rank, sentiment, latency and citations.</span><Button icon={Zap} onClick={onCompare} disabled={!comparePrompt.trim() || loading}>{loading ? 'Evaluating models…' : 'Compare AI models'}</Button></div>{loading && <div className="inline-loading"><Loader2 size={18}/> Running a cross-model evaluation. This may take a little while…</div>}</section>{report && <><div className="compare-results-heading"><div><div className="eyebrow">EVALUATION RESULTS</div><h2>How the models responded</h2><p>{report.prompt_text}</p></div><span className="panel-period">{report.models_evaluated} MODELS TESTED</span></div><div className="metric-grid metric-grid-three"><MetricCard label="Visibility score" value={pct(report.visibility_score_pct)} detail="Models that mentioned your brand" icon={Eye} accent="green"/><MetricCard label="Brand mentions" value={`${report.models_mentioning_brand} / ${report.models_evaluated}`} detail="AI engines that included your brand" icon={Target} accent="blue"/><MetricCard label="Models evaluated" value={report.models_evaluated} detail="Independent model responses" icon={BrainCircuit} accent="violet"/></div><div className="model-result-grid">{report.evaluations.map((e,i) => <article className="panel model-result-card" key={`${e.model_id}-${i}`}><div className="model-result-top"><span className="model-provider">{e.provider}</span><span className={cx('mention-badge', e.mentioned ? 'mention-yes' : 'mention-no')}>{e.mentioned ? 'Brand mentioned' : 'Not mentioned'}</span></div><h3>{e.display_name || e.model_id}</h3><p>{e.summary || e.error || 'No summary available.'}</p><div className="model-result-stats"><div><span>Sentiment</span><strong className={`sentiment-chip ${sentimentTone(e.sentiment)}`}>{e.sentiment || '—'}</strong></div><div><span>Rank</span><strong>{e.rank ?? '—'}</strong></div><div><span>Latency</span><strong>{e.latency_ms ? `${Math.round(e.latency_ms)} ms` : '—'}</strong></div><div><span>Citations</span><strong>{e.citations?.length || 0}</strong></div></div><details><summary>Read full response</summary><div className="full-response">{e.full_response || e.error || 'No response content.'}</div></details></article>)}</div></>}</>;
}

function SettingsPage({ project, canViewDiagnostics, projectConfig, setProjectConfig, onSaveProjectConfig, onDeleteProject, onEditProject }) {
  return <><SectionHeading eyebrow="WORKSPACE CONFIGURATION" title="Project Settings" description="Configure the brand identity, context, AI engines and tracking schedule for the selected project." action={canViewDiagnostics&&<Button variant="secondary" icon={Gauge} onClick={()=>window.dispatchEvent(new CustomEvent('pp-open-diagnostics'))}>Diagnostics</Button>}/><div className="settings-layout"><div className="settings-main"><section className="panel settings-panel"><div className="settings-section-head"><div><h2>Brand identity</h2><p>These details are used to identify your brand in AI-generated answers.</p></div><button className="button button-secondary button-small" onClick={onEditProject}>Edit brand identity</button></div><div className="settings-field-grid"><div><span>Brand name</span><strong>{project.brand_name}</strong></div><div><span>Project ID</span><strong>#{project.id}</strong></div><div className="settings-field-full"><span>Website domains</span><div className="tag-list">{project.domain?.length ? project.domain.map(d => <span key={d}>{d}</span>) : <em>No domains configured</em>}</div></div><div className="settings-field-full"><span>Brand aliases</span><div className="tag-list">{project.aliases?.length ? project.aliases.map(d => <span key={d}>{d}</span>) : <em>No aliases configured</em>}</div></div><div className="settings-field-full"><span>Known competitors</span><div className="tag-list">{project.competitors?.length ? project.competitors.map(d => <span key={d}>{d}</span>) : <em>No competitors configured</em>}</div></div></div></section><section className="panel settings-panel"><div className="settings-section-head"><div><h2>Brand context</h2><p>Give the analysis engine useful category, market and audience context for this project.</p></div><Globe2 size={19}/></div><div className="form-stack brand-context-form"><label>Brand description<textarea rows="3" value={projectConfig?.brandContext?.description||''} onChange={e=>setProjectConfig(old=>({...old,brandContext:{...(old.brandContext||{}),description:e.target.value}}))} placeholder="What does the brand offer, and what makes it distinct?"/></label><div className="form-grid"><label>Industry / category<input value={projectConfig?.brandContext?.industry||''} onChange={e=>setProjectConfig(old=>({...old,brandContext:{...(old.brandContext||{}),industry:e.target.value}}))} placeholder="Consumer electronics"/></label><label>Primary market<input value={projectConfig?.brandContext?.market||''} onChange={e=>setProjectConfig(old=>({...old,brandContext:{...(old.brandContext||{}),market:e.target.value}}))} placeholder="India, Global…"/></label><label>Target audience<input value={projectConfig?.brandContext?.audience||''} onChange={e=>setProjectConfig(old=>({...old,brandContext:{...(old.brandContext||{}),audience:e.target.value}}))} placeholder="Students, professionals…"/></label><label>Core topics / product areas<input value={(projectConfig?.brandContext?.topics||[]).join(', ')} onChange={e=>setProjectConfig(old=>({...old,brandContext:{...(old.brandContext||{}),topics:e.target.value.split(',').map(x=>x.trim()).filter(Boolean)}}))} placeholder="wireless audio, travel, ANC"/></label></div><div className="settings-actions"><Button icon={Check} onClick={onSaveProjectConfig}>Save brand context</Button></div><div className="settings-note"><ShieldCheck size={15}/> Brand context is saved to this project and shared by its tracking and analysis workflows.</div></div></section><section className="panel settings-panel"><div className="settings-section-head"><div><h2>Tracking engines & schedule</h2><p>Choose the AI engines included in every new tracking cycle and how often the project should run.</p></div><Activity size={19}/></div><div className="settings-provider-grid">{PROVIDER_PRESETS.map(provider=><label key={provider.id}><input type="checkbox" checked={(projectConfig?.models||[]).includes(provider.model)} onChange={e=>setProjectConfig(old=>({...old,models:e.target.checked?[...(old.models||[]),provider.model]:(old.models||[]).filter(x=>x!==provider.model)}))}/><ProviderMark provider={provider}/><strong>{provider.name}</strong></label>)}</div><div className="settings-schedule-row"><label>Automatic tracking frequency<select value={projectConfig?.frequency||'manual'} onChange={e=>setProjectConfig(old=>({...old,frequency:e.target.value,autoRun:e.target.value!=='manual'}))}><option value="manual">Manual only</option><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select></label><label>Preferred run time<input type="time" value={projectConfig?.scheduleTime||'09:00'} onChange={e=>setProjectConfig(old=>({...old,scheduleTime:e.target.value}))}/></label><span>{projectConfig?.frequency==='manual'?'No automatic runs configured.':`${projectConfig?.frequency} cadence saved; scheduler execution must be enabled by the deployment.`}</span></div><div className="settings-actions"><Button icon={Check} onClick={onSaveProjectConfig}>Save tracking preferences</Button></div><div className="settings-note"><ShieldCheck size={15}/> Engine and schedule preferences are stored with this project.</div></section></div><aside className="settings-aside"><section className="panel danger-zone"><div className="settings-section-head"><div><h2>Danger zone</h2><p>Permanent project actions</p></div><AlertTriangle size={18}/></div><p>Deleting this project permanently removes its prompts, tracking batches, executions and associated analysis.</p><Button variant="danger" icon={Trash2} onClick={onDeleteProject}>Delete project</Button></section></aside></div></>;
}

function RunDetailModal({ run, ownDomains=[], onClose, onDelete }) {
  const [tab, setTab] = useState('answer');
  const [competitorPage, setCompetitorPage] = useState(1);
  return <Modal title={`Execution #${run.id}`} subtitle={`${run.prompt_text || `Prompt #${run.prompt_id}`} · ${dateTime(run.created_at)}`} onClose={onClose} wide><div className="run-detail-meta"><StatusPill status={run.status}/><span>{run.model || 'Model not recorded'}</span><span>{run.duration_ms ? `${(run.duration_ms / 1000).toFixed(2)}s` : 'Duration unavailable'}</span><span>Round {run.round}</span>{run.batch_id && <span>Batch {run.batch_id}</span>}</div>{run.error && <div className="alert alert-error"><AlertTriangle size={15}/>{run.error}</div>}<div className="detail-tabs">{[['answer','Final answer'],['sources',`Sources (${run.web_search_results?.length || 0})`],['searches',`Search queries (${run.search_queries?.length || 0})`],['analysis','Brand analysis']].map(([id,label]) => <button key={id} onClick={() => setTab(id)} className={tab === id ? 'detail-tab-active' : ''}>{label}</button>)}</div><div className="run-detail-content">{tab === 'answer' && <div className="answer-content">{run.raw_answer ? <MarkdownAnswer text={run.raw_answer}/> : <div className="muted-empty">No final answer was stored for this execution.</div>}</div>}{tab === 'sources' && (run.web_search_results?.length ? <div className="detail-source-list">{run.web_search_results.map((s,i) => {const isOwn=matchesOwnDomain(s.domain||s.url,ownDomains);return <a href={s.url} target="_blank" rel="noreferrer" className={cx('detail-source',isOwn&&'own-source-row')} key={`${s.url}-${i}`}><span className="source-favicon"><img src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(domainName(s.domain))}&sz=32`} alt="" onError={e=>e.currentTarget.style.display='none'}/><b>{String(i+1).padStart(2,'0')}</b></span><span><strong>{s.title || s.domain}{isOwn&&<em>Your brand</em>}</strong><small>{s.cited ? 'Cited' : 'Retrieved'}</small></span><span className={cx('citation-state', s.cited ? 'citation-yes' : 'citation-no')}>{s.cited ? 'Cited' : 'Retrieved'}</span><ExternalLink size={14}/></a>})}</div> : <div className="muted-empty">No web sources were stored.</div>)}{tab === 'searches' && (run.search_queries?.length ? <ol className="search-query-list">{run.search_queries.map((s,i) => <li key={i}>{s.query}</li>)}</ol> : <div className="muted-empty">No search queries were stored.</div>)}{tab === 'analysis' && (run.analysis ? <div className="analysis-detail"><div className="analysis-stat"><span>Target sentiment</span><strong className={`sentiment-chip ${sentimentTone(run.analysis.target_sentiment)}`}>{run.analysis.target_sentiment}</strong></div><div className="analysis-remark"><span>Brand remark</span><p>{run.analysis.target_remark || 'No remark recorded.'}</p></div>{run.brand_mentions?.length > 0 && <div className="analysis-remark"><span>Matched brand mentions</span>{run.brand_mentions.map((m,i) => <blockquote key={i}>{m.sentence}<small>Matched as: {m.matched_as}</small></blockquote>)}</div>}</div> : <div className="muted-empty">No structured brand analysis was stored.</div>)}</div><div className="modal-actions"><Button variant="danger" icon={Trash2} onClick={onDelete}>Delete execution</Button><Button variant="secondary" onClick={onClose}>Close</Button></div></Modal>;
}

export default App;
