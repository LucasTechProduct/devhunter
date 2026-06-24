import { useEffect, useRef } from "react"

function ProfileCard({ p }) {
  const badgeList = (p.badges || "").split(",").map(b => b.trim()).filter(Boolean)
  return (
    <div className="profile-card">
      <img src={p.avatar_url} alt={p.login} className="avatar" loading="lazy"
           onError={e => { e.target.style.display = "none" }} />
      <div className="profile-body">
        <div className="profile-name">
          {p.name || p.login}
          <span className="profile-handle">@{p.login}</span>
        </div>
        {p.bio && <div className="profile-bio">{p.bio}</div>}
        <div className="profile-badges">
          {badgeList.map(b => (
            <span key={b} className={`badge badge-${b.toLowerCase().replace(/[^a-z]/g,"")}`}>{b}</span>
          ))}
          <span className="badge badge-fr">🇫🇷</span>
        </div>
        <div className="profile-links">
          <a href={p.github_url} target="_blank" rel="noreferrer">GitHub</a>
          {p.blog && <a href={p.blog.startsWith("http") ? p.blog : `https://${p.blog}`} target="_blank" rel="noreferrer">Site</a>}
          {p.email && <span>{p.email}</span>}
          {p.twitter && <a href={`https://twitter.com/${p.twitter}`} target="_blank" rel="noreferrer">@{p.twitter}</a>}
        </div>
      </div>
      <div className="profile-meta">
        <div className="score">{p.score}<span className="score-lbl">pts</span></div>
        <div className="meta-row">👥 {(p.followers || 0).toLocaleString()}</div>
        <div className="meta-row">📦 {p.public_repos || 0} repos</div>
        {p.location && <div className="meta-row">📍 {p.location}</div>}
      </div>
    </div>
  )
}

export default function ResultsPanel({ phase, logs, profiles, stats, progress, onStop, onReset, onDownload }) {
  const logRef = useRef(null)
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [logs])

  const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0

  return (
    <div className="results-panel">
      <div className="results-header">
        <div>
          <h2>{phase === "running" ? "Recherche en cours…" : `${profiles.length} profil${profiles.length > 1 ? "s" : ""} trouvé${profiles.length > 1 ? "s" : ""}`}</h2>
          {phase === "running" && progress.total > 0 && (
            <p className="progress-text">Analyse {progress.done}/{progress.total} profils</p>
          )}
        </div>
        <div className="results-actions">
          {phase === "running" && (
            <button className="btn-stop" onClick={onStop}>Arrêter</button>
          )}
          {profiles.length > 0 && (
            <button className="btn-download" onClick={onDownload}>⬇ Télécharger CSV</button>
          )}
          {phase !== "running" && (
            <button className="btn-reset" onClick={onReset}>← Nouvelle recherche</button>
          )}
        </div>
      </div>

      {phase === "running" && progress.total > 0 && (
        <div className="progress-bar-wrap">
          <div className="progress-bar" style={{ width: `${pct}%` }} />
        </div>
      )}

      {stats && (
        <div className="stats-row">
          {[
            ["Profils", stats.total],
            ["Avec email", stats.with_email],
            ["Score moyen", stats.avg_score],
          ].map(([lbl, val]) => (
            <div key={lbl} className="stat-card">
              <div className="stat-lbl">{lbl}</div>
              <div className="stat-val">{val}</div>
            </div>
          ))}
        </div>
      )}

      <div className="results-body">
        <div className="log-panel" ref={logRef}>
          {logs.map((l, i) => <div key={i} className="log-line">{l}</div>)}
          {phase === "running" && <div className="log-line blink">_</div>}
        </div>

        <div className="profiles-list">
          {profiles.length === 0 && phase === "running" && (
            <div className="empty-profiles">Les profils apparaîtront ici au fur et à mesure…</div>
          )}
          {profiles.map(p => <ProfileCard key={p.login} p={p} />)}
        </div>
      </div>
    </div>
  )
}
