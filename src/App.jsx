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

export default function App() {
  const [tools, setTools] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [state, setState] = useState(initialState)
  const [showInstall, setShowInstall] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [showSplash, setShowSplash] = useState(true)

  useEffect(() => {
    const loadTools = async () => {
      try {
        const res = await fetch('/tools/tools.json')
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
      const res = await fetch(toolRef.file)
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

  return (
    <div className="app">
      {showSplash && (
        <div className="splash" role="status" aria-live="polite">
          <div className="splash-card">
            <div className="splash-logo">+</div>
            <div className="splash-title">Clinical Tools</div>
            <div className="splash-sub">Loading calculators…</div>
          </div>
        </div>
      )}
      <header className="topbar">
        <div className="brand">
          <span className="brand-icon">+</span>
          <div>
            <div className="brand-title">Clinical Tools</div>
            <div className="brand-sub">Fast bedside calculators</div>
          </div>
        </div>
      </header>

      {showInstall && (
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
            <h1 className="section-title">Calculator Library</h1>
            <div className="tool-list">
              {tools.map((tool) => (
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
          </section>
        )}

        {state.screen === 'question' && currentQuestion && (
          <section className="question">
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
                  <label key={opt.id} className="option">
                    <input
                      type="radio"
                      name={currentQuestion.id}
                      checked={state.answers[currentQuestion.id] === opt.id}
                      onChange={() => onSelect(currentQuestion.id, opt.id)}
                    />
                    <span>
                      {opt.label} <span className="score">({opt.score})</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div className="actions">
              <button className="ghost" onClick={goBack}>
                {state.index === 0 ? 'Back to menu' : 'Back'}
              </button>
              <button
                className="primary"
                onClick={goNext}
                disabled={!state.answers[currentQuestion.id]}
              >
                {state.index === state.tool.questions.length - 1 ? 'Calculate' : 'Next'}
              </button>
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
                <div className="band">
                  <div className="band-title">{result.band.label}</div>
                  <div className="band-action">{result.band.action}</div>
                </div>
              )}
            </div>

            <div className="card">
              <h3>Summary</h3>
              <ul className="summary">
                {result.details.map((item) => (
                  <li key={item.id}>
                    <span>{item.title}</span>
                    <span>
                      {item.answer} <em>{item.score}</em>
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="actions">
              <button className="ghost" onClick={backToHome}>
                Back to menu
              </button>
              <button className="primary" onClick={restartTool}>
                Start again
              </button>
            </div>
          </section>
        )}
      </main>
    </div>
  )
}
