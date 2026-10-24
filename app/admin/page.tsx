'use client';

import { useEffect, useMemo, useState } from 'react';
import initialData from '../../src/data/portfolio.json';
import { countUniqueExperienceMonths, formatExperienceLabel } from '../../src/lib/experience';
import {
  ArrowLeft, Download, RotateCcw, Save, Plus, Trash2, Upload, Github, Loader2, Settings, Lock, LogOut, Eye, EyeOff,
} from 'lucide-react';

type Portfolio = typeof initialData;
const STORAGE_KEY = 'allan-portfolio-admin-draft-v1';
const GH_SETTINGS_KEY = 'allan-portfolio-gh-settings-v1';
const AUTH_KEY = 'allan-portfolio-admin-auth-v1';
const ADMIN_PASSWORD = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || '';
const cloneInitial = () => JSON.parse(JSON.stringify(initialData)) as Portfolio;

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
    try { const s = localStorage.getItem(STORAGE_KEY); if (s) setData(JSON.parse(s)); } catch {}
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

  const months = useMemo(() => countUniqueExperienceMonths(data.experience), [data.experience]);
  const setPath = (section: keyof Portfolio, key: string, value: string) =>
    setData(prev => ({ ...prev, [section]: { ...(prev[section] as object), [key]: value } }) as Portfolio);

  const persistDraft = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data, null, 2));
    setNotice('Draft saved in this browser.');
    setError('');
  };

  const downloadJson = () => {
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
        setData(parsed);
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
      experience: { role: '', company: '', start: '', end: null, location: '', description: '' },
      projects: { name: '', category: '', description: '', technologies: [], status: 'In development', url: '' },
      achievements: { title: '', detail: '', organization: '', date: '', metric: '' },
    };
    setData(prev => ({ ...prev, [section]: [...(prev[section] as any[]), templates[section]] }));
  };

  const removeItem = (section: 'experience' | 'projects' | 'achievements' | 'skills', index: number) =>
    setData(prev => ({ ...prev, [section]: (prev[section] as any[]).filter((_, i) => i !== index) }));

  const saveGhSettings = (next: GhSettings) => {
    setGh(next);
    localStorage.setItem(GH_SETTINGS_KEY, JSON.stringify(next));
  };

  const publishToGitHub = async () => {
    setError(''); setNotice('');
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

        <section className="admin-content">
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
              <ArrayField label="Focus areas (one per line)" value={data.about.focus} onChange={v => setData(p => ({ ...p, about: { ...p.about, focus: v.split('\n').map(x => x.trim()).filter(Boolean) } }))} />
            </>
          )}

          {active === 'experience' && (
            <>
              <SectionTitle title="Experience timeline" sub="Dates use YYYY-MM. Leave end blank for current role." />
              <div className="admin-records">
                {data.experience.map((job, i) => (
                  <div className="admin-record" key={i}>
                    <div className="record-head"><strong>Role {String(i+1).padStart(2,'0')}</strong>
                      <button className="icon-button" onClick={() => removeItem('experience', i)} aria-label="Delete role"><Trash2 size={16} /></button>
                    </div>
                    <div className="form-grid">
                      {([['role','Role'],['company','Company'],['start','Start month'],['end','End month (blank = current)'],['location','Location'],['description','Description']] as const).map(([k,l]) => (
                        <Field key={k} label={l} value={(job as any)[k] ?? ''} onChange={v => updateItem('experience', i, k, k==='end' && v.trim()==='' ? '' : v)} wide={k==='description'} multiline={k==='description'} />
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
              <SectionTitle title="Skills" sub="Skill groups." />
              {data.skills.map((group, i) => (
                <div className="admin-record" key={i}>
                  <div className="record-head"><strong>Group {i+1}</strong>
                    <button className="icon-button" onClick={() => removeItem('skills', i)} aria-label="Delete"><Trash2 size={16} /></button>
                  </div>
                  <Field label="Group name" value={group.group} onChange={v => setData(p => ({ ...p, skills: p.skills.map((g,j) => i===j ? { ...g, group: v } : g) }))} />
                  <ArrayField label="Skills (one per line)" value={group.items} onChange={v => setData(p => ({ ...p, skills: p.skills.map((g,j) => i===j ? { ...g, items: v.split('\n').map(s => s.trim()).filter(Boolean) } : g) }))} />
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
                    setData(parsed); setRawError(''); setNotice('JSON applied to editor.');
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

function Field({ label, value, onChange, multiline = false, wide = false }: { label: string; value: string; onChange: (v: string) => void; multiline?: boolean; wide?: boolean }) {
  return (
    <label className={`admin-field ${wide ? 'wide' : ''}`}>
      <span>{label}</span>
      {multiline ? <textarea value={value} onChange={e => onChange(e.target.value)} rows={4} /> : <input value={value} onChange={e => onChange(e.target.value)} />}
    </label>
  );
}

function ArrayField({ label, value, onChange }: { label: string; value: string[]; onChange: (v: string) => void }) {
  return (
    <label className="admin-field wide">
      <span>{label}</span>
      <textarea rows={Math.max(3, value.length || 3)} value={value.join('\n')} onChange={e => onChange(e.target.value)} />
    </label>
  );
}
