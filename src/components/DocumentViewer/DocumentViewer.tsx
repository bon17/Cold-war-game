import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react';
import { assetUrl } from '../../lib/assets';
import { chapterById, glossary, strings } from '../../lib/data';
import { glossaryByDoc, splitBody, type Chunk } from '../../lib/docText';
import { fmt } from '../../lib/format';
import { hasClue, useGame } from '../../store/gameStore';
import type { Doc } from '../../types';
import './DocumentViewer.css';

// 문서 확대 보기(기획서 3·5.1). 무대 밖 층에 실제 화면 px로 띄운다(본문 20px).
// 단서 구절을 한 번 누르면(또는 Enter) 형광펜이 칠해지고 단서 쪽지가 생긴다. 단서가 아닌 곳은 눌러도 아무 일이 없다.
// 연 지 20초가 지나도 단서를 칠하지 않으면 남은 단서가 살짝 빛난다. 밑줄 낱말을 누르면 풀이가 뜬다.

const HINT_AFTER_MS = 20_000;

function pressable(action: () => void) {
  return {
    role: 'button',
    tabIndex: 0,
    onKeyDown: (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        action();
      }
    },
  } as const;
}

function docDate(doc: Doc): string {
  return doc.yearLabel ?? fmt(strings.docs.year, { year: doc.year });
}

export function DocumentViewer() {
  const { chapterId, openDocId, readDocs, clues, openDocument, closeDocument, collectClue } = useGame();
  const chapter = chapterById(chapterId);
  const wordsByDoc = useMemo(() => glossaryByDoc(chapter, Object.keys(glossary)), [chapter]);
  const doc = chapter.documents.find((d) => d.id === openDocId);
  const ordered = useMemo(
    () => [...chapter.documents.filter((d) => d.tier === 'core'), ...chapter.documents.filter((d) => d.tier === 'extra')],
    [chapter],
  );

  const [popup, setPopup] = useState<{ word: string; x: number; y: number } | null>(null);
  const [hint, setHint] = useState(false);
  const collectedHere = useRef(false);
  const paperRef = useRef<HTMLElement>(null);

  useEffect(() => {
    setHint(false);
    setPopup(null);
    collectedHere.current = false;
    if (!openDocId) return;
    paperRef.current?.focus();
    const timer = window.setTimeout(() => {
      if (!collectedHere.current) setHint(true);
    }, HINT_AFTER_MS);
    return () => window.clearTimeout(timer);
  }, [openDocId]);

  useEffect(() => {
    if (!openDocId) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (popup) setPopup(null);
      else closeDocument();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openDocId, popup, closeDocument]);

  if (!doc) return null;

  const index = ordered.indexOf(doc);
  const found = doc.clues.filter((c) => hasClue(clues, doc.id, c)).length;

  const onClue = (clue: string) => {
    collectedHere.current = true;
    setHint(false);
    collectClue(doc.id, clue);
  };

  const showWord = (word: string, el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    setPopup({ word, x: r.left + r.width / 2, y: r.bottom + 8 });
  };

  const onViewerClick = (e: MouseEvent) => {
    if (popup && !(e.target as HTMLElement).closest('.gloss, .gloss-popup')) setPopup(null);
  };

  const renderChunk = (chunk: Chunk, i: number) => {
    const pieces = chunk.pieces.map((p, k) =>
      p.word ? (
        <span
          key={k}
          className="gloss"
          role="button"
          tabIndex={0}
          onClick={(e) => showWord(p.word!, e.currentTarget)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              showWord(p.word!, e.currentTarget);
            }
          }}
        >
          {p.text}
        </span>
      ) : (
        p.text
      ),
    );
    if (!chunk.clue) return <span key={i}>{pieces}</span>;
    const clue = chunk.clue;
    const collected = hasClue(clues, doc.id, clue);
    return (
      <span
        key={i}
        className={`clue${collected ? ' collected' : ''}${hint && !collected ? ' hint' : ''}`}
        onClick={() => onClue(clue)}
        {...pressable(() => onClue(clue))}
        aria-pressed={collected}
      >
        {pieces}
      </span>
    );
  };

  const listItem = (d: Doc) => (
    <li key={d.id}>
      <button
        type="button"
        className={`doc-list-item${d.id === doc.id ? ' current' : ''}`}
        aria-current={d.id === doc.id}
        onClick={() => openDocument(d.id)}
      >
        <span className="doc-list-meta">
          <span className="doc-list-year">{d.year}</span>
          <span>{strings.docs.typesShort[d.type]}</span>
        </span>
        <span className="doc-list-title">
          {d.title}
          {readDocs.includes(d.id) && (
            <span className="doc-list-read" aria-label={strings.docs.read} title={strings.docs.read}> ✓</span>
          )}
        </span>
      </button>
    </li>
  );

  return (
    <div className="viewer-backdrop" onClick={(e) => e.target === e.currentTarget && closeDocument()}>
      <div className="viewer" role="dialog" aria-modal="true" aria-label={doc.title} onClick={onViewerClick}>
        <nav className="doc-list">
          <div className="doc-list-heading">{strings.docs.listTitle}</div>
          <ol>{ordered.filter((d) => d.tier === 'core').map(listItem)}</ol>
          <div className="doc-list-heading extra">
            {strings.docs.extraTitle}
            <span className="doc-list-note">{strings.docs.extraNote}</span>
          </div>
          <ol>{ordered.filter((d) => d.tier === 'extra').map(listItem)}</ol>
        </nav>

        <div className="doc-column">
          <article
            ref={paperRef}
            tabIndex={-1}
            className={`doc-paper doc-${doc.type}`}
            style={{ ['--paper-grain' as string]: `url(${assetUrl('tex/paper-grain.webp')})` }}
          >
            <header className="doc-head">
              {strings.docs.types[doc.type]} · {docDate(doc)}
            </header>
            <h2 className="doc-title">{doc.title}</h2>
            <p className="doc-body">{splitBody(doc.body, doc.clues, wordsByDoc.get(doc.id) ?? []).map(renderChunk)}</p>
            <footer className="doc-foot">
              <span className={`doc-clue-count${found === doc.clues.length ? ' done' : ''}`}>
                {fmt(strings.docs.cluesFound, { found, total: doc.clues.length })}
              </span>
              <span className="doc-source">
                {doc.source && fmt(strings.docs.source, { source: doc.source })}
                {doc.outsideTextbook && ` · ${strings.docs.outsideTextbook}`}
              </span>
            </footer>
          </article>

          <div className="viewer-buttons">
            <button type="button" disabled={index <= 0} onClick={() => openDocument(ordered[index - 1].id)}>
              {strings.docs.prev}
            </button>
            <button type="button" disabled={index >= ordered.length - 1} onClick={() => openDocument(ordered[index + 1].id)}>
              {strings.docs.next}
            </button>
            <button type="button" className="viewer-close" onClick={closeDocument}>
              {strings.docs.close}
            </button>
          </div>
        </div>

        {popup && (
          <div className="gloss-popup" role="note" style={{ left: popup.x, top: popup.y }}>
            <div className="gloss-popup-title">
              {strings.docs.glossaryTitle} · <strong>{popup.word}</strong>
            </div>
            <div>{glossary[popup.word]}</div>
          </div>
        )}
      </div>
    </div>
  );
}
