const rhymeColors = [
  'bg-accent/15',
  'bg-accent/25',
  'bg-accent/35',
  'bg-accent/20',
  'bg-accent/30',
  'bg-accent/45',
  'bg-accent/55',
  'bg-accent/25',
];

export const getRhymeColorClass = (groupId: number): string =>
  rhymeColors[groupId % rhymeColors.length];
