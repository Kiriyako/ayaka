"use client";

import { useState, useRef, useEffect } from "react";
import "./page.css";

export default function Home() {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [song, setSong] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);

  const debounceRef = useRef(null);
  const wrapRef = useRef(null);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (query.trim().length < 2) { setSuggestions([]); setShowSuggestions(false); return; }
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch("/api/lyrics", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "search", query }),
        });
        const data = await res.json();
        if (data.success && data.results?.length) {
          setSuggestions(data.results.slice(0, 6));
          setShowSuggestions(true);
        } else {
          setSuggestions([]); setShowSuggestions(false);
        }
      } catch (_) {}
    }, 400);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  useEffect(() => {
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setShowSuggestions(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const fetchSong = async (title, artist) => {
    setLoading(true);
    setError(null);
    setSong(null);
    setImgLoaded(false);
    setShowSuggestions(false);
    try {
      const res = await fetch("/api/lyrics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "getSong", title, artist }),
      });
      const data = await res.json();
      if (data.success) setSong(data.song);
      else setError(data.error || "Song not found.");
    } catch (_) { setError("Something went wrong."); }
    setLoading(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const parts = query.split(" - ");
    fetchSong(parts[0]?.trim() || query, parts[1]?.trim() || "");
  };

  const handleSuggestionClick = (s) => {
    setQuery(s.title);
    setShowSuggestions(false);
    fetchSong(s.songTitle || s.title, s.artist || "");
  };

  const copyLyrics = () => {
    if (!song?.lyrics) return;
    navigator.clipboard.writeText(song.lyrics);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatLyrics = (raw) => {
    if (!raw) return null;
    return raw.split("\n").map((line, i) => {
      const isSection = /^\[.+\]$/.test(line.trim());
      return isSection
        ? <span key={i} className="lyrics-section-label">{line}</span>
        : <span key={i}>{line}{"\n"}</span>;
    });
  };

  return (
    <main className="main">
      <header className="header">
        <h1 className="logo">ayaka</h1>
      </header>

      <section className="input-section">
        <div ref={wrapRef} className="search-wrap">
          <form onSubmit={handleSubmit}>
            <div className="input-row">
              <input
                className="main-input"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder='enter song name'
                autoComplete="off"
                autoFocus
              />
              <button type="submit" className="search-btn" disabled={loading}>
                {loading ? <span className="btn-loader" /> : "→"}
              </button>
            </div>
          </form>

          {showSuggestions && suggestions.length > 0 && (
            <div className="suggestions">
              {suggestions.map((s) => (
                <button key={s.id} className="suggestion-row" onClick={() => handleSuggestionClick(s)}>
                  {s.albumArt && (
                    <img src={s.albumArt} alt="" className="suggestion-art"
                      onError={(e) => e.target.style.display = "none"} />
                  )}
                  <div className="suggestion-info">
                    <span className="suggestion-title">{s.songTitle || s.title}</span>
                    {s.artist && <span className="suggestion-artist">{s.artist}</span>}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
        {error && <p className="error-msg">{error}</p>}
      </section>

      {song && (
        <section className="result-section">
          <div className="result-card">
            <div className="card-art-header">
              {song.albumArt && (
                <div className={`album-art-wrap ${imgLoaded ? "loaded" : ""}`}>
                  <img src={song.albumArt} alt={song.title} className="album-art"
                    onLoad={() => setImgLoaded(true)} />
                </div>
              )}
              <div className="card-meta">
                {song.title && <p className="song-title">{song.title}</p>}
                <button className={`copy-btn ${copied ? "done" : ""}`} onClick={copyLyrics}>
                  {copied ? "✓ copied!" : "copy lyrics"}
                </button>
              </div>
            </div>

            <div className="card-lyrics">
              <pre className="lyrics">{formatLyrics(song.lyrics)}</pre>
            </div>
          </div>
        </section>
      )}

      <footer className="footer">made with ♥ by kiriyako</footer>
    </main>
  );
}