'use client';
import { useEffect, useRef, useState } from 'react';
import {
  AudioLines,
  ArrowUpRight,
  Upload,
  FileText,
  Sparkles,
  Download,
  Headphones,
  SlidersHorizontal,
  LoaderCircle,
  RotateCcw,
  Check,
  X,
  Mic,
} from 'lucide-react';
import Podcast from './podcast';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
const samples = {
  'Brand story':
    'Welcome to Experis. Today, we are trying a different way to share ideas. A short script becomes a voice. An article becomes a conversation. Take a listen, and see where it could fit into your day.',
  'Customer support':
    'Hello, thanks for reaching out. I have found your order, and everything is on track. Your delivery arrives tomorrow. Is there anything else I can help you with?',
  Narration:
    'The city was still asleep when the first light reached the water. For a moment, everything was quiet. Then, somewhere in the distance, a new day began.',
};
export default function Studio({
  mode = 'speech',
}: {
  mode?: 'speech' | 'documents' | 'podcast';
}) {
  const documentMode = mode === 'documents';
  const [podcastBusy, setPodcastBusy] = useState(false);
  const [voice, setVoice] = useState('default');
  const [text, setText] = useState(documentMode ? '' : samples['Brand story']);
  const [model, setModel] = useState('turbo');
  const [expression, setExpression] = useState(0.5);
  const [pace, setPace] = useState(0.5);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('Connecting to your speech engine…');
  const [online, setOnline] = useState(false);
  const [error, setError] = useState('');
  const [fileName, setFileName] = useState('');
  const [audio, setAudio] = useState('');
  const [duration, setDuration] = useState(0);
  const [peaks, setPeaks] = useState<number[]>([]);
  const [resultModel, setResultModel] = useState('');
  const [resultVoice, setResultVoice] = useState('');
  const [playing, setPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [importing, setImporting] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const player = useRef<HTMLAudioElement>(null);
  const oldAudio = useRef('');
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  useEffect(() => {
    let live = true;
    async function check() {
      try {
        const r = await fetch('/api/health');
        if (!r.ok) throw Error();
        const d = (await r.json()) as {
          loaded?: boolean;
          busy?: boolean;
          phase?: string;
          detail?: string;
          text?: string;
        };
        if (live) {
          setOnline(true);
          setStatus(
            d.busy
              ? d.phase || 'Generating speech'
              : d.loaded
                ? 'Speech engine ready'
                : 'Ready · model loads on first generation',
          );
        }
      } catch {
        if (live) {
          setOnline(false);
          if (!busy)
            setStatus('Speech engine offline · launch the studio to connect');
        }
      }
    }
    check();
    const id = setInterval(check, 10000);
    return () => {
      live = false;
      clearInterval(id);
    };
  }, [busy]);
  useEffect(
    () => () => {
      if (oldAudio.current) URL.revokeObjectURL(oldAudio.current);
    },
    [],
  );
  useEffect(() => {
    if (!busy) return;
    setElapsed(0);
    const id = setInterval(() => setElapsed((v) => v + 1), 1000);
    return () => clearInterval(id);
  }, [busy]);
  useEffect(() => {
    const context = (
      document as Document & {
        modelContext?: {
          registerTool: (tool: unknown, options: unknown) => void;
        };
      }
    ).modelContext;
    if (!context) return;
    const lifecycle = new AbortController();
    try {
      context.registerTool(
        {
          name: 'set_speech_script',
          description:
            'Replace the visible speech script. Does not generate audio.',
          inputSchema: {
            type: 'object',
            properties: {
              text: { type: 'string', minLength: 1, maxLength: 5000 },
            },
            required: ['text'],
            additionalProperties: false,
          },
          execute: (input: unknown) => {
            const value = input as { text?: unknown };
            if (busy) throw Error('Generation is in progress.');
            if (
              typeof value.text !== 'string' ||
              !value.text.trim() ||
              value.text.length > 5000
            )
              throw Error('Enter 1–5,000 characters.');
            setText(value.text);
            setFileName('');
            return { status: 'script_updated', characters: value.text.length };
          },
        },
        { signal: lifecycle.signal },
      );
    } catch {
      /* Optional browser capability. */
    }
    return () => lifecycle.abort();
  }, [busy]);
  async function importFile(file?: File) {
    if (!file) return;
    setError('');
    if (file.size > 10 * 1024 * 1024) {
      setError('Please choose a document smaller than 10 MB.');
      return;
    }
    setImporting(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const r = await fetch('/api/import', { method: 'POST', body: form });
      const d = (await r.json()) as {
        loaded?: boolean;
        busy?: boolean;
        phase?: string;
        detail?: string;
        text?: string;
      };
      if (!r.ok) throw Error(d.detail || 'Unable to read this file.');
      setText(d.text || '');
      setFileName(file.name);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed.');
    } finally {
      setImporting(false);
      if (input.current) input.current.value = '';
    }
  }
  async function generate() {
    if (busy || !text.trim()) return;
    setBusy(true);
    setError('');
    setStatus('Creating your audio · first use includes model loading');
    try {
      const form = new FormData();
      form.append('text', text);
      form.append('model', model);
      form.append('voice', voice);
      form.append('exaggeration', String(expression));
      form.append('cfg_weight', String(pace));
      const r = await fetch('/api/generate', { method: 'POST', body: form });
      if (!r.ok) {
        const d = (await r.json()) as {
          loaded?: boolean;
          busy?: boolean;
          phase?: string;
          detail?: string;
          text?: string;
        };
        throw Error(d.detail || 'Speech generation failed.');
      }
      const blob = await r.blob();
      if (oldAudio.current) URL.revokeObjectURL(oldAudio.current);
      const url = URL.createObjectURL(blob);
      oldAudio.current = url;
      setAudio(url);
      setPlaying(false);
      setResultModel(
        model === 'turbo' ? 'Chatterbox Turbo' : 'Chatterbox Original',
      );
      setResultVoice(
        voice === 'default'
          ? 'Model default'
          : voice === 'female'
            ? 'Female preset'
            : 'Male preset',
      );
      setPeaks([]);
      try {
        const ctx = new AudioContext();
        try {
          const decoded = await ctx.decodeAudioData(await blob.arrayBuffer());
          const data = decoded.getChannelData(0);
          const size = Math.max(1, Math.floor(data.length / 100));
          const values = Array.from({ length: 100 }, (_, i) => {
            let peak = 0;
            for (
              let j = i * size;
              j < Math.min(data.length, (i + 1) * size);
              j++
            )
              peak = Math.max(peak, Math.abs(data[j]));
            return peak;
          });
          const max = Math.max(0.01, ...values);
          setPeaks(values.map((v) => v / max));
        } finally {
          await ctx.close();
        }
      } catch {
        /* Native audio remains available if waveform decoding is unsupported. */
      }
      setStatus('Your audio is ready');
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Could not reach the speech engine.',
      );
      setStatus('Ready to try again');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="studio-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Experis Speech Studio home">
          <img src="/experis-logo.svg" alt="Experis" width="123" height="40" />
          <span className="brand-divider" />{' '}
          <span className="studio-label">VOICE STUDIO</span>
        </a>
        <div className="top-right">
          <span className="local-pill">
            <i /> Local demo · no sign-in
          </span>
          <a className="module-home-link" href="/">
            All tools <ArrowUpRight size={14} />
          </a>
        </div>
      </header>
      <main>
        <div className="page-heading">
          <div>
            <div className="eyebrow">
              <span /> EXPERIS VOICE STUDIO
            </div>
            <h1>
              {mode === 'podcast'
                ? 'Article to podcast'
                : documentMode
                  ? 'Document to audio'
                  : 'Text to speech'}
              <span>.</span>
            </h1>
            <p>
              {mode === 'podcast'
                ? 'Turn a useful read into a two-person discussion.'
                : documentMode
                  ? 'Upload a document, check the text, and choose a voice.'
                  : 'Write a script, choose a voice, and press play.'}
            </p>
          </div>
          <div className="engine-mark">
            <AudioLines size={20} />
            <div>
              Powered by Chatterbox
              <small>Open-source speech by Resemble AI</small>
            </div>
          </div>
        </div>
        {mode !== 'podcast' ? (
          <>
            <div className="workspace">
              <section className="editor panel">
                <div className="panel-heading">
                  <div>
                    <span className="step">01</span>
                    <h2>{documentMode ? 'Your document' : 'Your script'}</h2>
                  </div>
                  {documentMode && (
                    <button
                      className="text-button"
                      disabled={busy || importing}
                      onClick={() => input.current?.click()}
                    >
                      <Upload size={16} />
                      {importing ? 'Reading file…' : 'Import file'}
                    </button>
                  )}
                </div>
                <div className="editor-toolbar">
                  <span>
                    <FileText size={15} />
                    {fileName || 'Untitled script'}
                  </span>
                  <span>English</span>
                </div>
                <label className="sr-only" htmlFor="script">
                  Text to convert to speech
                </label>
                <textarea
                  id="script"
                  value={text}
                  disabled={busy || importing}
                  maxLength={5000}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Enter the words you want to hear."
                />
                <div className="editor-meta">
                  <span>
                    {words} words <b>·</b> ~
                    {Math.max(1, Math.ceil((words / 150) * 60))} sec of speech
                  </span>
                  <span>{text.length.toLocaleString()} / 5,000</span>
                </div>
                {documentMode && (
                  <div
                    className="upload-strip"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (!busy && !importing)
                        void importFile(e.dataTransfer.files[0]);
                    }}
                  >
                    <Upload size={19} />
                    <div>
                      <button
                        disabled={busy || importing}
                        onClick={() => input.current?.click()}
                      >
                        Drop a document here, or browse files
                      </button>
                      <small>TXT, Markdown, PDF or DOCX · up to 10 MB</small>
                    </div>
                  </div>
                )}
                <input
                  ref={input}
                  type="file"
                  className="sr-only"
                  accept=".txt,.md,.pdf,.docx"
                  onChange={(e) => void importFile(e.target.files?.[0])}
                />
                {!documentMode && (
                  <div className="samples">
                    <span>NEED A STARTING POINT?</span>
                    <div>
                      {Object.entries(samples).map(([name, value]) => (
                        <button
                          key={name}
                          disabled={busy}
                          onClick={() => {
                            setText(value);
                            setFileName('');
                          }}
                        >
                          {name}
                          <ArrowUpRight size={13} />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </section>
              <aside className="settings panel">
                <div className="panel-heading">
                  <div>
                    <span className="step">02</span>
                    <h2>Voice & delivery</h2>
                  </div>
                  <SlidersHorizontal size={18} />
                </div>
                <div className="settings-body">
                  <label id="model-label">Speech model</label>
                  <Select
                    value={model}
                    onValueChange={(v) => v && setModel(v)}
                    disabled={busy}
                  >
                    <SelectTrigger
                      aria-labelledby="model-label"
                      className="model-select"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="standard">
                        Chatterbox Original
                      </SelectItem>
                      <SelectItem value="turbo">Chatterbox Turbo</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="helper">
                    {model === 'standard'
                      ? 'Expressive, natural speech with fine control.'
                      : 'Faster English speech with built-in expression tags.'}
                  </p>
                  <label id="voice-label">Preset voice</label>
                  <Select
                    value={voice}
                    onValueChange={(v) => v && setVoice(v)}
                    disabled={busy}
                  >
                    <SelectTrigger
                      aria-labelledby="voice-label"
                      className="model-select"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default">Model default</SelectItem>
                      <SelectItem value="female">
                        Female · clear & calm
                      </SelectItem>
                      <SelectItem value="male">
                        Male · warm & relaxed
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="helper">Fixed voices, ready to use.</p>
                  <div className="control">
                    <div>
                      <label id="expression-label">Expression</label>
                      <span>{expression.toFixed(2)}</span>
                    </div>
                    <Slider
                      aria-labelledby="expression-label"
                      value={[expression]}
                      min={0.25}
                      max={1.5}
                      step={0.05}
                      disabled={busy || model === 'turbo'}
                      onValueChange={(v) =>
                        setExpression(Array.isArray(v) ? v[0] : v)
                      }
                    />
                    <div className="range-labels">
                      <span>Subtle</span>
                      <span>Expressive</span>
                    </div>
                  </div>
                  <div className="control">
                    <div>
                      <label id="pace-label">Pacing guidance</label>
                      <span>{pace.toFixed(2)}</span>
                    </div>
                    <Slider
                      aria-labelledby="pace-label"
                      value={[pace]}
                      min={0}
                      max={1}
                      step={0.05}
                      disabled={busy || model === 'turbo'}
                      onValueChange={(v) =>
                        setPace(Array.isArray(v) ? v[0] : v)
                      }
                    />
                    <div className="range-labels">
                      <span>More free</span>
                      <span>More guided</span>
                    </div>
                  </div>
                  <p className="model-note">
                    {model === 'turbo'
                      ? 'Turbo uses its native delivery. Add [laugh] or [chuckle] to your script.'
                      : 'Start at 0.50 for a natural delivery. Small changes can make a big difference.'}
                  </p>
                  <button
                    className="reset"
                    disabled={busy}
                    onClick={() => {
                      setExpression(0.5);
                      setPace(0.5);
                    }}
                  >
                    <RotateCcw size={13} /> Reset controls
                  </button>
                </div>
              </aside>
            </div>
            <div className="generate-row">
              <div className="engine-status" role="status">
                <span
                  className={online ? 'status-dot' : 'status-dot offline'}
                />
                <div>
                  {busy ? `${status} · ${elapsed}s` : status}
                  <small>Your script and audio stay on this Mac.</small>
                </div>
              </div>
              <button
                className="generate-button"
                disabled={busy || importing || !online || !text.trim()}
                onClick={generate}
              >
                {busy ? (
                  <LoaderCircle className="spin" size={20} />
                ) : (
                  <Sparkles size={20} />
                )}{' '}
                {busy ? 'Generating speech…' : 'Generate speech'}
                {!busy && <span>↗</span>}
              </button>
            </div>
            {error && (
              <div className="error" role="alert">
                <span>{error}</span>
                <button aria-label="Dismiss error" onClick={() => setError('')}>
                  <X size={16} />
                </button>
              </div>
            )}
            <section className={`output panel ${audio ? 'has-audio' : ''}`}>
              <div className="output-title">
                <span className="step">03</span>
                <h2>Hear the difference</h2>
                <span className="output-format">WAV · 24 kHz</span>
              </div>
              {audio ? (
                <div className="audio-result">
                  <div className="audio-result-head">
                    <div>
                      <strong>Generated speech</strong>
                      <p>
                        {duration ? `${duration.toFixed(1)} seconds · ` : ''}
                        {resultModel} · {resultVoice}
                      </p>
                    </div>
                    <a
                      className="download"
                      href={audio}
                      download="experis-speech.wav"
                    >
                      <Download size={16} /> Download WAV
                    </a>
                  </div>
                  <div
                    className={`waveform ${playing ? 'active' : ''}`}
                    aria-hidden="true"
                  >
                    {peaks.map((v, i) => (
                      <i key={i} style={{ height: `${3 + v * 70}px` }} />
                    ))}
                  </div>
                  <audio
                    ref={player}
                    controls
                    src={audio}
                    onPlay={(e) => {
                      setPlaying(true);
                      document.querySelectorAll('audio').forEach((a) => {
                        if (a !== e.currentTarget) a.pause();
                      });
                    }}
                    onPause={() => setPlaying(false)}
                    onEnded={() => setPlaying(false)}
                    onLoadedMetadata={() =>
                      setDuration(player.current?.duration || 0)
                    }
                  />
                </div>
              ) : (
                <div className="output-empty">
                  <span className="headphones">
                    <Headphones size={27} />
                  </span>
                  <div>
                    <h3>
                      {busy ? 'Recording your script.' : 'Ready when you are.'}
                    </h3>
                    <p>
                      {busy
                        ? 'Chatterbox is turning your script into speech.'
                        : 'Try this real example, then create your own.'}
                    </p>
                    {!busy && (
                      <div className="demo-listen">
                        <audio
                          controls
                          preload="metadata"
                          src="/demo/chatterbox-turbo.wav"
                          aria-label="Pre-generated Chatterbox Turbo example"
                        />
                        <small>
                          Example · Chatterbox Turbo · generated on this Mac
                        </small>
                      </div>
                    )}
                  </div>
                  <div
                    className={`mini-wave ${busy ? 'playing' : ''}`}
                    aria-hidden="true"
                  >
                    {Array.from({ length: 29 }, (_, i) => (
                      <i
                        key={i}
                        style={{
                          height: `${8 + Math.abs(Math.sin(i * 0.7)) * 36}px`,
                          animationDelay: `${i * -0.09}s`,
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </section>
          </>
        ) : (
          <Podcast onBusyChange={setPodcastBusy} />
        )}
        <footer>
          <span>
            <span className="footer-dot" /> Experis demo · Local access ·
            Microsoft sign-in not configured
          </span>
          <a
            href="https://github.com/resemble-ai/chatterbox"
            target="_blank"
            rel="noreferrer"
          >
            Chatterbox · MIT licensed <ArrowUpRight size={13} />
          </a>
          <a href="/credits.txt" target="_blank" rel="noreferrer">
            Voice presets & credits <ArrowUpRight size={13} />
          </a>
        </footer>
      </main>
    </div>
  );
}
