import { useEffect, useMemo, useRef, useState } from 'react'

const SOUND_META = [
  ['Rounded vowels', 'ü · ö', 'Lips round, tongue stays forward'],
  ['ich / ach', 'ç · x', 'Forward vs back friction'],
  ['Uvular r', 'ʁ', 'Relaxed German r'],
  ['Final devoicing', 'b→p · d→t · g→k', 'Word-final voicing contrast'],
]

const API = '/api'

async function getJSON(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Request failed: ${res.status}`)
  return res.json()
}

function scoreClass(n) {
  if (n >= 85) return 'good'
  if (n >= 65) return 'mid'
  return 'low'
}

function App() {
  const [page, setPage] = useState('home')
  const [categories, setCategories] = useState([])
  const [words, setWords] = useState([])
  const [selectedCategory, setSelectedCategory] = useState('Phonetics_Practice')
  const [selectedWord, setSelectedWord] = useState(null)
  const [search, setSearch] = useState('')
  const [attempts, setAttempts] = useState(() => JSON.parse(localStorage.getItem('sprachklang_attempts') || '[]'))
  const [apiError, setApiError] = useState('')

  useEffect(() => {
    getJSON(`${API}/categories`).then(setCategories).catch(e => setApiError(e.message))
  }, [])

  useEffect(() => {
    if (page === 'library' || page === 'practice' || page === 'pairs') {
      getJSON(`${API}/words?category=${encodeURIComponent(selectedCategory)}${search ? `&search=${encodeURIComponent(search)}` : ''}`)
        .then(setWords).catch(e => setApiError(e.message))
    }
  }, [page, selectedCategory, search])

  function openPractice(word) {
    setSelectedWord(word)
    setPage('practice')
  }

  function addAttempt(result, word) {
    const entry = {
      id: crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`,
      at: new Date().toISOString(),
      word: word.word,
      wordId: word.id,
      category: word.category,
      score: result.overall_score,
      weak: result.weak_category,
      phonemes: result.phoneme_scores,
    }
    const next = [entry, ...attempts].slice(0, 100)
    setAttempts(next)
    localStorage.setItem('sprachklang_attempts', JSON.stringify(next))
  }

  return <div className="app-shell">
    <header className="topbar">
      <button className="brand" onClick={() => setPage('home')}>
        <span className="brand-mark">SK</span>
        <span><strong>SprachKlang</strong><small>German Pronunciation Lab</small></span>
      </button>
      <nav>
        {[
          ['home', 'Home'], ['library', 'Word Bank'], ['practice', 'Practice'], ['pairs', 'Minimal Pairs'], ['progress', 'Progress']
        ].map(([id, label]) => <button key={id} className={page === id ? 'nav-active' : ''} onClick={() => setPage(id)}>{label}</button>)}
      </nav>
      <div className="status-pill"><span className="dot"/> Microphone ready</div>
    </header>

    {apiError && <div className="error-banner">Backend connection issue: {apiError}. Start FastAPI on port 8000.</div>}

    <main>
      {page === 'home' && <Home categories={categories} attempts={attempts} onCategory={(c) => { setSelectedCategory(c); setPage('library') }} onPractice={() => {
        const recent = attempts[0]
        if (recent) { const w = words.find(x => x.id === recent.wordId); if (w) return openPractice(w) }
        setPage('library')
      }} />}
      {page === 'library' && <Library categories={categories} category={selectedCategory} setCategory={setSelectedCategory} words={words} search={search} setSearch={setSearch} onPractice={openPractice} />}
      {page === 'practice' && <Practice word={selectedWord || words[0]} category={selectedCategory} onResult={addAttempt} onBack={() => setPage('library')} />}
      {page === 'pairs' && <Pairs categories={categories} category={selectedCategory} setCategory={setSelectedCategory} words={words} onPractice={openPractice} />}
      {page === 'progress' && <Progress attempts={attempts} />}
    </main>
    <footer>SprachKlang · capstone pronunciation practice · scoring API is isolated for later Charsiu/wav2vec2 integration</footer>
  </div>
}

function Home({ categories, attempts, onCategory, onPractice }) {
  const average = attempts.length ? Math.round(attempts.reduce((a, b) => a + b.score, 0) / attempts.length) : 0
  return <>
    <section className="hero">
      <div className="hero-copy">
        <div className="eyebrow">PCCOE · MDM German · Semesters III–VII</div>
        <h1>Train the <span>sound</span>, not just the word.</h1>
        <p>Listen to a native reference, record yourself, and get targeted feedback on the German sounds that are hardest to hear and produce.</p>
        <div className="hero-actions"><button className="primary" onClick={onPractice}>Continue practicing →</button><button className="ghost" onClick={() => document.getElementById('sound-focus')?.scrollIntoView({behavior:'smooth'})}>Explore target sounds</button></div>
        <div className="stats-row"><Stat label="Attempts" value={attempts.length}/><Stat label="Average" value={average ? `${average}%` : '—'}/><Stat label="Dataset" value="6 modules"/></div>
      </div>
      <div className="hero-card">
        <div className="wave"><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/></div>
        <div className="hero-card-label">TODAY'S FOCUS</div>
        <div className="hero-card-word">ü · ö · ç · ʁ</div>
        <p>Four sound families, one practice loop.</p>
        <div className="mini-score"><span>Sound accuracy</span><b>{average || '—'}%</b></div>
      </div>
    </section>

    <section className="section" id="sound-focus"><div className="section-heading"><div><div className="eyebrow">Target sounds</div><h2>Where pronunciation gets interesting.</h2></div></div>
      <div className="sound-grid">{SOUND_META.map(([title, symbols, desc]) => <div className="sound-card" key={title}><span className="sound-symbols">{symbols}</span><h3>{title}</h3><p>{desc}</p></div>)}</div>
    </section>

    <section className="section"><div className="section-heading"><div><div className="eyebrow">Your curriculum</div><h2>Pick a module.</h2></div></div>
      <div className="module-grid">{categories.map((c, i) => <button className="module-card" key={c.id} onClick={() => onCategory(c.id)}><span className="module-number">0{i + 1}</span><div><h3>{c.name}</h3><p>{c.description}</p></div><strong>{c.count}</strong></button>)}</div>
    </section>
  </>
}

function Stat({label, value}) { return <div className="stat"><b>{value}</b><span>{label}</span></div> }

function Library({ categories, category, setCategory, words, search, setSearch, onPractice }) {
  return <section className="page-section"><PageTitle eyebrow="Word bank" title="Build your pronunciation library." subtitle="Your CSV dataset is loaded directly by FastAPI — no vocabulary is regenerated." />
    <div className="category-tabs">{categories.map(c => <button key={c.id} className={category === c.id ? 'tab-active' : ''} onClick={() => {setCategory(c.id); setSearch('')}}>{c.name}<span>{c.count}</span></button>)}</div>
    <div className="toolbar"><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search German, English or sentence…"/><span>{words.length} words</span></div>
    <div className="word-grid">{words.map(w => <WordCard key={w.id} word={w} onPractice={onPractice}/>)}</div>
    {!words.length && <Empty text="No words found. Check that the backend can read this category's CSV."/>}
  </section>
}

function WordCard({word, onPractice}) {
  return <article className="word-card"><div className="word-top"><span className="category-chip">{word.sound_category || 'Vocabulary'}</span>{word.ipa && <span className="ipa">{word.ipa}</span>}</div><h3>{word.word}</h3><p className="meaning">{word.english}</p><p className="example">“{word.example_sentence || 'Example sentence unavailable.'}”</p><div className="card-actions"><AudioButton word={word}/><button className="primary small" onClick={() => onPractice(word)}>Practice</button></div></article>
}

function AudioButton({word}) {
  const [playing, setPlaying] = useState(false)
  const audioRef = useRef(null)
  function play() {
    const a = audioRef.current || new Audio(`/api/audio/${encodeURIComponent(word.id)}?category=${encodeURIComponent(word.category)}`)
    audioRef.current = a
    setPlaying(true)
    a.onended = () => setPlaying(false)
    a.onerror = () => setPlaying(false)
    a.play().catch(() => setPlaying(false))
  }
  return <button className="audio-btn" onClick={play}>{playing ? '■ Playing' : '▶ Reference'}</button>
}

function Practice({word, category, onResult, onBack}) {
  const [recording, setRecording] = useState(false)
  const [blob, setBlob] = useState(null)
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const mediaRef = useRef(null)
  const chunksRef = useRef([])
  if (!word) return <section className="page-section"><Empty text="Select a word from the Word Bank first."/></section>

  async function startRecording() {
    setError(''); setResult(null); setBlob(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({audio: true})
      const recorder = new MediaRecorder(stream)
      chunksRef.current = []
      recorder.ondataavailable = e => { if (e.data.size) chunksRef.current.push(e.data) }
      recorder.onstop = () => {
        stream.getTracks().forEach(t => t.stop())
        setBlob(new Blob(chunksRef.current, {type: recorder.mimeType || 'audio/webm'}))
      }
      mediaRef.current = recorder
      recorder.start()
      setRecording(true)
    } catch (e) { setError('Microphone access was blocked. Allow microphone permission in your browser and try again.') }
  }
  function stopRecording() { mediaRef.current?.stop(); setRecording(false) }
  async function score() {
    if (!blob) return
    setBusy(true); setError('')
    try {
      const fd = new FormData()
      fd.append('audio', blob, 'recording.webm')
      fd.append('word_id', word.id)
      fd.append('category', category || word.category)
      const res = await fetch(`${API}/score`, {method:'POST', body:fd})
      if (!res.ok) throw new Error('Scoring request failed')
      const data = await res.json(); setResult(data); onResult(data, word)
    } catch (e) { setError('Could not score the recording. Make sure FastAPI is running.') }
    finally { setBusy(false) }
  }
  return <section className="page-section practice-page"><button className="back" onClick={onBack}>← Back to Word Bank</button><div className="practice-layout"><div className="practice-main">
    <PageTitle eyebrow="Practice studio" title="Say it like you mean it." subtitle="Listen first. Record. Get sound-level feedback. Retry immediately." />
    <div className="practice-word-card"><div className="word-context">{word.sound_category || category}</div><h2>{word.word}</h2>{word.ipa && <div className="big-ipa">{word.ipa}</div>}<p>{word.english}</p><p className="practice-example">“{word.example_sentence}”</p><AudioButton word={word}/></div>
    <div className="recorder"><div className={`mic-orb ${recording ? 'recording' : ''}`}><span>{recording ? '●' : '🎙'}</span></div><h3>{recording ? 'Listening… speak now' : blob ? 'Recording captured' : 'Ready when you are'}</h3><p>{recording ? 'Click stop when you finish the word.' : 'Use a quiet room and speak naturally.'}</p><div className="rec-actions">{!recording ? <button className="primary record" onClick={startRecording}>{blob ? '↻ Record again' : '● Start recording'}</button> : <button className="stop" onClick={stopRecording}>■ Stop recording</button>}{blob && !recording && <button className="primary" disabled={busy} onClick={score}>{busy ? 'Scoring…' : 'Score pronunciation →'}</button>}</div>{error && <div className="inline-error">{error}</div>}</div>
  </div><aside className="practice-side"><div className="side-card"><div className="eyebrow">Target</div><h3>{word.sound_category || 'Pronunciation'}</h3><p>{word.note || 'Focus on the sound highlighted by this vocabulary item.'}</p></div>{result && <ResultCard result={result}/>} {!result && <div className="side-card muted"><div className="eyebrow">Scoring pipeline</div><p>Browser microphone → <b>POST /api/score</b> → isolated scorer → feedback.</p><small>Current mode: mock scorer. Replace it later with Charsiu/wav2vec2 without changing this UI.</small></div>}</aside></div></section>
}

function ResultCard({result}) { return <div className="result-card"><div className="eyebrow">Pronunciation result</div><div className={`big-score ${scoreClass(result.overall_score)}`}>{result.overall_score}<span>%</span></div><div className="result-label">overall accuracy</div><div className="phoneme-list">{result.phoneme_scores.map(p => <div className="phoneme" key={p.phone}><div><span>{p.phone}</span><b>{p.score}%</b></div><div className="bar"><i style={{width:`${p.score}%`}}/></div></div>)}</div><div className="feedback"><b>Coach feedback</b><p>{result.feedback}</p></div><span className="mock-badge">{result.mode} scoring</span></div> }

function Pairs({categories, category, setCategory, words, onPractice}) {
  const pairs = useMemo(() => {
    const map = new Map(words.map(w => [w.word.trim().toLowerCase(), w]))
    const seen = new Set()
    return words.filter(w => w.minimal_pair_partner).map(w => {
      const partner = map.get(w.minimal_pair_partner.trim().toLowerCase())
      if (!partner) return null
      const key = [w.id, partner.id].sort().join('|')
      if (seen.has(key)) return null
      seen.add(key); return [w, partner]
    }).filter(Boolean)
  }, [words])
  return <section className="page-section"><PageTitle eyebrow="Minimal pairs" title="Hear the contrast. Then make it." subtitle="Pairs come directly from Phonetics_Practice.csv using minimal_pair_partner."/><div className="category-tabs compact"><button className={category==='Phonetics_Practice'?'tab-active':''} onClick={()=>setCategory('Phonetics_Practice')}>Phonetics Practice</button>{category !== 'Phonetics_Practice' && <span className="notice">Minimal pairs are stored in Phonetics Practice.</span>}</div><div className="pair-grid">{pairs.map(([a,b]) => <div className="pair-card" key={a.id+b.id}><PairWord word={a}/><div className="vs">VS</div><PairWord word={b}/><button className="primary small full" onClick={() => onPractice(a)}>Practice “{a.word}”</button></div>)}</div>{!pairs.length && <Empty text="No minimal pairs were found. Check the Phonetics Practice CSV fields."/>}</section>
}
function PairWord({word}) { return <div className="pair-word"><span>{word.sound_category || 'contrast'}</span><h3>{word.word}</h3><p>{word.english}</p><AudioButton word={word}/></div> }

function Progress({attempts}) {
  const average = attempts.length ? Math.round(attempts.reduce((a,b)=>a+b.score,0)/attempts.length) : 0
  const weakMap = {}
  attempts.forEach(a => { weakMap[a.weak] = (weakMap[a.weak] || []).concat(a.score) })
  const weak = Object.entries(weakMap).map(([name, arr]) => ({name, score:Math.round(arr.reduce((a,b)=>a+b,0)/arr.length)})).sort((a,b)=>a.score-b.score)
  return <section className="page-section"><PageTitle eyebrow="Progress" title="See what your mouth is learning." subtitle="Attempts are stored locally in this browser for a simple capstone demo."/><div className="metric-grid"><Metric title="Average accuracy" value={attempts.length ? `${average}%` : '—'} note={`${attempts.length} recorded attempts`}/><Metric title="Best attempt" value={attempts.length ? `${Math.max(...attempts.map(a=>a.score))}%` : '—'} note="Across all practice"/><Metric title="Sound categories" value={weak.length || '—'} note="Detected from scored attempts"/></div><div className="progress-grid"><div className="panel"><div className="panel-title"><h3>Accuracy trend</h3><span>recent → latest</span></div>{attempts.length ? <div className="sparkline">{attempts.slice(0,15).reverse().map((a,i)=><div className="spark-col" key={a.id}><div className={`spark-bar ${scoreClass(a.score)}`} style={{height:`${Math.max(12,a.score)}%`}}/><span>{a.score}</span></div>)}</div> : <Empty text="Complete your first practice attempt to build the trend."/>}</div><div className="panel"><div className="panel-title"><h3>Weakest sounds</h3><span>lower = needs practice</span></div>{weak.length ? <div className="weak-list">{weak.slice(0,6).map(x=><div className="weak-row" key={x.name}><span>{x.name}</span><b className={scoreClass(x.score)}>{x.score}%</b></div>)}</div> : <Empty text="No scored sounds yet."/>}</div></div><div className="panel attempts-table"><div className="panel-title"><h3>Recent attempts</h3><span>{attempts.length}</span></div>{attempts.slice(0,10).map(a=><div className="attempt-row" key={a.id}><span>{new Date(a.at).toLocaleString()}</span><b>{a.word}</b><span>{a.weak}</span><strong className={scoreClass(a.score)}>{a.score}%</strong></div>)}</div></section>
}
function Metric({title,value,note}) {return <div className="metric"><span>{title}</span><b>{value}</b><small>{note}</small></div>}
function PageTitle({eyebrow,title,subtitle}) {return <div className="page-title"><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{subtitle}</p></div>}
function Empty({text}) {return <div className="empty">{text}</div>}

export default App
