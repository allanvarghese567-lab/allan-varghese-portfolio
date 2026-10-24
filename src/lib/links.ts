/** Optional connections from a project to an experience card and to skills. */
export type ProjectLinks = {
  /** `id` of an experience entry, or null/undefined when the project is not connected. */
  experienceId?: string | null;
  /** Names of skills from the Skills section (matched by name). */
  skills?: string[];
};

export type Project = {
  name: string;
  category: string;
  description: string;
  technologies: string[];
  status: string;
  url: string;
} & ProjectLinks;

export const newId = (prefix = 'exp') => `${prefix}-${Math.random().toString(36).slice(2, 8)}`;

/** Gives every experience entry a unique, stable id (existing ids are kept). */
export function ensureExperienceIds<T extends { id?: string }>(list: T[]): T[] {
  const seen = new Set<string>();
  return list.map(job => {
    let id = job.id && !seen.has(job.id) ? job.id : '';
    while (!id || seen.has(id)) id = newId('exp');
    seen.add(id);
    return { ...job, id } as T;
  });
}

/** Unique skill names across all groups, in display order. */
export function allSkillNames(groups: { items: string[] }[]): string[] {
  return Array.from(new Set(groups.flatMap(g => g.items)));
}

export function experienceLabel(job: { role: string; company?: string; roleType?: string }): string {
  const title = job.role.trim() || 'Untitled role';
  const company = job.company?.trim();
  return `${title}${company ? ` · ${company}` : ''}${job.roleType ? ` (${job.roleType})` : ''}`;
}

/** Normalised view of a project's optional links. */
export const linksOf = (p: ProjectLinks) => ({
  experienceId: p.experienceId ?? null,
  skills: p.skills ?? [],
});

/** Projects connected to one experience entry (with their index, for anchors). */
export function projectsForExperience<P extends ProjectLinks>(projects: P[], experienceId: string) {
  return projects.flatMap((project, index) => (project.experienceId === experienceId ? [{ project, index }] : []));
}

/** Projects that use a given skill. */
export function projectsForSkill<P extends ProjectLinks>(projects: P[], skill: string): P[] {
  return projects.filter(p => (p.skills ?? []).includes(skill));
}

/* ---------- Automatic skill-rename handling ---------- */

/** Splits one-per-line text into trimmed, non-empty items. */
export const toList = (text: string): string[] => text.split('\n').map(s => s.trim()).filter(Boolean);

/** A skill that just disappeared from a group; if a new one appears in the same spot, it's a rename. */
export type PendingRename = { group: number; index: number; name: string; at: number } | null;

const REPLACE_WINDOW_MS = 3000;
const hasOwn = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k);

/** First index where two lists differ (or the shorter length if one is a prefix of the other). */
const firstDiff = (a: string[], b: string[]) => {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) if (a[i] !== b[i]) return i;
  return n;
};

/**
 * Compares one skill group before/after an edit and works out which skills were renamed.
 *  - same length, exactly one line changed: that's a rename (this covers normal typing)
 *  - same length, several lines changed (paste / swap): not treated as a rename, so links are never re-pointed by guesswork
 *  - one line removed, then (within 3s) one added at the same spot: that's clear-and-retype, i.e. a rename
 *  - anything else (paste, delete, add): no rename
 */
export function diffSkillEdit(
  group: number,
  oldItems: string[],
  newItems: string[],
  pending: PendingRename,
  now = Date.now(),
): { renames: Record<string, string>; pending: PendingRename } {
  const renames: Record<string, string> = {};

  if (oldItems.length === newItems.length) {
    const changed = oldItems.flatMap((from, i) => (from !== newItems[i] ? [i] : []));
    if (changed.length === 1) renames[oldItems[changed[0]]] = newItems[changed[0]];
    return { renames, pending: null };
  }

  if (newItems.length === oldItems.length - 1) {
    const i = firstDiff(oldItems, newItems);
    const rest = oldItems.slice(i + 1);
    const isSingleRemoval = rest.every((s, k) => s === newItems[i + k]);
    return { renames, pending: isSingleRemoval ? { group, index: i, name: oldItems[i], at: now } : null };
  }

  if (newItems.length === oldItems.length + 1 && pending && pending.group === group && now - pending.at <= REPLACE_WINDOW_MS) {
    const j = firstDiff(oldItems, newItems);
    const rest = oldItems.slice(j);
    const isSingleInsert = rest.every((s, k) => s === newItems[j + 1 + k]);
    if (isSingleInsert && j === pending.index && newItems[j] !== pending.name) {
      renames[pending.name] = newItems[j];
    }
  }
  return { renames, pending: null };
}

/** Rewrites project skill links after renames; links that collide are merged without duplicates. */
export function applySkillRenames<P extends ProjectLinks>(projects: P[], renames: Record<string, string>): P[] {
  if (Object.keys(renames).length === 0) return projects;
  return projects.map(p => {
    const skills = p.skills;
    if (!skills || !skills.some(s => hasOwn(renames, s))) return p;
    return { ...p, skills: Array.from(new Set(skills.map(s => (hasOwn(renames, s) ? renames[s] : s)))) };
  });
}
