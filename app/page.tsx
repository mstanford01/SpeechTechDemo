import {
  ArrowUpRight,
  ArrowRight,
  AudioLines,
  FileText,
  Headphones,
  Keyboard,
  ShieldCheck,
  Video,
} from 'lucide-react';
export default function Home() {
  return (
    <div className="home-shell">
      <header className="home-header">
        <a href="/" aria-label="Experis Voice Studio home">
          <img src="/experis-logo.svg" width="123" height="40" alt="Experis" />
        </a>
        <span className="home-header-label">VOICE STUDIO</span>
        <span className="home-local">
          <i /> Running on your Mac
        </span>
      </header>
      <main className="home-main">
        <section className="home-intro">
          <div className="home-kicker">
            <span /> THE VOICE STUDIO
          </div>
          <h1>
            Listen. Read.
            <br />
            <span>Create.</span>
          </h1>
          <div className="home-description">
            <p>
              Text, documents, videos and audio recordings.
              <br />
              Choose where to begin.
            </p>
            <div className="home-sound" aria-hidden="true">
              {Array.from({ length: 45 }, (_, i) => (
                <i
                  key={i}
                  style={{
                    height: `${10 + Math.abs(Math.sin(i * 0.58) * Math.cos(i * 0.12)) * 72}px`,
                  }}
                />
              ))}
            </div>
          </div>
        </section>
        <section className="module-grid" aria-label="Choose a studio tool">
          <a href="/speak/" className="module-card module-text">
            <div className="module-top">
              <span className="module-number">01 / WRITE</span>
              <ArrowUpRight size={24} />
            </div>
            <div className="module-art">
              <Keyboard size={62} strokeWidth={1.1} />
              <span className="type-cursor" aria-hidden="true" />
            </div>
            <h2>Text to speech</h2>
            <p>
              Type it. Pick a voice. Hear it.
              <br />A simple place to start.
            </p>
            <span className="module-cta">
              Open the editor <ArrowRight size={17} />
            </span>
          </a>
          <a href="/documents/" className="module-card module-document">
            <div className="module-top">
              <span className="module-number">02 / UPLOAD</span>
              <ArrowUpRight size={24} />
            </div>
            <div className="module-art">
              <FileText size={62} strokeWidth={1.1} />
              <span className="format-tags">
                DOCX <b>·</b> PDF <b>·</b> TXT
              </span>
            </div>
            <h2>Document to audio</h2>
            <p>
              Give a document a voice.
              <br />
              Listen to what’s on the page.
            </p>
            <span className="module-cta">
              Bring a document <ArrowRight size={17} />
            </span>
          </a>
          <a href="/podcast/" className="module-card module-podcast">
            <div className="module-top">
              <span className="module-number">03 / DISCUSS</span>
              <ArrowUpRight size={24} />
            </div>
            <div className="module-art">
              <Headphones size={62} strokeWidth={1.1} />
              <div className="speaker-pair">
                <span>A</span>
                <span>B</span>
              </div>
            </div>
            <h2>Article to podcast</h2>
            <p>
              One article. Two voices.
              <br />A discussion you can take with you.
            </p>
            <span className="module-cta">
              Make a podcast <ArrowRight size={17} />
            </span>
          </a>
          <a href="/transcribe/" className="module-card module-video">
            <div className="module-top"><span className="module-number">04 / TRANSCRIBE</span><ArrowUpRight size={24} /></div>
            <div className="module-art"><Video size={62} strokeWidth={1.1} /></div>
            <h2>Transcribe & summarize</h2>
            <p>Audio, YouTube videos and articles.<br />Get the words. Get the key ideas.</p>
            <span className="module-cta">Get the transcript <ArrowRight size={17} /></span>
          </a>
        </section>
        <div className="home-footnote">
          <span>
            <ShieldCheck size={16} /> Preset voices. Local processing. Your
            content stays here.
          </span>
          <span>POWERED BY CHATTERBOX</span>
        </div>
        <footer className="home-footer">
          <span>
            Experis Voice Studio <b>/</b> Customer demo
          </span>
          <a href="/credits.txt" target="_blank" rel="noreferrer">
            About the voices <ArrowUpRight size={13} />
          </a>
        </footer>
      </main>
    </div>
  );
}
