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

interface GhSettings { owner: string; repo: string; token: string; }
const DEFAULT_GH: GhSettings = {
  owner: process.env.NEXT_PUBLIC_GITHUB_OWNER || 'allanvarghese567-lab',
  repo: process.env.NEXT_PUBLIC_GITHUB_REPO || 'allan-varghese-portfolio',
  token: '',
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
            Token is stored only in this browser — never commit it or use NEXT_PUBLIC_ for it.
          </p>
          <div className="form-grid">
            <Field label="OWNER (username or org)" value={gh.owner} onChange={v => saveGhSettings({ ...gh, owner: v })} />
            <Field label="REPO (repository name)" value={gh.repo} onChange={v => saveGhSettings({ ...gh, repo: v })} />
            <label className="admin-field wide">
              <span>TOKEN (fine-grained PAT)</span>
              <input type="password" value={gh.token} onChange={e => saveGhSettings({ ...gh, token: e.target.value })} placeholder="github_pat_... or ghp_..." autoComplete="off" />
            </label>
          </div>
          <p className="form-help">
            Create TOKEN → Account Settings → Developer settings → Personal access tokens → Fine-grained tokens.
            Repo: allan-varghese-portfolio only. Permission: Contents → Read and write.
          </p>
        </div>
      )}

      {(notice || error) && <div className={`admin-notice ${error ? 'error' : ''}`}>{error || notice}</div>}

      <div className="admin-layout">
        <nav className="admin-nav">
          {navItems.map(item => (
            <button key={item.id} className={active === item.id ? 'active' : ''} onClick={() => setActive(item.id)}>{item.label}</button>
          ))}
        </nav>

        <section className="admin-content" onSelect={rememberField} onBlurCapture={rememberField} onKeyUp={rememberField} onClick={rememberField}>
          {active !== 'raw' && active !== 'publish' && (
            <div className="insert-bar">
              <span className="insert-bar-label">Insert at cursor</span>
              {INSERT_TOKENS.map(t => (
                <button
                  key={t.token}
                  type="button"
                  className="insert-chip"
                  title={`Inserts ${t.token}`}
                  onPointerDown={e => e.preventDefault()}
                  onClick={() => insertAtCursor(t.token)}
                >
                  <Plus size={12} /> {t.label} <small>{resolveTokens(t.token, tokenCtx) || '—'}</small>
                </button>
              ))}
              <p className="insert-bar-help">Click inside any text field, then press a button. The placeholder (e.g. {'{{years}}'}) is replaced with the live value on the site.</p>
            </div>
          )}
          {active === 'profile' && (
            <>
              <SectionTitle title="Profile & hero" sub="Name, headline, location and hero text." />
              <div className="form-grid">
                {([['name','Full name'],['headline','Headline'],['heroTitle','Hero title'],['heroSummary','Hero summary'],['location','Location'],['email','Email'],['linkedin','LinkedIn URL'],['github','GitHub URL'],['experienceStart','Experience start (YYYY-MM)']] as const).map(([k,l]) => (
                  <Field key={k} label={l} value={(data.profile as any)[k] ?? ''} onChange={v => setPath('profile', k, v)} wide={k==='headline'||k==='heroTitle'||k==='heroSummary'} multiline={k==='heroSummary'} />
                ))}
              </div>
            </>
          )}

          {active === 'about' && (
            <>
              <SectionTitle title="About section" sub="Biography and focus areas." />
              <Field label="Section heading" value={data.about.heading} onChange={v => setPath('about','heading',v)} wide />
              <Field label="Summary" value={data.about.summary} onChange={v => setPath('about','summary',v)} multiline wide />
              <p className="form-help">Years of experience is added automatically (earliest start date → present). Preview: <em>{resolveTokens(withExperience(data.about.summary, months), tokenCtx)}</em></p>
              <ArrayField label="Focus areas (one per line)" value={data.about.focus} onChange={v => setData(p => ({ ...p, about: { ...p.about, focus: v.split('\n').map(x => x.trim()).filter(Boolean) } }))} />
            </>
          )}

          {active === 'experience' && (
            <>
              <SectionTitle title="Experience timeline" sub="Dates use YYYY-MM. Pick a role type — only one role can be the Current role (no end date)." />
              <div className="admin-records">
                {data.experience.map((job, i) => (
                  <div className="admin-record" key={i}>
                    <div className="record-head"><strong>Role {String(i+1).padStart(2,'0')}</strong>
                      <button className="icon-button" onClick={() => removeItem('experience', i)} aria-label="Delete role"><Trash2 size={16} /></button>
                    </div>
                    <div className="form-grid">
                      <label className="admin-field">
                        <span>Role type</span>
                        <select value={job.roleType} onChange={e => setRoleType(i, e.target.value)}>
                          {ROLE_TYPES.map(t => (
                            <option key={t} value={t} disabled={t === CURRENT_ROLE && data.experience.some((j, k) => k !== i && j.roleType === CURRENT_ROLE)}>
                              {t}{t === CURRENT_ROLE && data.experience.some((j, k) => k !== i && j.roleType === CURRENT_ROLE) ? ' (already used)' : ''}
                            </option>
                          ))}
                        </select>
                      </label>
                      {([['role','Role'],['company','Company'],['start','Start month'],['end','End month'],['location','Location'],['description','Description']] as const).map(([k,l]) => (
                        <Field
                          key={k}
                          label={k==='end' && job.roleType===CURRENT_ROLE ? 'End month (Present)' : l}
                          value={k==='end' && job.roleType===CURRENT_ROLE ? '' : (job as any)[k] ?? ''}
                          onChange={v => updateItem('experience', i, k, v)}
                          disabled={k==='end' && job.roleType===CURRENT_ROLE}
                          wide={k==='description'}
                          multiline={k==='description'}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <button className="admin-button secondary" onClick={() => addItem('experience')}><Plus size={16} /> Add experience</button>
              <p className="form-help">Total: <strong>{formatExperienceLabel(months)}</strong></p>
            </>
          )}

          {active === 'skills' && (
            <>
              <SectionTitle title="Skills" sub="Skill groups. Renaming a skill keeps its project links." />
              {data.skills.map((group, i) => (
                <div className="admin-record" key={i}>
                  <div className="record-head"><strong>Group {i+1}</strong>
                    <button className="icon-button" onClick={() => removeItem('skills', i)} aria-label="Delete"><Trash2 size={16} /></button>
                  </div>
                  <Field label="Group name" value={group.group} onChange={v => setData(p => ({ ...p, skills: p.skills.map((g,j) => i===j ? { ...g, group: v } : g) }))} />
                  <ArrayField label="Skills (one per line)" value={group.items} onChange={v => editSkillItems(i, v)} />
                </div>
              ))}
              <button className="admin-button secondary" onClick={() => setData(p => ({ ...p, skills: [...p.skills, { group: '', items: [] }] }))}><Plus size={16} /> Add skill group</button>
            </>
          )}

          {active === 'projects' && (
            <>
              <SectionTitle title="Projects" sub="Project details and status." />
              <div className="admin-records">
                {data.projects.map((p, i) => (
                  <div className="admin-record" key={i}>
                    <div className="record-head"><strong>Project {String(i+1).padStart(2,'0')}</strong>
                      <button className="icon-button" onClick={() => removeItem('projects', i)} aria-label="Delete"><Trash2 size={16} /></button>
                    </div>
                    <div className="form-grid">
                      {([['name','Name'],['category','Category'],['status','Status'],['url','URL'],['description','Description']] as const).map(([k,l]) => (
                        <Field key={k} label={l} value={(p as any)[k] ?? ''} onChange={v => updateItem('projects', i, k, v)} wide={k==='description'} multiline={k==='description'} />
                      ))}
                      <ArrayField label="Technologies (one per line)" value={p.technologies || []} onChange={v => setData(prev => { const list = [...prev.projects]; list[i] = { ...list[i], technologies: v.split('\n').map(s => s.trim()).filter(Boolean) }; return { ...prev, projects: list }; })} />

                      <label className="admin-field wide">
                        <span>Linked experience (optional)</span>
                        <select value={p.experienceId ?? ''} onChange={e => setProjectExperience(i, e.target.value || null)}>
                          <option value="">Not connected</option>
                          {data.experience.map((job, k) => (
                            <option key={job.id ?? k} value={job.id}>{experienceLabel(job)}</option>
                          ))}
                          {p.experienceId && !data.experience.some(j => j.id === p.experienceId) && (
                            <option value={p.experienceId}>⚠ Missing experience (removed)</option>
                          )}
                        </select>
                      </label>

                      {(() => {
                        const selected = p.skills ?? [];
                        const known = allSkillNames(data.skills);
                        const missing = selected.filter(s => !known.includes(s));
                        return (
                          <div className="admin-field wide">
                            <span>Linked skills (optional) — tap to connect{selected.length ? ` · ${selected.length} selected` : ''}</span>
                            <div className="skill-picker">
                              {known.length === 0 && <p className="form-help">Add skills in the Skills tab first.</p>}
                              {data.skills.map(g => g.items.length > 0 ? (
                                <div key={g.group} className="pick-group">
                                  <small>{g.group || 'Ungrouped'}</small>
                                  <div className="pick-chips">
                                    {g.items.map(name => (
                                      <button key={name} type="button" className={`pick-chip${selected.includes(name) ? ' on' : ''}`} aria-pressed={selected.includes(name)} onClick={() => toggleProjectSkill(i, name)}>{name}</button>
                                    ))}
                                  </div>
                                </div>
                              ) : null)}
                              {missing.length > 0 && (
                                <div className="pick-group">
                                  <small>No longer in Skills — tap to remove</small>
                                  <div className="pick-chips">
                                    {missing.map(name => (
                                      <button key={name} type="button" className="pick-chip missing" onClick={() => toggleProjectSkill(i, name)}>⚠ {name}</button>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                ))}
              </div>
              <button className="admin-button secondary" onClick={() => addItem('projects')}><Plus size={16} /> Add project</button>
            </>
          )}

          {active === 'achievements' && (
            <>
              <SectionTitle title="Achievements & education" sub="Degrees and milestones." />
              <div className="admin-records">
                {data.achievements.map((a, i) => (
                  <div className="admin-record" key={i}>
                    <div className="record-head"><strong>Achievement {String(i+1).padStart(2,'0')}</strong>
                      <button className="icon-button" onClick={() => removeItem('achievements', i)} aria-label="Delete"><Trash2 size={16} /></button>
                    </div>
                    <div className="form-grid">
                      {([['title','Title'],['detail','Detail'],['organization','Organization'],['date','Date'],['metric','Metric']] as const).map(([k,l]) => (
                        <Field key={k} label={l} value={(a as any)[k] ?? ''} onChange={v => updateItem('achievements', i, k, v)} wide={k==='detail'} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <button className="admin-button secondary" onClick={() => addItem('achievements')}><Plus size={16} /> Add achievement</button>
            </>
          )}

          {active === 'contact' && (
            <>
              <SectionTitle title="Contact" sub="Contact message and links." />
              <div className="form-grid">
                {([['intro','Contact message'],['email','Email'],['linkedin','LinkedIn URL'],['github','GitHub URL']] as const).map(([k,l]) => (
                  <Field key={k} label={l} value={(data.contact as any)[k] ?? ''} onChange={v => setPath('contact', k, v)} wide={k==='intro'} multiline={k==='intro'} />
                ))}
              </div>
            </>
          )}

          {active === 'raw' && (
            <>
              <SectionTitle title="Advanced JSON" sub="Paste or import full portfolio JSON." />
              <textarea className="json-editor" value={raw || JSON.stringify(data, null, 2)} onChange={e => setRaw(e.target.value)} spellCheck={false} />
              {rawError && <p className="form-error">{rawError}</p>}
              <div className="admin-bottom-actions" style={{ marginTop: 12 }}>
                <button className="admin-button primary" onClick={() => {
                  try {
                    const parsed = JSON.parse(raw || JSON.stringify(data));
                    if (!parsed.profile || !parsed.experience || !parsed.projects) throw new Error('Required sections missing');
                    const next = normalize(parsed);
                    const problem = validateExperience(next.experience);
                    if (problem) throw new Error(problem);
                    setData(next); setRaw(''); setRawError(''); setNotice('JSON applied to editor.');
                  } catch (e) { setRawError(e instanceof Error ? e.message : 'Invalid JSON'); }
                }}>Apply JSON</button>
                <label className="admin-button secondary upload-label"><Upload size={16} /> Import JSON file
                  <input type="file" accept="application/json,.json" onChange={e => importJson(e.target.files?.[0])} />
                </label>
              </div>
            </>
          )}

          {active === 'publish' && (
            <>
              <SectionTitle title="Publish to GitHub" sub="Uses OWNER, REPO, TOKEN credentials to trigger the Action." />
              <div className="admin-publish-card">
                <h3>Credentials required</h3>
                <ol>
                  <li><strong>OWNER</strong> — {gh.owner || '(not set)'}</li>
                  <li><strong>REPO</strong> — {gh.repo || '(not set)'}</li>
                  <li><strong>TOKEN</strong> — {gh.token ? 'set in this browser' : '(not set — open GitHub credentials)'}</li>
                </ol>
                <div className="admin-bottom-actions" style={{ marginTop: 20 }}>
                  <button className="admin-button primary" onClick={publishToGitHub} disabled={publishing}>
                    {publishing ? <><Loader2 size={16} className="spin" /> Publishing…</> : <><Github size={16} /> Publish to GitHub</>}
                  </button>
                  <button className="admin-button secondary" onClick={persistDraft}><Save size={16} /> Save draft</button>
                  <button className="admin-button secondary" onClick={downloadJson}><Download size={16} /> Download JSON</button>
                </div>
              </div>
            </>
          )}

          {active !== 'publish' && (
            <div className="admin-bottom-actions">
              <button className="admin-button secondary" onClick={persistDraft}><Save size={16} /> Save draft</button>
              <button className="admin-button primary" onClick={downloadJson}><Download size={16} /> Download JSON</button>
              <button className="admin-button secondary" onClick={publishToGitHub} disabled={publishing}>
                {publishing ? <><Loader2 size={16} className="spin" /> Publishing…</> : <><Github size={16} /> Publish to GitHub</>}
              </button>
            </div>
          )}
        </section>
      </div>

      <footer className="admin-footer">Credentials: OWNER + REPO + TOKEN · Admin password separate · Old JSON under src/data/old/</footer>
    </main>
  );
}

function SectionTitle({ title, sub }: { title: string; sub: string }) {
  return (<div className="admin-section-title"><span>CONTENT EDITOR</span><h2>{title}</h2><p>{sub}</p></div>);
}

function Field({ label, value, onChange, multiline = false, wide = false, disabled = false }: { label: string; value: string; onChange: (v: string) => void; multiline?: boolean; wide?: boolean; disabled?: boolean }) {
  return (
    <label className={`admin-field ${wide ? 'wide' : ''}`}>
      <span>{label}</span>
      {multiline ? <textarea value={value} onChange={e => onChange(e.target.value)} rows={4} disabled={disabled} /> : <input value={value} onChange={e => onChange(e.target.value)} disabled={disabled} placeholder={disabled ? 'Present' : undefined} />}
    </label>
  );
}

function ArrayField({ label, value, onChange }: { label: string; value: string[]; onChange: (v: string) => void }) {
  // Keep the raw text locally so trailing spaces and blank lines survive while typing;
  // the parent still receives every change and stores the cleaned list.
  const [text, setText] = useState(() => value.join('\n'));
  useEffect(() => {
    // Re-sync only when the list was changed from outside (e.g. a group was deleted).
    const local = toList(text);
    if (local.length !== value.length || local.some((s, k) => s !== value[k])) setText(value.join('\n'));
  }, [value]);
  return (
    <label className="admin-field wide">
      <span>{label}</span>
      <textarea
        rows={Math.max(3, text.split('\n').length)}
        value={text}
        onChange={e => { setText(e.target.value); onChange(e.target.value); }}
      />
    </label>
  );
}
