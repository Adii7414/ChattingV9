export const BANNERS: Record<string, string> = {
  sunset: 'linear-gradient(135deg, #f97316, #db2777)',
  ocean: 'linear-gradient(135deg, #0ea5e9, #0f766e)',
  forest: 'linear-gradient(135deg, #16a34a, #065f46)',
  grape: 'linear-gradient(135deg, #a855f7, #4338ca)',
  ember: 'linear-gradient(135deg, #dc2626, #78350f)',
  dusk: 'linear-gradient(135deg, #334155, #0f172a)',
  peach: 'linear-gradient(135deg, #fdba74, #fda4af)',
  mint: 'linear-gradient(135deg, #6ee7b7, #22d3ee)',
};
export const bannerStyle = (key?: string | null) => ({ background: (key && BANNERS[key]) || 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary) / 0.5))' });
