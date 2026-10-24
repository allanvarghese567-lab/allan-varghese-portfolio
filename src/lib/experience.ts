export const ROLE_TYPES = ['Current role', 'Previous role', 'Internship', 'Freelance', 'Contract'] as const;
export type RoleType = (typeof ROLE_TYPES)[number];
export const CURRENT_ROLE: RoleType = 'Current role';

export type RolePeriod = { start: string; end: string | null };

const MONTH_RE = /^\d{4}-\d{2}$/;
const toIndex = (v: string) => {
  const [y, m] = v.split('-').map(Number);
  return y * 12 + (m - 1);
};

/** Earliest valid start month (YYYY-MM) across all roles, or null if none. */
export function earliestStart(periods: RolePeriod[]): string | null {
  const starts = periods.map(p => p.start).filter(s => MONTH_RE.test(s));
  if (!starts.length) return null;
  return starts.reduce((min, s) => (toIndex(s) < toIndex(min) ? s : min));
}

/** Months from the earliest start date up to the present month. */
export function monthsSinceEarliestStart(periods: RolePeriod[], now = new Date()): number {
  const first = earliestStart(periods);
  if (!first) return 0;
  return Math.max(0, now.getFullYear() * 12 + now.getMonth() - toIndex(first));
}

export function formatExperienceLabel(months: number): string {
  const years = Math.floor(months / 12);
  if (years < 1) return 'Less than 1 year of experience';
  return `${years}+ ${years === 1 ? 'year' : 'years'} of experience`;
}

/** Appends the calculated experience to the About summary (no-op if no valid start dates). */
export function withExperience(summary: string, months: number): string {
  const base = summary.trim();
  if (months <= 0) return base;
  // If the admin placed an experience token themselves, don't append a second sentence.
  if (/\{\{\s*(years|experience)\s*\}\}/.test(base)) return base;
  const label = formatExperienceLabel(months);
  const phrase = label.charAt(0).toLowerCase() + label.slice(1);
  if (base.toLowerCase().includes(phrase)) return base;
  const sentence = /[.!?]$/.test(base) ? base : `${base}.`;
  return `${sentence} I bring ${phrase}.`;
}

export function formatPeriod(start: string, end: string | null): string {
  const fmt = (v: string) => {
    const [y, m] = v.split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString('en', { month: 'short', year: 'numeric' });
  };
  return `${fmt(start)} – ${end ? fmt(end) : 'Present'}`;
}

/** e.g. "1 yr 4 mos" for a single role (end = null means present). */
export function formatDuration(start: string, end: string | null, now = new Date()): string {
  if (!MONTH_RE.test(start)) return '';
  const endIdx = end && MONTH_RE.test(end) ? toIndex(end) : now.getFullYear() * 12 + now.getMonth();
  const total = Math.max(1, endIdx - toIndex(start) + 1);
  const y = Math.floor(total / 12);
  const m = total % 12;
  const parts: string[] = [];
  if (y) parts.push(`${y} ${y === 1 ? 'yr' : 'yrs'}`);
  if (m) parts.push(`${m} ${m === 1 ? 'mo' : 'mos'}`);
  return parts.join(' ');
}

/**
 * Makes sure every role has a valid roleType (older JSON without one is inferred
 * from its end date) and that "Current role" never carries an end date.
 */
export function normalizeExperience<T extends { end: string | null; roleType?: string }>(list: T[]): T[] {
  return list.map(job => {
    const valid = job.roleType && (ROLE_TYPES as readonly string[]).includes(job.roleType);
    const roleType = valid ? job.roleType! : job.end ? 'Previous role' : CURRENT_ROLE;
    return { ...job, roleType, end: roleType === CURRENT_ROLE ? null : job.end } as T;
  });
}

/** Returns an error message, or null when the experience list is valid. */
export function validateExperience(list: { start: string; end: string | null; roleType?: string }[]): string | null {
  const currents = list.filter(j => j.roleType === CURRENT_ROLE).length;
  if (currents > 1) return `Only one role can be marked "${CURRENT_ROLE}" (found ${currents}). Change the others to Previous role.`;
  for (let i = 0; i < list.length; i++) {
    const j = list[i];
    const n = `Role ${String(i + 1).padStart(2, '0')}`;
    if (!MONTH_RE.test(j.start || '')) return `${n}: start month must be in YYYY-MM format.`;
    if (j.roleType !== CURRENT_ROLE) {
      if (!j.end) return `${n}: add an end month (only the "${CURRENT_ROLE}" can be open-ended).`;
      if (!MONTH_RE.test(j.end)) return `${n}: end month must be in YYYY-MM format.`;
    }
  }
  return null;
}

/* ---------- Insert-at-cursor tokens ---------- */

export type TokenContext = { months: number; currentRole: string; projectCount?: number; sinceYear?: string; now?: Date };

const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/** Buttons shown in the admin "Insert at cursor" bar. */
export const INSERT_TOKENS = [
  { token: '{{years}}', label: 'Years' },
  { token: '{{experience}}', label: 'Experience' },
  { token: '{{currentRole}}', label: 'Current role' },
  { token: '{{year}}', label: 'This year' },
  { token: '{{since}}', label: 'Since' },
  { token: '{{projects}}', label: 'Projects' },
  { token: '{{updated}}', label: 'Last updated' },
] as const;

/** Each token maps to a function that returns the string to display. */
const TOKEN_FNS: Record<string, (c: TokenContext) => string> = {
  years: c => {
    const y = Math.floor(c.months / 12);
    return y < 1 ? 'less than 1 year' : `${y}+ ${y === 1 ? 'year' : 'years'}`;
  },
  experience: c => lowerFirst(formatExperienceLabel(c.months)),
  currentRole: c => c.currentRole,
  year: c => String((c.now ?? new Date()).getFullYear()),
  since: c => c.sinceYear ?? '',
  projects: c => String(c.projectCount ?? 0),
  // On a static site this is the date of the latest build/deploy, not the visitor's date.
  updated: c => (c.now ?? new Date()).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
};

/** Replaces {{token}} placeholders with their computed strings; unknown tokens are left as-is. */
export function resolveTokens(text: string, ctx: TokenContext): string {
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, name: string) =>
    Object.prototype.hasOwnProperty.call(TOKEN_FNS, name) ? TOKEN_FNS[name](ctx) : match,
  );
}

export function currentRoleTitle(list: { role: string; roleType?: string }[]): string {
  return list.find(j => j.roleType === CURRENT_ROLE)?.role ?? '';
}

/** Builds the values every token function needs from the portfolio data. */
export function buildTokenContext(
  d: { experience: { role: string; start: string; end: string | null; roleType?: string }[]; projects: unknown[] },
  now = new Date(),
): TokenContext {
  const first = earliestStart(d.experience);
  return {
    months: monthsSinceEarliestStart(d.experience, now),
    currentRole: currentRoleTitle(d.experience),
    projectCount: d.projects.length,
    sinceYear: first ? first.slice(0, 4) : '',
    now,
  };
}
