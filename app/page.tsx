import data from '../src/data/portfolio.json';
import { countUniqueExperienceMonths, formatExperienceLabel, formatPeriod } from '../src/lib/experience';
import { ArrowDownRight, ArrowUpRight, Braces, Code2, Database, Layers, Mail, MapPin, Sparkles } from 'lucide-react';

const months = countUniqueExperienceMonths(data.experience);
const experienceLabel = formatExperienceLabel(months);

export default function HomePage() {
  return (
    <main>
      <header className="nav-wrap">
        <div className="container nav">
          <a href="#" className="brand">
            <span className="brand-mark">AV</span>
            <span>ALLAN VARGHESE</span>
          </a>
          <nav className="nav-links">
            <a href="#about">About</a>
            <a href="#experience">Experience</a>
            <a href="#skills">Skills</a>
            <a href="#projects">Projects</a>
            <a href="#contact">Contact</a>
          </nav>
          <a href="#contact" className="nav-cta">
            Let's talk <ArrowUpRight size={14} />
          </a>
        </div>
      </header>

      <section className="container hero">
        <div className="hero-copy">
          <div className="eyebrow">
            <span className="status-dot" />
            <span>AVAILABLE FOR WORK</span>
            <span className="eyebrow-sep">/</span>
            <span>{experienceLabel.toUpperCase()}</span>
          </div>
          <h1>
            {data.profile.heroTitle.split(' ').slice(0, 3).join(' ')}
            <em> {data.profile.heroTitle.split(' ').slice(3).join(' ')}</em>
          </h1>
          <p className="hero-lead">{data.profile.heroSummary}</p>
          <div className="hero-actions">
            <a href="#projects" className="btn primary">
              View projects <ArrowDownRight size={16} />
            </a>
            <a href={data.profile.linkedin} className="btn ghost" target="_blank" rel="noreferrer">
              LinkedIn
            </a>
          </div>
          <div className="hero-meta">
            <span><MapPin size={14} /> {data.profile.location}</span>
            <span><Mail size={14} /> {data.profile.email}</span>
          </div>
        </div>
        <div className="hero-panel">
          <div className="panel-card">
            <span className="ui-label">FOCUS</span>
            <h3>Full-stack & AI systems</h3>
            <p>Building products that combine solid engineering with practical AI.</p>
            <div className="panel-tags">
              {['.NET', 'React', 'FastAPI', 'PostgreSQL'].map((t) => (
                <span key={t}>{t}</span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="about" className="section container">
        <div className="section-head">
          <span className="section-index">01</span>
          <h2>{data.about.heading}</h2>
        </div>
        <p className="about-summary">{data.about.summary}</p>
        <div className="focus-grid">
          {data.about.focus.map((item) => (
            <div key={item} className="focus-card">
              <Sparkles size={18} />
              <span>{item}</span>
            </div>
          ))}
        </div>
      </section>

      <section id="experience" className="section container">
        <div className="section-head">
          <span className="section-index">02</span>
          <h2>Experience</h2>
        </div>
        <div className="experience-list">
          {data.experience.map((job, i) => (
            <article key={i} className="experience-item">
              <div className="exp-meta">
                <span className="exp-period">{formatPeriod(job.start, job.end)}</span>
                <span className="exp-location">{job.location}</span>
              </div>
              <h3>{job.role}</h3>
              <p className="exp-company">{job.company}</p>
              <p>{job.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="skills" className="section container">
        <div className="section-head">
          <span className="section-index">03</span>
          <h2>Skills</h2>
        </div>
        <div className="skill-groups">
          {data.skills.map((group) => (
            <div key={group.group} className="skill-group">
              <h3>
                {group.group === 'Frontend' && <Code2 size={16} />}
                {group.group === 'Backend' && <Layers size={16} />}
                {group.group === 'Databases' && <Database size={16} />}
                {group.group === 'Platforms & Analytics' && <Braces size={16} />}
                {group.group}
              </h3>
              <ul>
                {group.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section id="projects" className="section container">
        <div className="section-head">
          <span className="section-index">04</span>
          <h2>Projects</h2>
        </div>
        <div className="project-grid">
          {data.projects.map((project) => (
            <article key={project.name} className="project-card">
              <span className="project-kicker">{project.category}</span>
              <h3>{project.name}</h3>
              <p>{project.description}</p>
              <div className="project-tech">
                {project.technologies.map((t) => (
                  <span key={t}>{t}</span>
                ))}
              </div>
              <div className="project-footer">
                <span className="project-status">
                  <i /> {project.status}
                </span>
                {project.url ? (
                  <a href={project.url} target="_blank" rel="noreferrer">
                    View <ArrowUpRight size={14} />
                  </a>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section id="achievements" className="section container">
        <div className="section-head">
          <span className="section-index">05</span>
          <h2>Achievements</h2>
        </div>
        <div className="achievement-list">
          {data.achievements.map((a, i) => (
            <article key={i} className="achievement-item">
              <h3>{a.title}</h3>
              <p>{a.detail}</p>
              <div className="achievement-meta">
                <span>{a.organization}</span>
                <span>{a.date}</span>
                {a.metric ? <strong>{a.metric}</strong> : null}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section id="contact" className="section container contact-section">
        <div className="contact-card">
          <span className="ui-label">CONTACT</span>
          <h2>Let's build something useful.</h2>
          <p>{data.contact.intro}</p>
          <div className="contact-links">
            <a href={`mailto:${data.contact.email}`}>{data.contact.email}</a>
            <a href={data.contact.linkedin} target="_blank" rel="noreferrer">LinkedIn</a>
            <a href={data.contact.github} target="_blank" rel="noreferrer">GitHub</a>
          </div>
        </div>
      </section>

      <footer className="footer container">
        <span>© {new Date().getFullYear()} Allan Varghese</span>
        <small>Content defined in local JSON.</small>
      </footer>
    </main>
  );
}
