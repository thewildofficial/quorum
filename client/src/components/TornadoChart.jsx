// Tornado view: how the leader's margin moves when each criterion's weight is
// halved (orange, left) or doubled (blue, right). Negative margins (flips)
// clamp at zero on the chart and are flagged below the row.
export default function TornadoChart({ sensitivity, baseMargin, ranking }) {
  if (!sensitivity?.rows?.length) return null;
  const leaderName = ranking?.find((r) => r.optionId === sensitivity.leaderId)?.name || 'Leader';
  const maxAbs = Math.max(
    1,
    ...sensitivity.rows.flatMap((r) => [Math.abs(r.marginAtHalf), Math.abs(r.marginAtDouble), Math.abs(baseMargin)])
  );
  const toPct = (m) => (Math.max(0, m) / maxAbs) * 50;

  return (
    <div>
      <div className="legend">
        <span><span className="dot" style={{ background: '#f2b37e' }} />Weight halved</span>
        <span><span className="dot" style={{ background: '#93b8f5' }} />Weight doubled</span>
        <span style={{ marginLeft: 'auto' }}>Centre line: current margin of {baseMargin.toFixed(2)}</span>
      </div>
      {sensitivity.rows.map((r) => (
        <div key={r.criterionId}>
          <div className="tornado-row">
            <div className="name" title={r.name}>{r.name}</div>
            <div className="tornado-track">
              <div
                className="tornado-seg down"
                style={{
                  right: `${50 + toPct(baseMargin)}%`,
                  width: `${Math.abs(toPct(r.marginAtHalf) - toPct(baseMargin))}%`,
                }}
              />
              <div
                className="tornado-seg up"
                style={{
                  left: `${50 + toPct(baseMargin)}%`,
                  width: `${Math.abs(toPct(r.marginAtDouble) - toPct(baseMargin))}%`,
                }}
              />
              <div className="tornado-center" style={{ left: `${50 + toPct(baseMargin)}%` }} />
            </div>
          </div>
          {r.flipsWithinRange && (
            <div className="flip-note">
              {r.flipsWhenDownscaledTo !== null &&
                `"${leaderName}" loses the lead if this weight drops to ~${Math.round(r.flipsWhenDownscaledTo * 100)}% of current. `}
              {r.flipsWhenUpscaledTo !== null &&
                `"${leaderName}" loses the lead if this weight rises to ~${Math.round(r.flipsWhenUpscaledTo * 100)}% of current.`}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
