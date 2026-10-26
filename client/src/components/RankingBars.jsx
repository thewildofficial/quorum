export default function RankingBars({ ranking, chosenOptionId }) {
  if (!ranking?.length) return null;
  const max = Math.max(...ranking.map((r) => r.total), 10);
  return (
    <div>
      {ranking.map((r, i) => (
        <div className="bar-row" key={r.optionId}>
          <div className="name" title={r.name}>
            {r.name}
            {chosenOptionId === r.optionId && ' ✓'}
          </div>
          <div className="bar-track">
            <div
              className={`bar-fill ${i === 0 ? 'leader' : ''}`}
              style={{ width: `${Math.max(2, (r.total / max) * 100)}%` }}
            />
          </div>
          <div className="val">{r.total.toFixed(2)}</div>
        </div>
      ))}
      <div className="center-note">Weighted score out of 10</div>
    </div>
  );
}
