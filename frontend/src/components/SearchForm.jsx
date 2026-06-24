import { useState } from "react"

const PRESET_LOCATIONS = ["France", "Paris", "Lyon", "Bordeaux", "Nantes", "Toulouse", "Marseille", "Lille", "Rennes", "Grenoble"]

export default function SearchForm({ onSearch }) {
  const [token, setToken] = useState("")
  const [count, setCount] = useState(25)
  const [strategy, setStrategy] = useState("mixed")
  const [nodejs, setNodejs] = useState(true)
  const [perf, setPerf] = useState(false)
  const [mongodb, setMongodb] = useState(false)
  const [react, setReact] = useState(false)
  const [language, setLanguage] = useState("javascript")
  const [minFollowers, setMinFollowers] = useState(10)
  const [locations, setLocations] = useState(["France"])
  const [customSkills, setCustomSkills] = useState("")

  function toggleLocation(loc) {
    setLocations(prev =>
      prev.includes(loc) ? prev.filter(l => l !== loc) : [...prev, loc]
    )
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (!token.trim()) return

    onSearch({
      token: token.trim(),
      count,
      strategy,
      nodejs,
      perf,
      mongodb,
      react,
      language,
      min_followers: minFollowers,
      locations: locations.length ? locations : ["France"],
      custom_skills: customSkills.split(",").map(s => s.trim()).filter(Boolean),
    })
  }

  return (
    <form className="search-form" onSubmit={handleSubmit}>
      <section className="form-section">
        <h2>Accès GitHub</h2>
        <div className="field">
          <label>
            Token GitHub
            <a href="https://github.com/settings/tokens/new?scopes=&description=devhunter"
               target="_blank" rel="noreferrer" className="label-link">
              → Créer un token (aucun scope requis)
            </a>
          </label>
          <input
            type="password"
            placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
            value={token}
            onChange={e => setToken(e.target.value)}
            required
            autoComplete="off"
          />
          <p className="hint">Le token reste sur votre machine, il n'est jamais transmis à un tiers.</p>
        </div>
      </section>

      <section className="form-section">
        <h2>Profil recherché</h2>

        <div className="field">
          <label>Compétences prioritaires</label>
          <div className="checkbox-grid">
            {[
              { key: "nodejs", label: "Node.js / Backend", val: nodejs, set: setNodejs, desc: "Express, Fastify, NestJS, Koa…" },
              { key: "perf", label: "Perf & Scalabilité", val: perf, set: setPerf, desc: "Redis, Kafka, microservices, benchmarks…" },
              { key: "mongodb", label: "MongoDB", val: mongodb, set: setMongodb, desc: "Mongoose, sharding, agrégations…" },
              { key: "react", label: "React / Frontend", val: react, set: setReact, desc: "Next.js, Redux, Remix…" },
            ].map(({ key, label, val, set, desc }) => (
              <label key={key} className={`skill-card ${val ? "selected" : ""}`}>
                <input type="checkbox" checked={val} onChange={e => set(e.target.checked)} />
                <span className="skill-name">{label}</span>
                <span className="skill-desc">{desc}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="field">
          <label>Compétences supplémentaires <span className="hint-inline">(séparées par des virgules)</span></label>
          <input
            type="text"
            placeholder="ex: PostgreSQL, Docker, GraphQL"
            value={customSkills}
            onChange={e => setCustomSkills(e.target.value)}
          />
        </div>

        <div className="field-row">
          <div className="field">
            <label>Langage principal</label>
            <select value={language} onChange={e => setLanguage(e.target.value)}>
              <option value="javascript">JavaScript</option>
              <option value="typescript">TypeScript</option>
              <option value="python">Python</option>
              <option value="go">Go</option>
              <option value="rust">Rust</option>
            </select>
          </div>
          <div className="field">
            <label>Followers minimum</label>
            <select value={minFollowers} onChange={e => setMinFollowers(Number(e.target.value))}>
              <option value={0}>Tous</option>
              <option value={5}>5+</option>
              <option value={10}>10+</option>
              <option value={30}>30+</option>
              <option value={100}>100+</option>
            </select>
          </div>
        </div>
      </section>

      <section className="form-section">
        <h2>Localisation</h2>
        <div className="field">
          <label>Villes / régions</label>
          <div className="location-chips">
            {PRESET_LOCATIONS.map(loc => (
              <button
                key={loc}
                type="button"
                className={`chip ${locations.includes(loc) ? "chip-active" : ""}`}
                onClick={() => toggleLocation(loc)}
              >
                {loc}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="form-section">
        <h2>Paramètres de recherche</h2>
        <div className="field-row">
          <div className="field">
            <label>Nombre de profils</label>
            <select value={count} onChange={e => setCount(Number(e.target.value))}>
              <option value={15}>15 profils</option>
              <option value={25}>25 profils</option>
              <option value={40}>40 profils</option>
              <option value={60}>60 profils</option>
            </select>
          </div>
          <div className="field">
            <label>Stratégie</label>
            <select value={strategy} onChange={e => setStrategy(e.target.value)}>
              <option value="mixed">Mixte (recommandé)</option>
              <option value="search">Recherche directe GitHub</option>
              <option value="contributors">Contributeurs projets Node.js</option>
            </select>
          </div>
        </div>
      </section>

      <button type="submit" className="btn-submit" disabled={!token.trim()}>
        Lancer la recherche →
      </button>
    </form>
  )
}
