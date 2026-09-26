// Placeholder content: this view is not linked from the navigation yet.

export function Stats() {
  return (
    <div>
      <div className="stat-grid">
        {[
          ["1 842", "MMR actuel", "+84 cette semaine"],
          ["71%", "Victoires", "142 sur 200 parties"],
          ["08:42", "Temps moyen", "Intermédiaire"],
          ["18", "Série record", "7 actuellement"],
        ].map((s) => (
          <div className="stat card" key={s[1]}>
            <span>{s[1]}</span>
            <b>{s[0]}</b>
            <small>{s[2]}</small>
          </div>
        ))}
      </div>
      <div className="stats-layout">
        <div className="panel">
          <h3>Progression MMR</h3>
          <div className="chart">
            {[28, 35, 31, 44, 47, 55, 52, 63, 67, 75, 72, 82].map((h, i) => (
              <i key={i} style={{ height: `${h}%` }} />
            ))}
          </div>
          <div className="axis">
            <span>S1</span>
            <span>S2</span>
            <span>S3</span>
            <span>S4</span>
          </div>
        </div>
        <div className="panel achievements">
          <h3>Succès récents</h3>
          {[
            ["⚡", "Éclair", "Une grille en moins de 5 min"],
            ["🔥", "Inarrêtable", "10 victoires consécutives"],
            ["♛", "Expert", "100 grilles difficiles"],
          ].map((a) => (
            <div key={a[1]}>
              <span>{a[0]}</span>
              <p>
                <b>{a[1]}</b>
                <small>{a[2]}</small>
              </p>
              <em>+250</em>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
