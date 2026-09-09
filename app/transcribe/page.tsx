'use client';
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Download, Headphones, LoaderCircle, Video, Upload, FileText } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import StudioBreadcrumbs from '@/components/studio-breadcrumbs';

type Transcript = { title: string; url: string; text: string; language: string; duration: number; captions_used: boolean };
type Summary = { text: string; paragraphs: number; level: string };
const levelNames: Record<string, string> = { everyday: 'Standard', plain: 'Plain language', technical: 'Technical depth' };
export default function Transcribe() {
  const [source, setSource] = useState('youtube');
  const [url, setUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<Transcript | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState('');
  const [level, setLevel] = useState('everyday');
  const [paragraphs, setParagraphs] = useState('5');
  const [summary, setSummary] = useState<Summary | null>(null);
  const [resultSource, setResultSource] = useState('');
  const [articleUrl, setArticleUrl] = useState('');
  const [summaryArticle, setSummaryArticle] = useState<{ text: string; title: string; url: string } | null>(null);
  const summaryText = source === 'url' ? summaryArticle?.text || '' : text;
  const summaryTitle = source === 'url' ? summaryArticle?.title || 'Article summary' : result?.title || 'Recording summary';
  const summaryUrl = source === 'url' ? summaryArticle?.url || '' : result?.url || '';
  const fileInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!busy) return;
    setElapsed(0);
    const timer = setInterval(() => setElapsed((n) => n + 1), 1000);
    return () => clearInterval(timer);
  }, [busy]);
  async function transcribe() {
    setBusy('transcribe'); setError('');
    try {
      let body: BodyInit; let headers: HeadersInit | undefined;
      if (source === 'youtube') { body = JSON.stringify({ url }); headers = { 'Content-Type': 'application/json' }; }
      else { if (!file) throw Error('Choose an audio file.'); const form = new FormData(); form.append('file', file); body = form; }
      const response = await fetch(source === 'youtube' ? '/api/youtube' : '/api/transcribe/upload', { method: 'POST', headers, body });
      const data = await response.json() as Transcript & { detail?: string };
      if (!response.ok) throw Error(data.detail || 'Could not transcribe this recording.');
      setResult(data); setText(data.text); setSummary(null); setResultSource(source);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(''); }
  }
  async function summarize() {
    setBusy(source === 'url' && !summaryArticle ? 'article' : 'summary'); setError('');
    try {
      let sourceText = summaryText;
      if (source === 'url' && !summaryArticle) {
        const articleResponse = await fetch('/api/article', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: articleUrl }) });
        const article = await articleResponse.json() as { text: string; title: string; detail?: string };
        if (!articleResponse.ok) throw Error(article.detail || 'Could not read this article.');
        setSummaryArticle({ ...article, url: articleUrl });
        sourceText = article.text;
      }
      setBusy('summary');
      const response = await fetch('/api/transcribe/summary', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: sourceText, level, paragraphs: Number(paragraphs) }) });
      const data = await response.json() as Summary & { detail?: string };
      if (!response.ok) throw Error(data.detail || 'Could not create the summary.');
      setSummary(data);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(''); }
  }
  function download(content: string, kind: string, title = result?.title || '', sourceUrl = result?.url || '') {
    const blob = new Blob([`${title}\n${sourceUrl}\n\n${content}`], { type: 'text/plain;charset=utf-8' });
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = objectUrl; link.download = `experis-${kind}.txt`; link.click();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  }
  function podcast(content: string, title = result?.title) {
    try {
      sessionStorage.setItem('experis-podcast-source', JSON.stringify({ text: content, title }));
      window.location.assign('/podcast/');
    } catch { setError('Could not transfer the text. Download it and import it in the podcast module.'); }
  }
  return <div className="transcription-shell">
    <header className="home-header">
      <a href="/" aria-label="Experis Voice Studio home"><img src="/experis-logo.svg" width="123" height="40" alt="Experis" /></a>
      <span className="home-header-label">VOICE STUDIO</span>
      <a href="/" className="transcription-home"><ArrowLeft size={16} /> Back to home</a>
    </header>
    <main className="transcription-main">
      <StudioBreadcrumbs current="Transcribe & summarize" />
      <div className="transcription-intro"><span className="transcription-icon"><Headphones size={30} /></span><div><h1>Transcribe & summarize</h1><p>Get the words from a recording. Get the key ideas from a recording or article.</p></div></div>
      <section className="panel"><div className="article-body">
        <label id="transcription-source">Start with</label>
        <Select value={source} onValueChange={(v) => { if (v) { setSource(v); setSummary(null); setError(''); } }} disabled={!!busy}>
          <SelectTrigger aria-labelledby="transcription-source" className="model-select"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="youtube">YouTube video</SelectItem><SelectItem value="file">Audio file</SelectItem><SelectItem value="url">Article URL</SelectItem></SelectContent>
        </Select>
        {source === 'url' ? <div className="transcription-source-body">
          <label htmlFor="summary-article-url">Article URL</label>
          <form id="article-summary-form" className="url-input" onSubmit={(e) => { e.preventDefault(); void summarize(); }}>
            <input id="summary-article-url" type="url" required disabled={!!busy} value={articleUrl} onChange={(e) => { setArticleUrl(e.target.value); setSummaryArticle(null); setSummary(null); }} placeholder="https://example.com/article" />
          </form>
          <p className="helper">Paste an article link, choose your summary options below, and select Create summary.</p>
        </div> : source === 'youtube' ? <div className="transcription-source-body">
          <label htmlFor="youtube-url">YouTube video URL</label>
          <form className="url-input" onSubmit={(e) => { e.preventDefault(); void transcribe(); }}>
            <Video size={20} /><input id="youtube-url" type="url" required value={url} disabled={!!busy} onChange={(e) => setUrl(e.target.value)} placeholder="https://www.youtube.com/watch?v=…" />
            <button type="submit" disabled={!!busy || !url.trim()}>{busy === 'transcribe' ? <LoaderCircle className="spin" size={16} /> : <ArrowRight size={16} />} Get transcript</button>
          </form>
          <p className="helper">Public videos up to two hours. Transcribed from the audio on this Mac, without using captions.</p>
          <button className="sample-link" disabled={!!busy} onClick={() => setUrl('https://www.youtube.com/watch?v=mdX3vls-ltg')}>Try the Experis brand video <ArrowRight size={13} /></button>
        </div> : <div className="transcription-source-body">
          <input ref={fileInput} type="file" accept=".mp3,.wav,.m4a,.aac,.flac,.ogg,.webm,.mp4" className="sr-only" onChange={(e) => {
            const selected = e.target.files?.[0];
            if (selected && selected.size > 250 * 1024 * 1024) { setError('Choose a file smaller than 250 MB.'); e.target.value = ''; setFile(null); return; }
            setFile(selected || null); setError('');
          }} />
          <button className="transcription-upload" disabled={!!busy} onClick={() => fileInput.current?.click()}><Upload size={24} /><span>{file?.name || 'Choose an audio file'}<small>MP3, WAV, M4A, AAC, FLAC, OGG, WebM or MP4</small></span></button>
          <p className="helper">Up to 250 MB and two hours. Audio is used for transcription only.</p>
          <button className="generate-button" disabled={!!busy || !file} onClick={transcribe}><FileText size={17} /> Get transcript</button>
        </div>}
      </div></section>
      {busy && <div className="transcription-progress" role="status"><LoaderCircle className="spin" size={20} /><div>{busy === 'summary' ? 'Writing your summary' : busy === 'article' ? 'Reading the article' : 'Preparing audio and transcribing'} · {elapsed}s<small>Processing locally. Longer recordings take more time. Keep this page open.</small></div></div>}
      {error && <div className="error" role="alert">{error}</div>}
      {result && resultSource === source && <section className="panel transcription-result">
          <div className="panel-heading"><div><span className="step">FULL TRANSCRIPT</span><h2>{result.title}</h2></div></div>
          <div className="article-body">
            <p className="helper">{Math.floor(result.duration / 60)}:{String(Math.floor(result.duration % 60)).padStart(2, '0')} recording · {result.language.toUpperCase()} · Transcribed from audio</p>
            <label htmlFor="video-transcript">Review and edit the text</label>
            <textarea id="video-transcript" value={text} disabled={!!busy} onChange={(e) => { setText(e.target.value); setSummary(null); }} />
            <p className="helper">Check names, acronyms and numbers against the recording before sharing.</p>
            <div className="transcription-actions">
              <button className="generate-button" onClick={() => download(text, 'transcript')} disabled={!!busy || !text.trim()}><Download size={17} /> Download transcript</button>
              <button className="text-button" onClick={() => podcast(text)} disabled={!!busy || text.trim().length < 150 || text.length > 24000}><Headphones size={17} /> Create a podcast <ArrowRight size={16} /></button>
            </div>
            {text.length > 24000 && <p className="helper">This transcript is long. Create a summary below to use in a podcast, or select an excerpt of up to 24,000 characters.</p>}
          </div>
        </section>}
        {(source === 'url' || (result && resultSource === source)) && <section className="panel transcription-result">
          <div className="panel-heading"><div><span className="step">SUMMARY</span><h2>The detail you need</h2></div></div>
          <div className="article-body">
            {source === 'url' && summaryArticle && <><p className="helper">{summaryArticle.title}</p><label htmlFor="summary-article-text">Review the source text</label><textarea id="summary-article-text" disabled={!!busy} value={summaryArticle.text} onChange={(e) => { setSummaryArticle({ ...summaryArticle, text: e.target.value }); setSummary(null); }} /></>}
            <div className="transcription-summary-controls">
              <div><label id="summary-level">Explanation level</label><Select value={level} onValueChange={(v) => v && setLevel(v)} disabled={!!busy}><SelectTrigger aria-labelledby="summary-level" className="model-select"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="plain">Plain language</SelectItem><SelectItem value="everyday">Standard</SelectItem><SelectItem value="technical">Technical depth</SelectItem></SelectContent></Select></div>
              <div><label id="summary-length">Summary length</label><Select value={paragraphs} onValueChange={(v) => v && setParagraphs(v)} disabled={!!busy}><SelectTrigger aria-labelledby="summary-length" className="model-select"><SelectValue /></SelectTrigger><SelectContent>{['1','3','5','8'].map((n) => <SelectItem key={n} value={n}>{n} {n === '1' ? 'paragraph' : 'paragraphs'}</SelectItem>)}</SelectContent></Select></div>
            </div>
            <p className="helper">{level === 'plain' ? 'Simple language, unfamiliar terms explained.' : level === 'technical' ? 'Keep the terminology and technical detail present in the source.' : 'Clear explanations with useful context.'} {source === 'url' ? 'Summarize the article without recording audio.' : 'Your full transcript stays above.'}</p>
            <button className="generate-button" type={source === 'url' ? 'submit' : 'button'} form={source === 'url' ? 'article-summary-form' : undefined} disabled={!!busy || (source === 'url' && !summaryArticle ? !articleUrl.trim() : summaryText.trim().length < 80 || summaryText.length > 200000)} onClick={source === 'url' ? undefined : summarize}>{busy === 'summary' ? <LoaderCircle className="spin" size={17} /> : <FileText size={17} />}{summary ? 'Rewrite summary' : 'Create summary'}</button>
            {summary && <div className="transcription-summary-output"><p className="helper">{levelNames[summary.level]} · {summary.paragraphs} {summary.paragraphs === 1 ? 'paragraph' : 'paragraphs'}</p>{summary.text.split(/\n\n+/).map((p,i) => <p key={i}>{p}</p>)}<div className="transcription-actions"><button className="download" disabled={!!busy} onClick={() => download(summary.text, 'summary', summaryTitle, summaryUrl)}><Download size={16} /> Download summary</button><button className="text-button" disabled={!!busy || summary.text.length < 150 || summary.text.length > 24000} onClick={() => podcast(summary.text, summaryTitle)}><Headphones size={16} /> Make this a podcast</button></div></div>}
          </div>
        </section>}
    </main>
  </div>;
}
