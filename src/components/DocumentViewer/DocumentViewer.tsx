import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { assetUrl } from '../../lib/assets';
import { docFinished } from '../../lib/board';
import { chapterById, glossary, strings } from '../../lib/data';
import { glossaryByDoc, splitBody, type Chunk } from '../../lib/docText';
import { fmt } from '../../lib/format';
import { availableDocs } from '../../lib/docFlow';
import { hasChoice } from '../../lib/validateEdge';
import { useGame } from '../../store/gameStore';
import type { Doc } from '../../types';
import './DocumentViewer.css';

// 문서 확대 보기(기획서 3·5.1). 무대 밖 층에 실제 화면 px로 띄운다(본문 22px).
// 핵심 구절은 처음부터 형광펜으로 칠해져 있다. 밑줄 낱말을 누르면 풀이가 뜬다.
// '다 읽었어요'를 누르면 닫히고, 그 문서와 짝인 실의 바꾸기 창이 열린다. 실이 없는 문서면 다음 문서가 바로 열린다.

function docDate(doc: Doc): string {
  return doc.yearLabel ?? fmt(strings.docs.year, { year: doc.year });
}

export function DocumentViewer() {
  const { chapterId, openDocId, openDocFresh, readDocs, done, revealed, openDocument, closeDocument, finishDocument } = useGame();
  const chapter = chapterById(chapterId);
  const wordsByDoc = useMemo(() => glossaryByDoc(chapter, Object.keys(glossary)), [chapter]);
  const doc = chapter.documents.find((d) => d.id === openDocId);
  const docs = availableDocs(chapter, revealed, readDocs, done);
  const more = docs.length < chapter.documents.length;

  const [popup, setPopup] = useState<{ word: string; x: number; y: number } | null>(null);
  const paperRef = useRef<HTMLElement>(null);

  useEffect(() => {
    setPopup(null);
    if (openDocId) paperRef.current?.focus();
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

  const isDone = (d: Doc) => docFinished(chapter, d.id, { readDocs, done });

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
    return chunk.key ? <mark key={i} className="key-phrase">{pieces}</mark> : <span key={i}>{pieces}</span>;
  };

  return (
    <div className="viewer-backdrop" onClick={(e) => e.target === e.currentTarget && closeDocument()}>
      <div className="viewer" role="dialog" aria-modal="true" aria-label={doc.title} onClick={onViewerClick}>
        <nav className="doc-list">
          <div className="doc-list-heading">{strings.docs.listTitle}</div>
          <ol>
            {docs.map((d) => (
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
                    {isDone(d) && (
                      <span className="doc-list-read" aria-label={strings.docs.read} title={strings.docs.read}> ✓</span>
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ol>
          {more && <p className="doc-list-note">{strings.docs.waiting}</p>}
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
            <p className="doc-body">{splitBody(doc.body, doc.keyPhrase, wordsByDoc.get(doc.id) ?? []).map(renderChunk)}</p>
            {doc.listLine && (
              <p className="doc-names">
                {doc.listLabel && <span className="doc-names-label">{doc.listLabel}</span>}
                {doc.listLine.join(' · ')}
              </p>
            )}
            <footer className="doc-foot">
              <span className="doc-source">
                {doc.source && fmt(strings.docs.source, { source: doc.source })}
                {doc.outsideTextbook && ` · ${strings.docs.outsideTextbook}`}
              </span>
            </footer>
          </article>

          <div className="viewer-buttons">
            {(hasChoice(chapter, doc.id) ? isDone(doc) : !openDocFresh) ? (
              <button type="button" className="viewer-close" onClick={closeDocument}>
                {strings.docs.close}
              </button>
            ) : (
              <button type="button" className="viewer-close" onClick={finishDocument}>
                {strings.docs.doneRead}
              </button>
            )}
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
