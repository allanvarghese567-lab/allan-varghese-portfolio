export type RolePeriod = { start: string; end: string | null };

/** Counts unique calendar months across roles, so concurrent jobs never inflate total experience. */
export function countUniqueExperienceMonths(periods: RolePeriod[], now = new Date()): number {
  const months = new Set<string>();
  for (const period of periods) {
    if (!/^\d{4}-\d{2}$/.test(period.start)) continue;
    const [sy, sm] = period.start.split('-').map(Number);
    const end = period.end && /^\d{4}-\d{2}$/.test(period.end) ? period.end : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const [ey, em] = end.split('-').map(Number);
    let y = sy, m = sm;
    while (y < ey || (y === ey && m <= em)) {
      months.add(`${y}-${String(m).padStart(2, '0')}`);
      m++;
      if (m > 12) { m = 1; y++; }
    }
  }
  return months.size;
}

export function formatExperienceLabel(months: number): string {
  const years = Math.floor(months / 12);
  return `${years}+ years of experience`;
}

export function formatPeriod(start: string, end: string | null): string {
  const fmt = (v: string) => {
    const [y, m] = v.split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString('en', { month: 'short', year: 'numeric' });
  };
  return `${fmt(start)} – ${end ? fmt(end) : 'Present'}`;
}
