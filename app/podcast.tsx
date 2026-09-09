'use client';
import { useEffect, useRef, useState } from 'react';
import {
  Upload,
  Link,
  FileText,
  Headphones,
  Sparkles,
  LoaderCircle,
  Download,
  ArrowRight,
  Check,
  AudioLines,
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
type Discussion = {
  title: string;
  turns: { speaker: 'A' | 'B'; text: string }[];
};
const example =
  'Retrieval-augmented generation, often called RAG, gives an AI assistant useful information before it answers a question. The system first searches a collection of documents for relevant passages, then includes them in the prompt sent to a language model. This helps the assistant answer questions about company information that was not in its training data. A support assistant, for example, can retrieve the current returns policy before responding to a customer. RAG does not guarantee a correct answer. Search can select irrelevant passages, source documents may be out of date, and the model can misinterpret them. Good systems show sources and are tested with realistic questions. Access controls ensure users can only retrieve documents they are authorized to see. Keeping the source collection current and measuring answer quality are ongoing responsibilities.';
export default function Podcast({
  onBusyChange,
}: {
  onBusyChange: (busy: boolean) => void;
}) {
  const [article, setArticle] = useState('');
  const [url, setUrl] = useState('');
  const [source, setSource] = useState('');
  const [minutes, setMinutes] = useState('1');
  const [level, setLevel] = useState('everyday');
  const [discussion, setDiscussion] = useState<Discussion | null>(null);
  const [audio, setAudio] = useState('');
  const [previews, setPreviews] = useState<string[]>([]);
  const previewUrls = useRef<string[]>([]);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const [recordedTitle, setRecordedTitle] = useState('');
  const [recordedScript, setRecordedScript] = useState('');
  const [duration, setDuration] = useState(0);
  const file = useRef<HTMLInputElement>(null);
  const audioUrl = useRef('');
  useEffect(() => {
    onBusyChange(Boolean(busy));
    if (!busy) return;
    setElapsed(0);
    const timer = setInterval(() => setElapsed((n) => n + 1), 1000);
    const poll = setInterval(() => {
      fetch('/api/health')
        .then((r) => r.json())
        .then((d) => {
          const info = d as { phase?: string };
          if (info.phase && info.phase !== 'Ready') setStatus(info.phase);
        })
        .catch(() => {});
    }, 2000);
    return () => {
      clearInterval(timer);
      clearInterval(poll);
    };
  }, [busy, onBusyChange]);
  useEffect(
    () => () => {
      if (audioUrl.current) URL.revokeObjectURL(audioUrl.current);
      previewUrls.current.forEach((url) => URL.revokeObjectURL(url));
    },
    [],
  );
  async function jsonRequest(
    path: string,
    body: BodyInit,
    headers?: HeadersInit,
  ) {
    const r = await fetch(path, { method: 'POST', body, headers });
    const d = (await r.json()) as Discussion & {
      detail?: string;
      text?: string;
      title?: string;
    };
    if (!r.ok)
      throw Error(
        typeof d.detail === 'string'
          ? d.detail
          : 'Please check your input and try again.',
      );
    return d;
  }
  async function importArticle(selected?: File) {
    if (!selected) return;
    if (selected.size > 10 * 1024 * 1024) {
      setError('Choose a document smaller than 10 MB.');
      return;
    }
    setBusy('import');
    setError('');
    setStatus('Reading your article');
    try {
      const form = new FormData();
      form.append('file', selected);
      form.append('purpose', 'podcast');
      const d = await jsonRequest('/api/import', form);
      setArticle(d.text || '');
      setSource(selected.name);
    } catch (e) {
      setError(String((e as Error).message));
    } finally {
      setBusy('');
      if (file.current) file.current.value = '';
    }
  }
  async function importUrl() {
    setBusy('import');
    setError('');
    setStatus('Extracting the article');
    try {
      const d = await jsonRequest('/api/article', JSON.stringify({ url }), {
        'Content-Type': 'application/json',
      });
      setArticle(d.text || '');
      setSource(d.title || url);
    } catch (e) {
      setError(String((e as Error).message));
    } finally {
      setBusy('');
    }
  }
  async function write() {
    setBusy('write');
    setError('');
    setStatus('Writing a discussion on this Mac');
    try {
      const d = await jsonRequest(
        '/api/podcast/script',
        JSON.stringify({ article, minutes: Number(minutes), level }),
        { 'Content-Type': 'application/json' },
      );
      setDiscussion(d);
    } catch (e) {
      setError(String((e as Error).message));
    } finally {
      setBusy('');
    }
  }
  async function record() {
    if (!discussion) return;
    setBusy('record');
    setError('');
    setStatus('Preparing the two preset voices');
    previewUrls.current.forEach((url) => URL.revokeObjectURL(url));
    previewUrls.current = [];
    setPreviews([]);
    try {
      const r = await fetch('/api/podcast/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(discussion),
      });
      if (!r.ok) {
        const d = (await r.json()) as { detail?: string };
        throw Error(d.detail || 'Could not record the discussion.');
      }
      if (!r.body) throw Error('The recording stream is unavailable.');
      const reader = r.body.getReader();
      const decoder = new TextDecoder();
      let pending = '';
      let complete = false;
      const audioBlob = (encoded: string) => new Blob(
        [Uint8Array.from(atob(encoded), (char) => char.charCodeAt(0))],
        { type: 'audio/wav' },
      );
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          pending += decoder.decode(value, { stream: true });
          let newline;
          while ((newline = pending.indexOf('\n')) !== -1) {
            const event = JSON.parse(pending.slice(0, newline)) as {
              type: string; audio: string; detail?: string;
            };
            pending = pending.slice(newline + 1);
            if (event.type === 'error') throw Error(event.detail || 'Recording failed.');
            if (event.type === 'turn') {
              const url = URL.createObjectURL(audioBlob(event.audio));
              previewUrls.current.push(url);
              setPreviews([...previewUrls.current]);
            }
            if (event.type === 'complete') {
              if (audioUrl.current) URL.revokeObjectURL(audioUrl.current);
              audioUrl.current = URL.createObjectURL(audioBlob(event.audio));
              setAudio(audioUrl.current);
              complete = true;
            }
          }
        }
        if (!complete) throw Error('Recording was interrupted. Please try again.');
      } finally {
        await reader.cancel();
      }
      setRecordedTitle(discussion.title);
      setRecordedScript(
        discussion.title +
          '\n\n' +
          discussion.turns
            .map(
              (t) =>
                (t.speaker === 'A' ? 'Sophie' : 'Joe') +
                ': ' +
                t.text,
            )
            .join('\n\n'),
      );
    } catch (e) {
      setError(String((e as Error).message));
    } finally {
      setBusy('');
    }
  }
  const wordCount =
    discussion?.turns.reduce(
      (sum, t) => sum + t.text.trim().split(/\s+/).length,
      0,
    ) || 0;
  function downloadTranscript() {
    const u = URL.createObjectURL(
      new Blob([recordedScript], { type: 'text/plain' }),
    );
    const a = document.createElement('a');
    a.href = u;
    a.download = 'experis-podcast-transcript.txt';
    a.click();
    setTimeout(() => URL.revokeObjectURL(u), 1000);
  }
  return (
    <div className="podcast-workspace">
      <div className="podcast-intro">
        <div>
          <h2>A conversation worth listening to.</h2>
          <p>Bring an article. Review the script. Record the discussion.</p>
        </div>
        <span className="podcast-local">
          <Check size={14} /> Written & voiced locally
        </span>
      </div>
      <div className="podcast-grid">
        <section className="panel article-panel">
          <div className="panel-heading">
            <div>
              <span className="step">01</span>
              <h2>Bring the topic</h2>
            </div>
            <button
              className="text-button"
              disabled={!!busy}
              onClick={() => file.current?.click()}
            >
              <Upload size={15} /> Import document
            </button>
          </div>
          <input
            ref={file}
            type="file"
            className="sr-only"
            accept=".docx,.txt,.md,.pdf"
            onChange={(e) => void importArticle(e.target.files?.[0])}
          />
          <div className="article-body">
            <label htmlFor="article-url">Article URL</label>
            <div className="url-input">
              <Link size={16} />
              <input
                id="article-url"
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={!!busy}
                placeholder="https://example.com/article"
              />
              <button disabled={!!busy || !url.trim()} onClick={importUrl}>
                Import <ArrowRight size={14} />
              </button>
            </div>
            <div className="article-divider">
              <span>or paste the article below</span>
            </div>
            <label className="sr-only" htmlFor="article-text">
              Source article text
            </label>
            <textarea
              id="article-text"
              maxLength={24000}
              value={article}
              disabled={!!busy}
              onChange={(e) => {
                setArticle(e.target.value);
                setSource('Pasted article');
              }}
              placeholder="An interesting article. A new idea. Something worth understanding…"
            />
            <div className="article-meta">
              <span>{source || 'DOCX, PDF, TXT or Markdown'}</span>
              <span>{article.length.toLocaleString()} / 24,000</span>
            </div>
            <button
              className="sample-link"
              disabled={!!busy}
              onClick={() => {
                setArticle(example);
                setSource('Sample · Understanding RAG');
              }}
            >
              Try a sample topic <ArrowRight size={13} />
            </button>
          </div>
        </section>
        <aside className="panel podcast-settings">
          <div className="panel-heading">
            <div>
              <span className="step">02</span>
              <h2>Your hosts</h2>
            </div>
            <Headphones size={18} />
          </div>
          <div className="settings-body">
            <div className="host-profile">
              <span className="host-avatar female">A</span>
              <div>
                <strong>Sophie</strong>
                <small>Warm, curious · American English</small>
              </div>
            </div>
            <div className="host-profile">
              <span className="host-avatar male">B</span>
              <div>
                <strong>Joe</strong>
                <small>Calm, thoughtful · American English</small>
              </div>
            </div>
            <p className="host-note">
              A fixed voice pair, balanced volume, and natural pauses. No custom
              voices to configure.
            </p>
            <label id="explanation-level">Explanation level</label>
            <Select
              value={level}
              onValueChange={(v) => v && setLevel(v)}
              disabled={!!busy}
            >
              <SelectTrigger
                aria-labelledby="explanation-level"
                className="model-select"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="plain">Plain language</SelectItem>
                <SelectItem value="everyday">Standard</SelectItem>
                <SelectItem value="technical">Technical depth</SelectItem>
              </SelectContent>
            </Select>
            <p className="helper">
              {level === 'plain'
                ? 'Simple language, unfamiliar terms explained.'
                : level === 'everyday'
                  ? 'Clear explanations with useful context.'
                  : 'Keep the terminology and explore how it works.'}
            </p>
            <label id="episode-length">Discussion length</label>
            <Select
              value={minutes}
              onValueChange={(v) => v && setMinutes(v)}
              disabled={!!busy}
            >
              <SelectTrigger
                aria-labelledby="episode-length"
                className="model-select"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Quick listen · about 1 minute</SelectItem>
                <SelectItem value="2">Go deeper · about 2 minutes</SelectItem>
              </SelectContent>
            </Select>
            <p className="helper">
              Length is a guide. Review the discussion before recording it.
            </p>
            <div className="podcast-process">
              <span>
                <FileText size={14} /> Read the source
              </span>
              <span>
                <Sparkles size={14} /> Shape the discussion
              </span>
              <span>
                <AudioLines size={14} /> Record both voices
              </span>
            </div>
          </div>
        </aside>
      </div>
      <div className="generate-row">
        <div className="engine-status">
          <span className="status-dot" />
          <div>
            {busy
              ? `${status} · ${elapsed}s`
              : 'Your article stays on this Mac'}
            <small>
              {busy === 'record'
                ? 'Listen to completed turns below while the rest records.'
                : 'URL import contacts the source website; AI processing is local.'}
            </small>
          </div>
        </div>
        <button
          className="generate-button"
          disabled={!!busy || article.trim().length < 150}
          onClick={write}
        >
          {busy === 'write' ? (
            <LoaderCircle className="spin" size={18} />
          ) : (
            <Sparkles size={18} />
          )}{' '}
          {discussion ? 'Rewrite discussion' : 'Create discussion'}
          <ArrowRight size={16} />
        </button>
      </div>
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      {previews.length > 0 && (
        <section className="panel podcast-result">
          <div className="result-label"><Headphones size={17} /> FIRST LISTEN</div>
          <h2>{busy === 'record' ? 'Your conversation is taking shape' : 'Listen by turn'}</h2>
          <p>{previews.length} turns ready. Play any completed turn.</p>
          {previews.map((url, index) => (
            <div key={url}>
              <p>Turn {index + 1}</p>
              <audio controls src={url} aria-label={`Preview turn ${index + 1}`}
                onPlay={(e) => document.querySelectorAll('audio').forEach((a) => {
                  if (a !== e.currentTarget) a.pause();
                })} />
            </div>
          ))}
        </section>
      )}
      {discussion && (
        <section className="panel discussion-panel">
          <div className="panel-heading">
            <div>
              <span className="step">03</span>
              <h2>Review the conversation</h2>
            </div>
            <span className="transcript-count">
              {wordCount} words · ~{Math.max(1, Math.round(wordCount / 140))}{' '}
              min
            </span>
          </div>
          <div className="discussion-body">
            <label htmlFor="episode-title">Episode title</label>
            <input
              id="episode-title"
              className="episode-title"
              maxLength={200}
              value={discussion.title}
              disabled={!!busy}
              onChange={(e) =>
                setDiscussion({ ...discussion, title: e.target.value })
              }
            />
            <p className="review-note">
              Check the facts against your source. You can edit each turn before
              recording.
            </p>
            <div className="turns">
              {discussion.turns.map((turn, i) => (
                <div className="speaker-turn" key={i}>
                  <span
                    className={`host-avatar ${turn.speaker === 'A' ? 'female' : 'male'}`}
                  >
                    {turn.speaker}
                  </span>
                  <div>
                    <label htmlFor={`turn-${i}`}>
                      {turn.speaker === 'A' ? 'Sophie' : 'Joe'}
                    </label>
                    <textarea
                      id={`turn-${i}`}
                      disabled={!!busy}
                      maxLength={700}
                      value={turn.text}
                      onChange={(e) =>
                        setDiscussion({
                          ...discussion,
                          turns: discussion.turns.map((t, j) =>
                            j === i ? { ...t, text: e.target.value } : t,
                          ),
                        })
                      }
                    />
                  </div>
                </div>
              ))}
            </div>
            <button
              className="generate-button record-button"
              disabled={!!busy || discussion.turns.some((t) => !t.text.trim())}
              onClick={record}
            >
              {busy === 'record' ? (
                <LoaderCircle className="spin" size={18} />
              ) : (
                <Headphones size={18} />
              )}{' '}
              {busy === 'record' ? 'Recording your podcast…' : 'Record podcast'}
              <ArrowRight size={16} />
            </button>
          </div>
        </section>
      )}
      {audio && (
        <section className="panel podcast-result">
          <div className="result-label">
            <Headphones size={17} /> YOUR PODCAST
          </div>
          <h2>{recordedTitle}</h2>
          <p>
            {duration
              ? `${Math.floor(duration / 60)}:${String(Math.round(duration % 60)).padStart(2, '0')} · `
              : ''}
            Two preset voices · Chatterbox Turbo
          </p>
          <audio
            controls
            src={audio}
            onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
            onPlay={(e) =>
              document.querySelectorAll('audio').forEach((a) => {
                if (a !== e.currentTarget) a.pause();
              })
            }
          />
          <div className="podcast-downloads">
            <a className="download" href={audio} download="experis-podcast.wav">
              <Download size={15} /> Download podcast
            </a>
            <button className="download" onClick={downloadTranscript}>
              <FileText size={15} /> Download transcript
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
