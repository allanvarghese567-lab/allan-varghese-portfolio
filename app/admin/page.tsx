'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import initialData from '../../src/data/portfolio.json';
import { ROLE_TYPES, CURRENT_ROLE, monthsSinceEarliestStart, formatExperienceLabel, withExperience, normalizeExperience, validateExperience, INSERT_TOKENS, resolveTokens, buildTokenContext } from '../../src/lib/experience';
import { ensureExperienceIds, allSkillNames, experienceLabel, newId, toList, diffSkillEdit, applySkillRenames, type PendingRename, type Project } from '../../src/lib/links';
import {
  ArrowLeft, Download, RotateCcw, Save, Plus, Trash2, Upload, Github, Loader2, Settings, Lock, LogOut, Eye, EyeOff,
} from 'lucide-react';

type Portfolio = Omit<typeof initialData, 'projects'> & { projects: Project[] };
const STORAGE_KEY = 'allan-portfolio-admin-draft-v1';
const GH_SETTINGS_KEY = 'allan-portfolio-gh-settings-v1';
const AUTH_KEY = 'allan-portfolio-admin-auth-v1';
const ADMIN_PASSWORD = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || '';
const normalize = (d: Portfolio): Portfolio => ({ ...d, experience: ensureExperienceIds(normalizeExperience(d.experience)) });
const cloneInitial = () => normalize(JSON.parse(JSON.stringify(initialData)) as Portfolio);

interface GhSettings { owner: string; repo: string; token: string; proxyUrl: string; publishKey: string; }
const DEFAULT_GH: GhSettings = {
  owner: process.env.NEXT_PUBLIC_GITHUB_OWNER || 'allanvarghese567-lab',
  repo: process.env.NEXT_PUBLIC_GITHUB_REPO || 'allan-varghese-portfolio',
  token: '',
  proxyUrl: process.env.NEXT_PUBLIC_PUBLISH_PROXY_URL || '',
  publishKey: '',
};

export default function AdminPage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [data, setData] = useState<Portfolio>(cloneInitial);
  const [active, setActive] = useState('profile');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [raw, setRaw] = useState('');
  const [rawError, setRawError] = useState('');
  const [gh, setGh] = useState<GhSettings>(DEFAULT_GH);
  const [publishing, setPublishing] = useState(false);
  const [showGhSettings, setShowGhSettings] = useState(false);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(AUTH_KEY) === '1' || localStorage.getItem(AUTH_KEY) === '1') setAuthenticated(true);
    } catch {}
    setAuthChecked(true);
  }, []);

  useEffect(() => {
    if (!authenticated) return;
    try { const s = localStorage.getItem(STORAGE_KEY); if (s) setData(normalize(JSON.parse(s))); } catch {}
    try { const s = localStorage.getItem(GH_SETTINGS_KEY); if (s) setGh({ ...DEFAULT_GH, ...JSON.parse(s) }); } catch {}
  }, [authenticated]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    if (!ADMIN_PASSWORD) {
      setLoginError('Admin password is not configured. Set NEXT_PUBLIC_ADMIN_PASSWORD in .env.local and redeploy.');
      return;
    }
    if (loginPassword === ADMIN_PASSWORD) {
      setAuthenticated(true);
      try {
        sessionStorage.setItem(AUTH_KEY, '1');
        if (rememberMe) localStorage.setItem(AUTH_KEY, '1');
        else localStorage.removeItem(AUTH_KEY);
      } catch {}
      setLoginPassword('');
    } else setLoginError('Incorrect password.');
  };

  const handleLogout = () => {
    setAuthenticated(false);
    try { sessionStorage.removeItem(AUTH_KEY); localStorage.removeItem(AUTH_KEY); } catch {}
    setActive('profile'); setNotice(''); setError('');
  };

  const months = useMemo(() => monthsSinceEarliestStart(data.experience), [data.experience]);

  const tokenCtx = buildTokenContext(data);

  // ---- Insert-at-cursor ----
  type TextEl = HTMLInputElement | HTMLTextAreaElement;
  const lastField = useRef<{ el: TextEl; start: number; end: number } | null>(null);
  const isTextField = (el: unknown): el is TextEl =>
    (el instanceof HTMLInputElement && el.type === 'text') || el instanceof HTMLTextAreaElement;

  // Remember the last text field + caret/selection, so a button click can still use it.
  const rememberField = (e: React.SyntheticEvent) => {
    const el = e.target;
    if (!isTextField(el) || el.disabled || el.readOnly) return;
    lastField.current = { el, start: el.selectionStart ?? el.value.length, end: el.selectionEnd ?? el.value.length };
  };

  const insertAtCursor = (text: string) => {
    const active = document.activeElement;
    const live = isTextField(active) && !active.disabled && active.closest('.admin-content') ? active : null;
    const target = live
      ? { el: live, start: live.selectionStart ?? live.value.length, end: live.selectionEnd ?? live.value.length }
      : lastField.current;
    if (!target || !target.el.isConnected || target.el.disabled) {
      setError('Click inside a text field first, then press an insert button.');
      setNotice('');
      return;
    }
    const { el, start, end } = target;
    const next = el.value.slice(0, start) + text + el.value.slice(end);
    // Use the native setter + input event so React's controlled onChange runs.
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(el, next);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.focus();
    const pos = start + text.length;
    el.setSelectionRange(pos, pos);
    lastField.current = { el, start: pos, end: pos };
    setError('');
  };

  // Returns true when experience data is valid; otherwise shows the problem and jumps to the tab.
  const experienceOk = () => {
    const problem = validateExperience(data.experience);
    if (problem) { setError(problem); setNotice(''); setActive('experience'); return false; }
    return true;
  };

  const setRoleType = (index: number, value: string) => {
    if (value === CURRENT_ROLE && data.experience.some((j, k) => k !== index && j.roleType === CURRENT_ROLE)) {
      setError(`Only one role can be "${CURRENT_ROLE}". Change the other one to Previous role first.`);
      setNotice('');
      return;
    }
    setError('');
    setData(prev => ({
      ...prev,
      experience: prev.experience.map((job, i) => i === index ? { ...job, roleType: value, end: value === CURRENT_ROLE ? null : job.end } : job),
    }) as Portfolio);
  };
  const setPath = (section: keyof Portfolio, key: string, value: string) =>
    setData(prev => ({ ...prev, [section]: { ...(prev[section] as object), [key]: value } }) as Portfolio);

  const persistDraft = () => {
    if (!experienceOk()) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data, null, 2));
    setNotice('Draft saved in this browser.');
    setError('');
  };

  const downloadJson = () => {
    if (!experienceOk()) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'portfolio.json'; a.click();
    URL.revokeObjectURL(url);
    setNotice('Updated portfolio.json downloaded.');
    setError('');
  };

  const importJson = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (!parsed.profile || !parsed.experience || !parsed.projects) throw new Error('Missing required sections');
        const next = normalize(parsed);
        const problem = validateExperience(next.experience);
        if (problem) throw new Error(problem);
        setData(next);
        setNotice('JSON imported successfully.');
        setRawError(''); setError('');
      } catch (e) { setRawError(e instanceof Error ? e.message : 'Invalid JSON'); }
    };
    reader.readAsText(file);
  };

  const updateItem = (section: 'experience' | 'projects' | 'achievements' | 'skills', index: number, key: string, value: string) =>
    setData(prev => {
      const list = [...(prev[section] as any[])];
      list[index] = { ...list[index], [key]: section === 'experience' && key === 'end' && value.trim() === '' ? null : value };
      return { ...prev, [section]: list };
    });

  const addItem = (section: 'experience' | 'projects' | 'achievements') => {
    const templates: Record<string, object> = {
      experience: { id: newId('exp'), role: '', company: '', roleType: 'Previous role', start: '', end: null, location: '', description: '' },
      projects: { name: '', category: '', description: '', technologies: [], status: 'In development', url: '', experienceId: null, skills: [] },
      achievements: { title: '', detail: '', organization: '', date: '', metric: '' },
    };
    setData(prev => ({ ...prev, [section]: [...(prev[section] as any[]), templates[section]] }));
  };

  const removeItem = (section: 'experience' | 'projects' | 'achievements' | 'skills', index: number) =>
    setData(prev => {
      const next = { ...prev, [section]: (prev[section] as any[]).filter((_, i) => i !== index) } as Portfolio;
      if (section === 'experience') {
        // Disconnect any project that pointed at the deleted experience card.
        const goneId = (prev.experience[index] as { id?: string }).id;
        next.projects = prev.projects.map(p => (p.experienceId && p.experienceId === goneId ? { ...p, experienceId: null } : p));
      }
      return next;
    });

  // ---- Skill edits: renaming a skill keeps its project links ----
  const pendingSkill = useRef<PendingRename>(null);

  const editSkillItems = (groupIndex: number, text: string) => {
    const nextItems = toList(text);
    const oldItems = data.skills[groupIndex]?.items ?? [];
    const { renames, pending } = diffSkillEdit(groupIndex, oldItems, nextItems, pendingSkill.current);
    pendingSkill.current = pending;
    setData(prev => {
      const skills = prev.skills.map((g, j) => (j === groupIndex ? { ...g, items: nextItems } : g));
      // Only follow a rename when the old name no longer exists anywhere in Skills.
      const remaining = new Set(allSkillNames(skills));
      const effective = Object.fromEntries(Object.entries(renames).filter(([from]) => !remaining.has(from)));
      return { ...prev, skills, projects: applySkillRenames(prev.projects, effective) };
    });
  };

  // ---- Optional project connections ----
  const setProjectExperience = (index: number, experienceId: string | null) =>
    setData(prev => ({ ...prev, projects: prev.projects.map((p, i) => (i === index ? { ...p, experienceId } : p)) }));

  const toggleProjectSkill = (index: number, skill: string) =>
    setData(prev => ({
      ...prev,
      projects: prev.projects.map((p, i) => {
        if (i !== index) return p;
        const current = p.skills ?? [];
        return { ...p, skills: current.includes(skill) ? current.filter(s => s !== skill) : [...current, skill] };
      }),
    }));

  const saveGhSettings = (next: GhSettings) => {
    setGh(next);
    localStorage.setItem(GH_SETTINGS_KEY, JSON.stringify(next));
  };

  const publishToGitHub = async () => {
    setError(''); setNotice('');
    if (!experienceOk()) return;

    // Proxy mode: the GitHub PAT lives in the Worker as a secret, not in this browser.
    if (gh.proxyUrl.trim()) {
      if (!gh.publishKey.trim()) {
        setError('PUBLISH KEY is required. Enter it in GitHub credentials (same value as the Worker secret PUBLISH_KEY).');
        setShowGhSettings(true); return;
      }
      setPublishing(true);
      try {
        const res = await fetch(gh.proxyUrl.trim(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Publish-Key': gh.publishKey.trim() },
          body: JSON.stringify({ portfolio: data }),
        });
        const j = await res.json().catch(() => ({} as { error?: string; detail?: string }));
        if (res.ok) {
          setNotice('Publish request sent. The GitHub Action will back up the old portfolio.json, write the new one, commit and redeploy.');
          localStorage.setItem(STORAGE_KEY, JSON.stringify(data, null, 2));
        } else {
          setError(`Publish failed (${res.status}): ${j.error || 'unknown error'}${j.detail ? ` — ${j.detail}` : ''}`);
        }
      } catch (e) {
        setError(e instanceof Error ? `${e.message} — check the proxy URL and ALLOWED_ORIGIN.` : 'Network error');
      } finally {
        setPublishing(false);
      }
      return;
    }

    if (!gh.owner.trim() || !gh.repo.trim()) {
      setError('Please set OWNER and REPO in GitHub credentials.');
      setShowGhSettings(true); return;
    }
    if (!gh.token.trim()) {
      setError('TOKEN is required. Paste a fine-grained PAT with Contents: Read and write.');
      setShowGhSettings(true); return;
    }
    setPublishing(true);
    try {
      const res = await fetch(`https://api.github.com/repos/${gh.owner.trim()}/${gh.repo.trim()}/dispatches`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${gh.token.trim()}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          event_type: 'update-portfolio',
          client_payload: { portfolio: JSON.stringify(data) },
        }),
      });
      if (res.status === 204) {
        setNotice('GitHub Action triggered. It will back up the old portfolio.json, write the new one, commit and push.');
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data, null, 2));
      } else {
        const body = await res.text();
        let msg = `GitHub API error ${res.status}`;
        try { const j = JSON.parse(body); if (j.message) msg += `: ${j.message}`; } catch { if (body) msg += `: ${body.slice(0, 200)}`; }
        if (res.status === 401 || res.status === 403) msg += ' — Check TOKEN permissions (Contents: Read and write).';
        if (res.status === 404) msg += ' — Repository not found. Check OWNER and REPO.';
        setError(msg);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error');
    } finally {
      setPublishing(false);
    }
  };

  const resetToBundled = () => {
    if (confirm('Discard current edits and reload the original portfolio.json?')) {
      setData(cloneInitial());
      localStorage.removeItem(STORAGE_KEY);
      setNotice('Reset to the original bundled portfolio.json.');
      setError('');
    }
  };

  const navItems = [
    { id: 'profile', label: 'Profile' }, { id: 'about', label: 'About' }, { id: 'experience', label: 'Experience' },
    { id: 'skills', label: 'Skills' }, { id: 'projects', label: 'Projects' }, { id: 'achievements', label: 'Achievements' },
    { id: 'contact', label: 'Contact' }, { id: 'raw', label: 'Advanced JSON' }, { id: 'publish', label: 'Publish' },
  ];

  if (!authChecked) {
    return (<main className="admin-page admin-login-page"><div className="admin-login-card"><p className="form-help">Checking authentication…</p></div></main>);
  }

  if (!authenticated) {
    return (
      <main className="admin-page admin-login-page">
        <div className="admin-login-card">
          <div className="admin-login-icon"><Lock size={28} /></div>
          <h1>Admin access</h1>
          <p className="form-help">Enter the admin password to edit portfolio content.</p>
          {!ADMIN_PASSWORD && (
            <div className="admin-notice error" style={{ marginBottom: 16 }}>
              <strong>Password not configured.</strong><br />
              Create <code>.env.local</code> with:<br />
              <code>NEXT_PUBLIC_ADMIN_PASSWORD=your-strong-password</code>
            </div>
          )}
          <form onSubmit={handleLogin} className="admin-login-form">
            <label className="admin-field wide">
              <span>Password</span>
              <div className="password-input-wrap">
                <input type={showPassword ? 'text' : 'password'} value={loginPassword} onChange={e => setLoginPassword(e.target.value)} placeholder="Admin password" autoFocus autoComplete="current-password" />
                <button type="button" className="password-toggle" onClick={() => setShowPassword(v => !v)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </label>
            <label className="remember-me">
              <input type="checkbox" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)} />
              <span>Remember me on this device</span>
            </label>
            {loginError && <p className="form-error">{loginError}</p>}
            <button type="submit" className="admin-button primary" style={{ width: '100%', justifyContent: 'center' }} disabled={!ADMIN_PASSWORD}>
              <Lock size={16} /> Unlock admin
            </button>
          </form>
          <a href="/" className="admin-back" style={{ marginTop: 20 }}><ArrowLeft size={16} /> Back to portfolio</a>
        </div>
      </main>
    );
  }

  return (
    <main className="admin-page">
      <header className="admin-header">
        <a href="/" className="admin-back"><ArrowLeft size={18} /> Back to portfolio</a>
        <div className="admin-header-actions">
          <button className="admin-button secondary" onClick={() => setShowGhSettings(v => !v)} title="GitHub credentials"><Settings size={16} /> GitHub credentials</button>
          <button className="admin-button secondary" onClick={resetToBundled}><RotateCcw size={16} /> Reset</button>
          <button className="admin-button secondary" onClick={handleLogout} title="Log out"><LogOut size={16} /> Log out</button>
        </div>
      </header>

      {showGhSettings && (
        <div className="admin-gh-panel">
          <h3>GitHub credentials</h3>
          <p className="form-help">
            <strong>OWNER</strong> and <strong>REPO</strong> identify the repository.
            <strong> TOKEN</strong> is a fine-grained PAT (Contents: Read and write).
            If PROXY URL is set, publishing goes through the Worker and OWNER / REPO / TOKEN are ignored.
            Values are stored only in this browser — never commit them or use NEXT_PUBLIC_ for secrets.
          </p>
          <div className="form-grid">
            <Field label="PROXY URL (optional)" value={gh.proxyUrl} onChange={v => saveGhSettings({ ...gh, proxyUrl: v })} placeholder="https://your-worker.workers.dev" />
            <Field label="PUBLISH KEY" value={gh.publishKey} onChange={v => saveGhSettings({ ...gh, publishKey: v })} placeholder="Same as Worker secret PUBLISH_KEY" type="password" />
            <Field label="OWNER" value={gh.owner} onChange={v => saveGhSettings({ ...gh, owner: v })} placeholder="username or org" />
            <Field label="REPO" value={gh.repo} onChange={v => saveGhSettings({ ...gh, repo: v })} placeholder="repo-name" />
            <Field label="TOKEN" value={gh.token} onChange={v => saveGhSettings({ ...gh, token: v })} placeholder="github_pat_…" type="password" />
          </div>
        </div>
      )}

      {notice && <div className="admin-notice success">{notice}</div>}
      {error && <div className="admin-notice error">{error}</div>}

      <div className="admin-layout">
        <nav className="admin-nav">
          {navItems.map(item => (
            <button key={item.id} className={active === item.id ? 'active' : ''} onClick={() => setActive(item.id)}>{item.label}</button>
          ))}
        </nav>

        <div className="admin-content" onFocus={rememberField} onClick={rememberField}>
          {active === 'profile' && (
            <section className="admin-section">
              <h2>Profile</h2>
              <div className="form-grid">
                <Field label="Name" value={data.profile.name} onChange={v => setPath('profile', 'name', v)} />
                <Field label="Title" value={data.profile.title} onChange={v => setPath('profile', 'title', v)} />
                <Field label="Location" value={data.profile.location} onChange={v => setPath('profile', 'location', v)} />
                <Field label="Email" value={data.profile.email} onChange={v => setPath('profile', 'email', v)} />
                <Field label="Phone" value={data.profile.phone || ''} onChange={v => setPath('profile', 'phone', v)} />
                <Field label="Website" value={data.profile.website || ''} onChange={v => setPath('profile', 'website', v)} />
                <Field label="GitHub" value={data.profile.github || ''} onChange={v => setPath('profile', 'github', v)} />
                <Field label="LinkedIn" value={data.profile.linkedin || ''} onChange={v => setPath('profile', 'linkedin', v)} />
                <Field label="Tagline" value={data.profile.tagline || ''} onChange={v => setPath('profile', 'tagline', v)} wide />
              </div>
            </section>
          )}

          {active === 'about' && (
            <section className="admin-section">
              <h2>About</h2>
              <Field label="Summary" value={data.about.summary} onChange={v => setPath('about', 'summary', v)} multiline />
              <Field label="Highlights (one per line)" value={(data.about.highlights || []).join('\n')} onChange={v => setData(prev => ({ ...prev, about: { ...prev.about, highlights: v.split('\n').map(s => s.trim()).filter(Boolean) } }))} multiline />
            </section>
          )}

          {active === 'experience' && (
            <section className="admin-section">
              <div className="section-header">
                <h2>Experience</h2>
                <button className="admin-button secondary" onClick={() => addItem('experience')}><Plus size={16} /> Add role</button>
              </div>
              <p className="form-help">Total experience: {formatExperienceLabel(months)}. Use insert tokens in description fields.</p>
              <div className="token-bar">
                {INSERT_TOKENS.map(t => (
                  <button key={t.token} type="button" className="token-btn" onClick={() => insertAtCursor(t.token)} title={t.hint}>{t.label}</button>
                ))}
              </div>
              {data.experience.map((job, i) => (
                <div key={job.id || i} className="admin-card">
                  <div className="card-header">
                    <strong>{job.role || 'Untitled role'}</strong>
                    <button className="icon-btn danger" onClick={() => removeItem('experience', i)} title="Remove"><Trash2 size={16} /></button>
                  </div>
                  <div className="form-grid">
                    <Field label="Role" value={job.role} onChange={v => updateItem('experience', i, 'role', v)} />
                    <Field label="Company" value={job.company} onChange={v => updateItem('experience', i, 'company', v)} />
                    <label className="admin-field">
                      <span>Role type</span>
                      <select value={job.roleType || 'Previous role'} onChange={e => setRoleType(i, e.target.value)}>
                        {ROLE_TYPES.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </label>
                    <Field label="Start (YYYY-MM)" value={job.start || ''} onChange={v => updateItem('experience', i, 'start', v)} />
                    <Field label="End (YYYY-MM or empty if current)" value={job.end || ''} onChange={v => updateItem('experience', i, 'end', v)} />
                    <Field label="Location" value={job.location || ''} onChange={v => updateItem('experience', i, 'location', v)} />
                    <Field label="Description" value={job.description || ''} onChange={v => updateItem('experience', i, 'description', v)} multiline wide />
                  </div>
                </div>
              ))}
            </section>
          )}

          {active === 'skills' && (
            <section className="admin-section">
              <div className="section-header">
                <h2>Skills</h2>
                <button className="admin-button secondary" onClick={() => setData(prev => ({ ...prev, skills: [...prev.skills, { group: '', items: [] }] }))}><Plus size={16} /> Add group</button>
              </div>
              {data.skills.map((g, i) => (
                <div key={i} className="admin-card">
                  <div className="card-header">
                    <Field label="Group name" value={g.group} onChange={v => setData(prev => { const skills = [...prev.skills]; skills[i] = { ...skills[i], group: v }; return { ...prev, skills }; })} />
                    <button className="icon-btn danger" onClick={() => removeItem('skills', i)} title="Remove group"><Trash2 size={16} /></button>
                  </div>
                  <Field label="Skills (comma or newline separated)" value={(g.items || []).join(', ')} onChange={v => editSkillItems(i, v)} multiline />
                </div>
              ))}
            </section>
          )}

          {active === 'projects' && (
            <section className="admin-section">
              <div className="section-header">
                <h2>Projects</h2>
                <button className="admin-button secondary" onClick={() => addItem('projects')}><Plus size={16} /> Add project</button>
              </div>
              {data.projects.map((p, i) => (
                <div key={i} className="admin-card">
                  <div className="card-header">
                    <strong>{p.name || 'Untitled project'}</strong>
                    <button className="icon-btn danger" onClick={() => removeItem('projects', i)} title="Remove"><Trash2 size={16} /></button>
                  </div>
                  <div className="form-grid">
                    <Field label="Name" value={p.name} onChange={v => updateItem('projects', i, 'name', v)} />
                    <Field label="Category" value={p.category || ''} onChange={v => updateItem('projects', i, 'category', v)} />
                    <Field label="Status" value={p.status || ''} onChange={v => updateItem('projects', i, 'status', v)} />
                    <Field label="URL" value={p.url || ''} onChange={v => updateItem('projects', i, 'url', v)} />
                    <Field label="Technologies (comma-separated)" value={(p.technologies || []).join(', ')} onChange={v => setData(prev => { const projects = [...prev.projects]; projects[i] = { ...projects[i], technologies: toList(v) }; return { ...prev, projects }; })} wide />
                    <Field label="Description" value={p.description || ''} onChange={v => updateItem('projects', i, 'description', v)} multiline wide />
                    <label className="admin-field wide">
                      <span>Linked experience</span>
                      <select value={p.experienceId || ''} onChange={e => setProjectExperience(i, e.target.value || null)}>
                        <option value="">— None —</option>
                        {data.experience.map(job => (
                          <option key={job.id} value={job.id}>{experienceLabel(job)}</option>
                        ))}
                      </select>
                    </label>
                    <div className="admin-field wide">
                      <span>Skills used</span>
                      <div className="chip-row">
                        {allSkillNames(data.skills).map(skill => (
                          <button key={skill} type="button" className={(p.skills || []).includes(skill) ? 'chip active' : 'chip'} onClick={() => toggleProjectSkill(i, skill)}>{skill}</button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </section>
          )}

          {active === 'achievements' && (
            <section className="admin-section">
              <div className="section-header">
                <h2>Achievements</h2>
                <button className="admin-button secondary" onClick={() => addItem('achievements')}><Plus size={16} /> Add</button>
              </div>
              {data.achievements.map((a, i) => (
                <div key={i} className="admin-card">
                  <div className="card-header">
                    <strong>{a.title || 'Untitled'}</strong>
                    <button className="icon-btn danger" onClick={() => removeItem('achievements', i)} title="Remove"><Trash2 size={16} /></button>
                  </div>
                  <div className="form-grid">
                    <Field label="Title" value={a.title} onChange={v => updateItem('achievements', i, 'title', v)} />
                    <Field label="Organization" value={a.organization || ''} onChange={v => updateItem('achievements', i, 'organization', v)} />
                    <Field label="Date" value={a.date || ''} onChange={v => updateItem('achievements', i, 'date', v)} />
                    <Field label="Metric" value={a.metric || ''} onChange={v => updateItem('achievements', i, 'metric', v)} />
                    <Field label="Detail" value={a.detail || ''} onChange={v => updateItem('achievements', i, 'detail', v)} multiline wide />
                  </div>
                </div>
              ))}
            </section>
          )}

          {active === 'contact' && (
            <section className="admin-section">
              <h2>Contact</h2>
              <div className="form-grid">
                <Field label="Email" value={data.contact?.email || data.profile.email || ''} onChange={v => setData(prev => ({ ...prev, contact: { ...(prev.contact || {}), email: v } }))} />
                <Field label="Message" value={data.contact?.message || ''} onChange={v => setData(prev => ({ ...prev, contact: { ...(prev.contact || {}), message: v } }))} multiline wide />
              </div>
            </section>
          )}

          {active === 'raw' && (
            <section className="admin-section">
              <h2>Advanced JSON</h2>
              <p className="form-help">Edit the full portfolio JSON. Invalid JSON will be rejected.</p>
              <textarea className="raw-json" value={raw || JSON.stringify(data, null, 2)} onChange={e => setRaw(e.target.value)} rows={24} />
              {rawError && <p className="form-error">{rawError}</p>}
              <div className="admin-actions">
                <button className="admin-button primary" onClick={() => {
                  try {
                    const parsed = JSON.parse(raw || JSON.stringify(data));
                    const next = normalize(parsed);
                    const problem = validateExperience(next.experience);
                    if (problem) throw new Error(problem);
                    setData(next); setRaw(''); setRawError(''); setNotice('JSON applied.'); setError('');
                  } catch (e) { setRawError(e instanceof Error ? e.message : 'Invalid JSON'); }
                }}><Save size={16} /> Apply JSON</button>
                <label className="admin-button secondary">
                  <Upload size={16} /> Import file
                  <input type="file" accept="application/json,.json" hidden onChange={e => importJson(e.target.files?.[0])} />
                </label>
                <button className="admin-button secondary" onClick={downloadJson}><Download size={16} /> Download JSON</button>
              </div>
            </section>
          )}

          {active === 'publish' && (
            <section className="admin-section">
              <h2>Publish</h2>
              <p className="form-help">Saves a draft in this browser, then triggers the GitHub Action (via proxy or direct token) to write portfolio.json and redeploy Pages.</p>
              <div className="admin-actions">
                <button className="admin-button secondary" onClick={persistDraft}><Save size={16} /> Save draft</button>
                <button className="admin-button primary" onClick={publishToGitHub} disabled={publishing}>
                  {publishing ? <Loader2 size={16} className="spin" /> : <Github size={16} />}
                  {publishing ? 'Publishing…' : 'Publish to GitHub'}
                </button>
              </div>
            </section>
          )}
        </div>
      </div>
    </main>
  );
}

function Field({ label, value, onChange, placeholder, type = 'text', multiline, wide }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; multiline?: boolean; wide?: boolean;
}) {
  const [text, setText] = useState(value);
  useEffect(() => { setText(value); }, [value]);
  return (
    <label className={wide ? 'admin-field wide' : 'admin-field'}>
      <span>{label}</span>
      {multiline ? (
        <textarea value={text} placeholder={placeholder} onChange={e => { setText(e.target.value); onChange(e.target.value); }} rows={4} />
      ) : (
        <input type={type} value={text} placeholder={placeholder} onChange={e => { setText(e.target.value); onChange(e.target.value); }} />
      )}
    </label>
  );
}
