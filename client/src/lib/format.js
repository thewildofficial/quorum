export function brierLabel(b) {
  if (b === 0) return 'perfect';
  if (b < 0.1) return 'excellent';
  if (b < 0.25) return 'better than coin-flip';
  if (b === 0.25) return 'coin-flip level';
  return 'worse than coin-flip';
}
