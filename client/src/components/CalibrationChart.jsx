// Calibration plot: mean predicted probability vs actual success rate per bin,
// against the perfect-calibration diagonal.
export default function CalibrationChart({ bins }) {
  const W = 460, H = 300, P = 42;
  const x = (v) => P + v * (W - P - 16);
  const y = (v) => H - P - v * (H - P - 16);
  const ticks = [0, 0.25, 0.5, 0.75, 1];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Calibration curve">
      <rect x={0} y={0} width={W} height={H} fill="#fff" />
      {ticks.map((t) => (
        <g key={t}>
          <line x1={x(t)} y1={y(0)} x2={x(t)} y2={y(1)} stroke="#eef1f6" />
          <line x1={x(0)} y1={y(t)} x2={x(1)} y2={y(t)} stroke="#eef1f6" />
          <text x={x(t)} y={y(0) + 16} fontSize="11" textAnchor="middle" fill="#5b6779">{t.toFixed(2)}</text>
          <text x={x(0) - 8} y={y(t) + 4} fontSize="11" textAnchor="end" fill="#5b6779">{t.toFixed(2)}</text>
        </g>
      ))}
      <line x1={x(0)} y1={y(0)} x2={x(1)} y2={y(1)} stroke="#c7cddb" strokeDasharray="5 4" />
      {bins.map((b, i) => (
        <g key={i}>
          <circle cx={x(b.meanPredicted)} cy={y(b.actualRate)} r={5 + b.count * 1.5} fill="#4f46e5" opacity="0.75" />
          <text x={x(b.meanPredicted)} y={y(b.actualRate) - 10 - b.count} fontSize="10" textAnchor="middle" fill="#3730a3">
            n={b.count}
          </text>
        </g>
      ))}
      <text x={(x(0) + x(1)) / 2} y={H - 6} fontSize="12" textAnchor="middle" fill="#5b6779">Mean predicted probability</text>
      <text x={12} y={(y(0) + y(1)) / 2} fontSize="12" textAnchor="middle" fill="#5b6779" transform={`rotate(-90 12 ${(y(0) + y(1)) / 2})`}>
        Actual success rate
      </text>
    </svg>
  );
}
