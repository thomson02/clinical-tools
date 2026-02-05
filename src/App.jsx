import React, { useEffect, useMemo, useState } from 'react'

const initialState = {
  screen: 'home',
  tool: null,
  index: 0,
  answers: {}
}

function isIosDevice() {
  if (typeof window === 'undefined') return false
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent)
}

function isStandaloneMode() {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  )
}

function computeResult(tool, answers) {
  let total = 0
  const details = tool.questions.map((q) => {
    const selectedId = answers[q.id]
    const option = q.options.find((o) => o.id === selectedId)
    const score = option ? option.score : 0
    total += score
    return {
      id: q.id,
      title: q.title,
      answer: option ? option.label : 'Not answered',
      score
    }
  })

  const band = tool.scoring.bands.find(
    (b) => total >= b.min && total <= b.max
  )

  return { total, details, band }
}

function getBandMeta(label) {
  const value = label.toLowerCase()
  if (value.includes('severe')) return { tone: 'severe', icon: '⚠️' }
  if (value.includes('moderate')) return { tone: 'moderate', icon: '⚠️' }
  if (value.includes('mild')) return { tone: 'mild', icon: 'ℹ️' }
  if (value.includes('vulnerable')) return { tone: 'mild', icon: 'ℹ️' }
  return { tone: 'calm', icon: 'ℹ️' }
}

export default function App() {
  const [tools, setTools] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [state, setState] = useState(initialState)
  const [showInstall, setShowInstall] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [showSplash, setShowSplash] = useState(true)
  const [query, setQuery] = useState('')
  const [filterTab, setFilterTab] = useState('all')
  const [recent, setRecent] = useState(() => {
    if (typeof window === 'undefined') return []
    try {
      return JSON.parse(localStorage.getItem('recent') || '[]')
    } catch {
      return []
    }
  })

  useEffect(() => {
    const loadTools = async () => {
      try {
        const res = await fetch(`${import.meta.env.BASE_URL}tools/tools.json`)
        if (!res.ok) throw new Error('Failed to load tools')
        const data = await res.json()
        setTools(data.tools || [])
      } catch (err) {
        setError('Unable to load tools list.')
      } finally {
        setLoading(false)
      }
    }
    loadTools()
  }, [])

  useEffect(() => {
    if (isIosDevice() && !isStandaloneMode()) {
      setShowInstall(true)
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 2200)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    const onUpdateReady = () => {
      const registration = window.__swRegistration
      if (!registration || !registration.waiting) return
      setUpdating(true)
      registration.waiting.postMessage({ type: 'SKIP_WAITING' })
    }

    const onControllerChange = () => {
      if (updating) window.location.reload()
    }

    window.addEventListener('sw-ready', onUpdateReady)
    navigator.serviceWorker?.addEventListener('controllerchange', onControllerChange)

    return () => {
      window.removeEventListener('sw-ready', onUpdateReady)
      navigator.serviceWorker?.removeEventListener(
        'controllerchange',
        onControllerChange
      )
    }
  }, [updating])

  const currentQuestion = useMemo(() => {
    if (!state.tool) return null
    return state.tool.questions[state.index] || null
  }, [state.tool, state.index])

  const result = useMemo(() => {
    if (!state.tool || state.screen !== 'result') return null
    return computeResult(state.tool, state.answers)
  }, [state.tool, state.screen, state.answers])

  const startTool = async (toolRef) => {
    try {
      setRecent((prev) => {
        const next = [toolRef.id, ...prev.filter((id) => id !== toolRef.id)].slice(0, 8)
        localStorage.setItem('recent', JSON.stringify(next))
        return next
      })
      const res = await fetch(`${import.meta.env.BASE_URL}${toolRef.file}`)
      if (!res.ok) throw new Error('Failed to load tool')
      const tool = await res.json()
      setState({
        screen: 'question',
        tool,
        index: 0,
        answers: {}
      })
    } catch (err) {
      setError('Unable to load selected tool.')
    }
  }

  const onSelect = (questionId, optionId) => {
    setState((prev) => ({
      ...prev,
      answers: { ...prev.answers, [questionId]: optionId }
    }))
    setTimeout(() => {
      setState((prev) => {
        if (!prev.tool) return prev
        if (prev.index >= prev.tool.questions.length - 1) {
          return { ...prev, screen: 'result' }
        }
        return { ...prev, index: prev.index + 1 }
      })
    }, 220)
  }

  const goNext = () => {
    if (!state.tool) return
    if (state.index >= state.tool.questions.length - 1) {
      setState((prev) => ({ ...prev, screen: 'result' }))
      return
    }
    setState((prev) => ({ ...prev, index: prev.index + 1 }))
  }

  const goBack = () => {
    if (state.index === 0) {
      setState(initialState)
      return
    }
    setState((prev) => ({ ...prev, index: prev.index - 1 }))
  }

  const restartTool = () => {
    if (!state.tool) return
    setState({ screen: 'question', tool: state.tool, index: 0, answers: {} })
  }

  const backToHome = () => setState(initialState)

  const filteredTools = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    let base = tools

    if (filterTab === 'recent') {
      base = recent
        .map((id) => tools.find((tool) => tool.id === id))
        .filter(Boolean)
    }

    if (!normalizedQuery) return base
    return base.filter((tool) => {
      return (
        tool.name.toLowerCase().includes(normalizedQuery) ||
        tool.description.toLowerCase().includes(normalizedQuery)
      )
    })
  }, [tools, query, filterTab, recent])

  return (
    <div className="app">
      {showSplash && (
        <div className="splash" role="status" aria-live="polite">
          <div className="splash-card">
            <img
              className="splash-logo"
              src={`${import.meta.env.BASE_URL}logo.jpg`}
              alt="Strathgryffe Medical Practice"
            />
            <div className="splash-title">Clinical Tools</div>
            <div className="splash-sub">Loading tools...</div>
          </div>
        </div>
      )}
      <header className="topbar">
        <div className="brand">
          <img
            className="brand-icon"
            src={`${import.meta.env.BASE_URL}icon.png`}
            alt="Strathgryffe Medical Practice"
          />
          <img
            className="brand-text"
            src={`${import.meta.env.BASE_URL}text.png`}
            alt="Strathgryffe Medical Practice"
          />
        </div>
        {state.screen === 'home' && (
          <div className="search">
            <span className="search-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14Zm0-12a5 5 0 1 0 0 10 5 5 0 0 0 0-10Zm9.7 14.3-4.2-4.2 1.4-1.4 4.2 4.2-1.4 1.4Z"
                  fill="currentColor"
                />
              </svg>
            </span>
            <input
              type="search"
              placeholder="Search tools (e.g. frailty)"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        )}
      </header>

      {showInstall && state.screen === 'home' && (
        <section className="banner">
          <div className="banner-text">
            Install this app: tap the Share icon and select “Add to Home Screen”.
          </div>
          <button className="ghost" onClick={() => setShowInstall(false)}>
            Dismiss
          </button>
        </section>
      )}

      {updating && (
        <section className="banner updating">
          <div className="banner-text">Updating app…</div>
        </section>
      )}

      <main className="content">
        {loading && <div className="card">Loading tools…</div>}
        {error && <div className="card error">{error}</div>}

        {!loading && !error && state.screen === 'home' && (
          <section>
            <div className="section-hint">
              {filterTab === 'recent'
                ? 'Recent tools'
                : 'Available tools'}
            </div>
            <div className="tool-list">
              {filteredTools.map((tool) => (
                <button
                  key={tool.id}
                  className="tool-card"
                  onClick={() => startTool(tool)}
                >
                  <div className="tool-icon">{tool.icon || '🩺'}</div>
                  <div className="tool-body">
                    <div className="tool-title">{tool.name}</div>
                    <div className="tool-desc">{tool.description}</div>
                  </div>
                  <div className="tool-cta" aria-hidden="true">›</div>
                </button>
              ))}
            </div>
            {filteredTools.length === 0 && (
              <div className="card empty">
                {filterTab === 'recent' ? 'No recent tools yet.' : 'No tools found.'}
              </div>
            )}
          </section>
        )}

        {state.screen === 'question' && currentQuestion && (
          <section className="question">
            <div className="tool-bar full">
              <button className="tool-nav icon" onClick={goBack} aria-label="Back">
                {state.index === 0 ? (
                  <span className="tool-home-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path
                        d="M4 11.5 12 5l8 6.5V20a1 1 0 0 1-1 1h-4.5a1 1 0 0 1-1-1v-4.5h-3V20a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-8.5Z"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linejoin="round"
                      />
                    </svg>
                  </span>
                ) : (
                  '‹'
                )}
              </button>
              <div className="tool-titlebar">{state.tool.name}</div>
              <div className="tool-spacer" aria-hidden="true" />
            </div>
            <div className="progress">
              <div>
                Question {state.index + 1} of {state.tool.questions.length}
              </div>
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{
                    width: `${((state.index + 1) / state.tool.questions.length) * 100}%`
                  }}
                />
              </div>
            </div>

            <div className="card question-card">
              <h2>{currentQuestion.title}</h2>
              {currentQuestion.help && (
                <p className="hint">{currentQuestion.help}</p>
              )}
              <div className="options">
                {currentQuestion.options.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    className={`option ${state.answers[currentQuestion.id] === opt.id ? 'selected' : ''}`}
                    onClick={() => onSelect(currentQuestion.id, opt.id)}
                    role="radio"
                    aria-checked={state.answers[currentQuestion.id] === opt.id}
                  >
                    <span className="radio" aria-hidden="true" />
                    <span className="option-text">
                      {opt.label} <span className="score">({opt.score})</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>

          </section>
        )}

        {state.screen === 'result' && result && (
          <section className="result">
            <div className="card result-card">
              <h2>{state.tool.name}</h2>
              <div className="score-block">
                <div className="score-label">Total score</div>
                <div className="score-value">
                  {result.total} / {state.tool.scoring.max}
                </div>
              </div>
              {result.band && (
                (() => {
                  const meta = getBandMeta(result.band.label)
                  return (
                    <div className={`band ${meta.tone}`}>
                      <div className="band-title">
                        <span className="band-icon" aria-hidden="true">
                          {meta.icon}
                        </span>
                        {result.band.label}
                      </div>
                      <div className="band-action">{result.band.action}</div>
                    </div>
                  )
                })()
              )}
            </div>

            <div className="card">
              <h3>Summary</h3>
              <ul className="summary">
                {result.details.map((item) => (
                  <li key={item.id}>
                    <span className="summary-title">{item.title}</span>
                    <span className="summary-answer">{item.answer}</span>
                    <span className="summary-score">{item.score}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="actions native-actions">
              <button className="native primary" onClick={restartTool}>
                Start again
              </button>
              <button className="native secondary" onClick={backToHome}>
                Back to menu
              </button>
            </div>
          </section>
        )}
      </main>
      {state.screen === 'home' && (
        <nav className="toolbar" role="tablist" aria-label="Tool filters">
          <button
            className={`tab ${filterTab === 'all' ? 'active' : ''}`}
            onClick={() => setFilterTab('all')}
            role="tab"
            aria-selected={filterTab === 'all'}
          >
            <span className="tab-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M4 11.5 12 5l8 6.5V20a1 1 0 0 1-1 1h-4.5a1 1 0 0 1-1-1v-4.5h-3V20a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-8.5Z"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linejoin="round"
                />
              </svg>
            </span>
            Home
          </button>
          <button
            className={`tab ${filterTab === 'recent' ? 'active' : ''}`}
            onClick={() => setFilterTab('recent')}
            role="tab"
            aria-selected={filterTab === 'recent'}
          >
            <span className="tab-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle
                  cx="12"
                  cy="12"
                  r="8"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                />
                <path
                  d="M12 8v4l3 2"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                />
              </svg>
            </span>
            Recent
          </button>
        </nav>
      )}
    </div>
  )
}
