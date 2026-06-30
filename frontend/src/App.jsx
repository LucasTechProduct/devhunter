import { useState, useRef } from "react"
import SearchForm from "./components/SearchForm"
import ResultsPanel from "./components/ResultsPanel"

export default function App() {
  const [phase, setPhase] = useState("idle") // idle | running | done | error
  const [logs, setLogs] = useState([])
  const [profiles, setProfiles] = useState([])
  const [stats, setStats] = useState(null)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const abortRef = useRef(null)

  function addLog(msg) {
    setLogs(prev => [...prev.slice(-80), msg])
  }

  async function handleSearch(params) {
    setPhase("running")
    setLogs([])
    setProfiles([])
    setStats(null)
    setProgress({ done: 0, total: 0 })

    const { token, ...rest } = params
    const qs = new URLSearchParams()
    Object.entries(rest).forEach(([k, v]) => {
      if (Array.isArray(v)) v.forEach(item => qs.append(k, item))
      else qs.append(k, v)
    })

    const ctrl = new AbortController()
    abortRef.current = ctrl

    const API = window.location.hostname === "localhost"
      ? "http://localhost:8000"
      : `${window.location.protocol}//${window.location.hostname}`

    try {
      const res = await fetch(`${API}/search?${qs}`, {
        signal: ctrl.signal,
        headers: { "X-GitHub-Token": token },
      })

      if (!res.ok) {
        const body = await res.text().catch(() => "")
        throw new Error(`Le serveur a répondu ${res.status} (${res.statusText}). ${body.slice(0, 200)}`)
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buf = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const lines = buf.split("\n")
        buf = lines.pop()

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue
          try {
            const evt = JSON.parse(line.slice(6))
            if (evt.event === "log") addLog(evt.msg)
            else if (evt.event === "profile") setProfiles(prev => [...prev, evt])
            else if (evt.event === "progress") setProgress({ done: evt.done, total: evt.total })
            else if (evt.event === "done") {
              setStats(evt)
              setPhase("done")
            } else if (evt.event === "error") {
              addLog("❌ " + evt.msg)
              setPhase("error")
            }
          } catch (_) {}
        }
      }
    } catch (e) {
      if (e.name !== "AbortError") {
        if (e instanceof TypeError) {
          // fetch a échoué avant même d'atteindre le serveur (réseau, CORS, serveur down)
          addLog(`❌ Connexion impossible à ${API}. Vérifie que le backend tourne.`)
        } else {
          // Erreur survenue après connexion réussie (parsing, stream, erreur serveur)
          addLog(`❌ Erreur pendant la recherche : ${e.message}`)
        }
        setPhase("error")
      }
    }
  }

  function handleStop() {
    abortRef.current?.abort()
    setPhase("done")
  }

  function handleReset() {
    abortRef.current?.abort()
    setPhase("idle")
    setLogs([])
    setProfiles([])
    setStats(null)
  }

  function downloadCSV() {
    if (!profiles.length) return
    const cols = ["score","login","name","bio","location","email","blog","twitter","followers","public_repos","badges","github_url"]
    const rows = [cols.join(",")]
    profiles.forEach(p => {
      rows.push(cols.map(c => `"${String(p[c] ?? "").replace(/"/g, '""')}"`).join(","))
    })
    const a = document.createElement("a")
    a.href = URL.createObjectURL(new Blob([rows.join("\n")], { type: "text/csv" }))
    a.download = `devs-fr-${new Date().toISOString().slice(0,10)}.csv`
    a.click()
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="logo">DevHunter</div>
        <p className="tagline">Sourcez des développeurs sur GitHub · Export CSV instantané</p>
      </header>

      <main className="app-main">
        {phase === "idle" ? (
          <SearchForm onSearch={handleSearch} />
        ) : (
          <ResultsPanel
            phase={phase}
            logs={logs}
            profiles={profiles}
            stats={stats}
            progress={progress}
            onStop={handleStop}
            onReset={handleReset}
            onDownload={downloadCSV}
          />
        )}
      </main>
    </div>
  )
}
