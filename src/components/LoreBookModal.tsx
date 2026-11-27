import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  buildLoreBookSpreads,
  LoreBookPage,
  LoreBookSpread,
  LoreChapterSummary,
} from '../game/loreBook';
import { soundEngine } from '../game/sound';
import { LoreEntry, SimulationState } from '../game/types';
import { HudPixelIcon, PowerPixelIcon } from './GameIcons';

interface LoreBookModalProps {
  sim: SimulationState;
  worldName: string;
  onClose: () => void;
  onJumpToLocation?: (x: number, z: number) => void;
}

interface FlipTransitionState {
  direction: 'next' | 'prev';
  fromSpread: LoreBookSpread;
  toSpread: LoreBookSpread;
  toIndex: number;
  key: number;
}

const FLIP_DURATION_MS = 420;

const EMBLEM_BADGE_STYLES: Record<string, { bg: string; border: string; label: string }> = {
  creation: { bg: '#fef3c7', border: '#b45309', label: 'GENESIS' },
  titan: { bg: '#fee2e2', border: '#b91c1c', label: 'TITAN' },
  zombie: { bg: '#ecfccb', border: '#4d7c0f', label: 'BLIGHT' },
  wonder: { bg: '#fef9c3', border: '#a16207', label: 'WONDER' },
  epoch: { bg: '#e0f2fe', border: '#0369a1', label: 'AGE' },
  war: { bg: '#ffe4e6', border: '#be123c', label: 'WAR' },
  peace: { bg: '#dcfce7', border: '#15803d', label: 'ACCORD' },
  kingdom: { bg: '#ede9fe', border: '#6d28d9', label: 'REALM' },
  disaster: { bg: '#ffedd5', border: '#c2410c', label: 'OMEN' },
  divine: { bg: '#fef3c7', border: '#d97706', label: 'MIRACLE' },
  legend: { bg: '#f3e8ff', border: '#7e22ce', label: 'ANNAL' },
};

const LoreEmblemIcon: React.FC<{ emblem: string }> = ({ emblem }) => {
  switch (emblem) {
    case 'titan':
      return <PowerPixelIcon power="divine_titan" className="w-5 h-5 pixelated-canvas shrink-0" />;
    case 'zombie':
      return <PowerPixelIcon power="zombie_virus" className="w-5 h-5 pixelated-canvas shrink-0" />;
    case 'disaster':
      return <PowerPixelIcon power="meteor_strike" className="w-5 h-5 pixelated-canvas shrink-0" />;
    case 'war':
      return <PowerPixelIcon power="start_war" className="w-5 h-5 pixelated-canvas shrink-0" />;
    case 'peace':
      return <PowerPixelIcon power="harmony_dove" className="w-5 h-5 pixelated-canvas shrink-0" />;
    case 'divine':
      return <PowerPixelIcon power="blessing" className="w-5 h-5 pixelated-canvas shrink-0" />;
    case 'wonder':
      return <PowerPixelIcon power="golden_age" className="w-5 h-5 pixelated-canvas shrink-0" />;
    case 'kingdom':
      return <PowerPixelIcon power="divine_shield" className="w-5 h-5 pixelated-canvas shrink-0" />;
    case 'epoch':
      return <PowerPixelIcon power="eureka" className="w-5 h-5 pixelated-canvas shrink-0" />;
    default:
      return <HudPixelIcon kind="loreBook" className="w-5 h-5 pixelated-canvas shrink-0" />;
  }
};

const PixelCornerClasp: React.FC<{ position: 'tl' | 'tr' | 'bl' | 'br' }> = ({ position }) => {
  const posClass =
    position === 'tl'
      ? 'top-0 left-0 border-r-2 border-b-2'
      : position === 'tr'
        ? 'top-0 right-0 border-l-2 border-b-2'
        : position === 'bl'
          ? 'bottom-0 left-0 border-r-2 border-t-2'
          : 'bottom-0 right-0 border-l-2 border-t-2';
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute w-4 h-4 bg-[#d9a441] border-[#1c0c06] z-20 ${posClass}`}
      style={{
        boxShadow: 'inset 2px 2px 0 0 #ffe38e, inset -2px -2px 0 0 #8a5614',
      }}
    />
  );
};

const LoreEntryVerse: React.FC<{
  entry: LoreEntry;
  onJump?: (x: number, z: number) => void;
}> = ({ entry, onJump }) => {
  const style = EMBLEM_BADGE_STYLES[entry.emblem] ?? EMBLEM_BADGE_STYLES.legend;
  const firstChar = entry.body.charAt(0);
  const restBody = entry.body.slice(1);

  return (
    <article className="pb-2.5 mb-2.5 border-b-2 border-dashed border-[#bfa06e]/70 last:border-b-0 last:mb-0 last:pb-0">
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <div
            className="w-6 h-6 flex items-center justify-center border-2 shrink-0"
            style={{ backgroundColor: style.bg, borderColor: style.border }}
          >
            <LoreEmblemIcon emblem={entry.emblem} />
          </div>
          <div className="min-w-0">
            <h4 className="text-[11px] sm:text-xs font-extrabold text-[#3a1a0e] leading-tight truncate">
              {entry.title}
            </h4>
            <div className="flex items-center gap-1.5 text-[9px] font-bold tracking-wider uppercase text-[#7c5332]">
              <span>{entry.yearLabel}</span>
              <span>•</span>
              <span style={{ color: style.border }}>{style.label}</span>
            </div>
          </div>
        </div>

        {entry.x !== undefined && entry.z !== undefined && onJump && (
          <button
            type="button"
            onClick={() => onJump(entry.x!, entry.z!)}
            title={`Locate (${entry.x}, ${entry.z})`}
            className="shrink-0 px-1.5 py-0.5 text-[9px] font-bold bg-[#8f2424] hover:bg-[#a82c2c] text-[#fff6df] border-2 border-[#3b0c0c] cursor-pointer transition-colors"
            style={{
              boxShadow: 'inset 1px 1px 0 0 #d95b5b, inset -1px -1px 0 0 #521010',
            }}
          >
            ({entry.x},{entry.z})
          </button>
        )}
      </div>

      <p className="text-[11px] sm:text-[12px] leading-[1.45] text-[#2e1c10] font-serif">
        <span
          className="float-left mr-1.5 mt-0.5 w-6 h-6 flex items-center justify-center text-sm font-black bg-[#7c1f1f] text-[#ffefc2] border-2 border-[#2e0c0c] leading-none"
          style={{
            boxShadow: 'inset 1px 1px 0 0 #c94c4c, inset -1px -1px 0 0 #450d0d',
          }}
        >
          {firstChar}
        </span>
        {restBody}
      </p>
    </article>
  );
};

const PageSurface: React.FC<{
  page: LoreBookPage;
  side: 'left' | 'right';
  onSelectChapter: (spreadIndex: number) => void;
  onJump?: (x: number, z: number) => void;
}> = ({ page, side, onSelectChapter, onJump }) => {
  return (
    <div
      className={`lore-parchment w-full h-full p-3.5 sm:p-5 flex flex-col justify-between overflow-hidden select-none ${
        side === 'left' ? 'lore-parchment-left' : 'lore-parchment-right'
      }`}
    >
      {page.kind === 'title' && (
        <div className="h-full flex flex-col items-center justify-between text-center py-2 border-2 border-[#b48d56] px-3 bg-[#f9edd0]/40">
          <div className="text-[9px] tracking-[0.22em] uppercase font-bold text-[#7c5332] border-b border-[#b48d56] pb-1 w-full">
            Chronicles of the Living World
          </div>

          <div className="flex flex-col items-center gap-2 my-auto py-2">
            <div
              className="w-12 h-12 flex items-center justify-center bg-[#5a1f16] border-2 border-[#210b07]"
              style={{
                boxShadow: 'inset 2px 2px 0 0 #9e4332, inset -2px -2px 0 0 #2e0d08',
              }}
            >
              <HudPixelIcon kind="loreBook" className="w-8 h-8 pixelated-canvas" />
            </div>
            <h2 className="text-base sm:text-xl font-black text-[#2e140a] tracking-tight leading-tight px-1">
              {page.worldName}
            </h2>
            <div className="text-[10px] font-bold uppercase tracking-widest text-[#8f2424]">
              {page.epochName} • Year {page.year}
            </div>
            <div className="w-24 h-0.5 bg-[#9e733b]" />
            <p className="text-[10px] sm:text-[11px] italic text-[#5c3c22] max-w-[230px] leading-snug font-serif">
              &ldquo;Every rise of crown, every falling star, and every whispered prayer is etched in ink that never fades.&rdquo;
            </p>
          </div>

          <div className="grid grid-cols-2 gap-1.5 w-full text-[10px] border-t border-[#b48d56] pt-2">
            <div className="bg-[#e8d1a5]/70 border border-[#b48d56] px-1.5 py-1">
              <div className="text-[8px] uppercase text-[#6e4727] font-bold">Souls</div>
              <div className="font-black text-[#2b1a10]">{page.population}</div>
            </div>
            <div className="bg-[#e8d1a5]/70 border border-[#b48d56] px-1.5 py-1">
              <div className="text-[8px] uppercase text-[#6e4727] font-bold">Realms</div>
              <div className="font-black text-[#2b1a10]">{page.kingdomCount}</div>
            </div>
            <div className="bg-[#e8d1a5]/70 border border-[#b48d56] px-1.5 py-1">
              <div className="text-[8px] uppercase text-[#6e4727] font-bold">Wonders</div>
              <div className="font-black text-[#2b1a10]">{page.wonderCount}</div>
            </div>
            <div className="bg-[#e8d1a5]/70 border border-[#b48d56] px-1.5 py-1">
              <div className="text-[8px] uppercase text-[#6e4727] font-bold">Miracles</div>
              <div className="font-black text-[#2b1a10]">{page.miraclesCast}</div>
            </div>
          </div>
        </div>
      )}

      {page.kind === 'toc' && (
        <div className="h-full flex flex-col justify-between">
          <div>
            <div className="text-center border-b-2 border-[#9e733b] pb-1.5 mb-2.5">
              <div className="text-[9px] uppercase tracking-[0.2em] font-bold text-[#7c5332]">
                Table of Chapters
              </div>
              <h3 className="text-sm sm:text-base font-black text-[#3a1a0e]">
                Annals Inscribed ({page.totalEntries})
              </h3>
            </div>

            <div className="space-y-1.5 overflow-y-auto max-h-[300px] pr-0.5">
              {page.chapters.map((ch: LoreChapterSummary) => (
                <button
                  key={`${ch.chapterNumber}_${ch.title}`}
                  type="button"
                  onClick={() => onSelectChapter(ch.spreadIndex)}
                  className="w-full text-left px-2 py-1.5 bg-[#ead5ab]/80 hover:bg-[#dfbf85] border-2 border-[#a87e45] flex items-center justify-between gap-2 cursor-pointer transition-colors"
                >
                  <div className="min-w-0">
                    <div className="text-[10px] sm:text-[11px] font-extrabold text-[#3a1a0e] truncate">
                      Chapter {ch.roman}: {ch.title}
                    </div>
                    <div className="text-[9px] text-[#6e4727] font-semibold">
                      Year {ch.startYear} • {ch.entryCount} verse{ch.entryCount === 1 ? '' : 's'}
                    </div>
                  </div>
                  <span className="text-[10px] font-black text-[#8f2424] shrink-0">→</span>
                </button>
              ))}
            </div>
          </div>

          <div className="text-[9px] text-center text-[#7c5332] italic pt-2 border-t border-[#bfa06e]">
            Flip pages with arrows, corners, or swipe • Click a wax seal to jump to its site
          </div>
        </div>
      )}

      {page.kind === 'story' && (
        <>
          <div className="flex-1 overflow-y-auto pr-0.5">
            {page.isChapterStart && (
              <div className="text-center mb-2.5 pb-1.5 border-b-2 border-[#8f2424]/70 bg-[#ead5ab]/55 px-2 py-1">
                <div className="text-[9px] font-black uppercase tracking-[0.2em] text-[#8f2424]">
                  Chapter {page.chapterRoman}
                </div>
                <div className="text-xs sm:text-sm font-black text-[#2e140a]">
                  {page.chapterTitle}
                </div>
              </div>
            )}
            {page.entries.map((entry) => (
              <LoreEntryVerse key={entry.id} entry={entry} onJump={onJump} />
            ))}
          </div>

          <div className="flex items-center justify-between text-[9px] font-bold text-[#7c5332] pt-1.5 border-t border-[#bfa06e]/70 mt-1">
            <span className="truncate">{page.chapterTitle}</span>
            <span>Page {page.pageNumber}</span>
          </div>
        </>
      )}

      {page.kind === 'blank' && (
        <>
          <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
            <div className="w-10 h-10 mb-2 opacity-40 flex items-center justify-center border-2 border-dashed border-[#8a6335]">
              <HudPixelIcon kind="loreBook" className="w-6 h-6 pixelated-canvas" />
            </div>
            <p className="text-xs italic text-[#6e4727] font-serif leading-relaxed">
              {page.epilogueQuote}
            </p>
          </div>
          <div className="flex items-center justify-end text-[9px] font-bold text-[#7c5332] pt-1.5 border-t border-[#bfa06e]/70">
            <span>Page {page.pageNumber}</span>
          </div>
        </>
      )}
    </div>
  );
};

export const LoreBookModal: React.FC<LoreBookModalProps> = ({
  sim,
  worldName,
  onClose,
  onJumpToLocation,
}) => {
  const { spreads } = useMemo(
    () => buildLoreBookSpreads(sim, worldName),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sim, sim.loreBook?.entries.length, sim.chronicle.length, worldName],
  );

  const [spreadIndex, setSpreadIndex] = useState<number>(0);
  const [flip, setFlip] = useState<FlipTransitionState | null>(null);
  const flipTimerRef = useRef<number | null>(null);
  const flipKeyRef = useRef<number>(1);
  const touchStartXRef = useRef<number | null>(null);

  const clampedIndex = Math.min(spreadIndex, Math.max(0, spreads.length - 1));
  const currentSpread = spreads[clampedIndex] ?? spreads[0];

  useEffect(() => {
    return () => {
      if (flipTimerRef.current !== null) {
        window.clearTimeout(flipTimerRef.current);
      }
    };
  }, []);

  const triggerFlipTo = useCallback(
    (targetIdx: number) => {
      const clampedTarget = Math.max(0, Math.min(spreads.length - 1, targetIdx));
      if (clampedTarget === clampedIndex || flip) return;
      const direction: 'next' | 'prev' = clampedTarget > clampedIndex ? 'next' : 'prev';
      soundEngine.playPageFlip();
      soundEngine.playClick();
      flipKeyRef.current += 1;
      setFlip({
        direction,
        fromSpread: spreads[clampedIndex],
        toSpread: spreads[clampedTarget],
        toIndex: clampedTarget,
        key: flipKeyRef.current,
      });
      if (flipTimerRef.current !== null) {
        window.clearTimeout(flipTimerRef.current);
      }
      flipTimerRef.current = window.setTimeout(() => {
        setSpreadIndex(clampedTarget);
        setFlip(null);
        flipTimerRef.current = null;
      }, FLIP_DURATION_MS);
    },
    [clampedIndex, flip, spreads],
  );

  const handleNext = useCallback(() => {
    triggerFlipTo(clampedIndex + 1);
  }, [clampedIndex, triggerFlipTo]);

  const handlePrev = useCallback(() => {
    triggerFlipTo(clampedIndex - 1);
  }, [clampedIndex, triggerFlipTo]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrev();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleNext, handlePrev, onClose]);

  const handleJump = useCallback(
    (x: number, z: number) => {
      if (!onJumpToLocation) return;
      soundEngine.playClick();
      onClose();
      onJumpToLocation(x, z);
    },
    [onClose, onJumpToLocation],
  );

  const displayedLeft = flip
    ? flip.direction === 'prev'
      ? flip.toSpread.left
      : flip.fromSpread.left
    : currentSpread.left;
  const displayedRight = flip
    ? flip.direction === 'next'
      ? flip.toSpread.right
      : flip.fromSpread.right
    : currentSpread.right;

  const canPrev = clampedIndex > 0 && !flip;
  const canNext = clampedIndex < spreads.length - 1 && !flip;

  return (
    <div
      data-testid="lore-book-modal"
      className="fixed inset-0 z-[65] bg-black/75 flex items-center justify-center p-2 sm:p-5"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          soundEngine.playClick();
          onClose();
        }
      }}
      onTouchStart={(e) => {
        touchStartXRef.current = e.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(e) => {
        if (touchStartXRef.current === null) return;
        const endX = e.changedTouches[0]?.clientX ?? touchStartXRef.current;
        const dx = endX - touchStartXRef.current;
        touchStartXRef.current = null;
        if (dx <= -44) handleNext();
        else if (dx >= 44) handlePrev();
      }}
    >
      <div className="relative w-full max-w-[820px] flex flex-col items-center gap-2.5">
        {/* Top bar above tome */}
        <div className="w-full flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => triggerFlipTo(0)}
              disabled={clampedIndex === 0 || Boolean(flip)}
              className="px-btn px-2.5 py-1 text-[11px] font-bold cursor-pointer disabled:opacity-45"
            >
              Contents
            </button>
            <span className="text-[11px] font-bold text-[#f2d49b] drop-shadow">
              Spread {clampedIndex + 1} / {spreads.length}
            </span>
          </div>
          <button
            type="button"
            data-testid="lore-book-close-btn"
            onClick={() => {
              soundEngine.playClick();
              onClose();
            }}
            className="px-btn px-2.5 py-1 text-[11px] font-bold cursor-pointer"
          >
            Close Book ✕
          </button>
        </div>

        {/* Pixelated Leather-Bound Open Tome */}
        <div className="lore-book-cover relative w-full p-2.5 sm:p-4">
          <PixelCornerClasp position="tl" />
          <PixelCornerClasp position="tr" />
          <PixelCornerClasp position="bl" />
          <PixelCornerClasp position="br" />

          {/* Crimson silk ribbon bookmark hanging from center spine */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-1 left-1/2 -translate-x-1/2 w-3.5 h-8 bg-[#9e1c1c] border-x-2 border-b-2 border-[#2a0606] z-30"
            style={{
              boxShadow: 'inset 2px 0 0 0 #d93b3b',
            }}
          />

          {/* Layered pixel page edges (left & right paper stack thickness) */}
          <div className="relative bg-[#cbb282] p-1 sm:p-1.5 border-2 border-[#261108]">
            <div className="lore-stage relative grid grid-cols-1 sm:grid-cols-2 min-h-[400px] sm:min-h-[450px] max-h-[70vh] border-2 border-[#5c3b1e] bg-[#f3e2be]">
              {/* Static Left Page */}
              <div className="relative h-[400px] sm:h-[450px] border-b-2 sm:border-b-0 sm:border-r-2 border-[#7c5332]/70 overflow-hidden">
                <PageSurface
                  page={displayedLeft}
                  side="left"
                  onSelectChapter={(idx) => triggerFlipTo(idx)}
                  onJump={handleJump}
                />
                {canPrev && (
                  <button
                    type="button"
                    aria-label="Previous page"
                    onClick={handlePrev}
                    className="hidden sm:block absolute bottom-0 left-0 w-9 h-9 bg-gradient-to-tr from-[#c9ab74] via-[#e2ca98] to-transparent opacity-60 hover:opacity-100 cursor-pointer transition-opacity"
                    title="Previous Page (←)"
                  />
                )}
              </div>

              {/* Static Right Page */}
              <div className="relative h-[400px] sm:h-[450px] overflow-hidden">
                <PageSurface
                  page={displayedRight}
                  side="right"
                  onSelectChapter={(idx) => triggerFlipTo(idx)}
                  onJump={handleJump}
                />
                {canNext && (
                  <button
                    type="button"
                    aria-label="Next page"
                    onClick={handleNext}
                    className="hidden sm:block absolute bottom-0 right-0 w-9 h-9 bg-gradient-to-tl from-[#c9ab74] via-[#e2ca98] to-transparent opacity-60 hover:opacity-100 cursor-pointer transition-opacity"
                    title="Next Page (→)"
                  />
                )}
              </div>

              {/* Center Spine Crease Shadow */}
              <div
                aria-hidden="true"
                className="hidden sm:block pointer-events-none absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-3 z-20"
                style={{
                  background:
                    'linear-gradient(90deg, rgba(48,24,10,0) 0%, rgba(48,24,10,0.42) 50%, rgba(48,24,10,0) 100%)',
                }}
              />

              {/* 3D Animated Turning Leaf (Desktop/Tablet 2-page spread) */}
              {flip && (
                <div
                  key={flip.key}
                  aria-hidden="true"
                  className={`hidden sm:block pointer-events-none absolute top-0 bottom-0 w-1/2 z-30 lore-flip-leaf ${
                    flip.direction === 'next'
                      ? 'left-1/2 lore-flip-next'
                      : 'left-0 lore-flip-prev'
                  }`}
                >
                  {/* Front face of turning leaf */}
                  <div className="lore-flip-face absolute inset-0 border-l border-[#7c5332]/60 shadow-xl overflow-hidden">
                    <PageSurface
                      page={
                        flip.direction === 'next'
                          ? flip.fromSpread.right
                          : flip.fromSpread.left
                      }
                      side={flip.direction === 'next' ? 'right' : 'left'}
                      onSelectChapter={() => {}}
                    />
                  </div>
                  {/* Back face of turning leaf */}
                  <div className="lore-flip-face lore-flip-back absolute inset-0 border-r border-[#7c5332]/60 shadow-xl overflow-hidden">
                    <PageSurface
                      page={
                        flip.direction === 'next'
                          ? flip.toSpread.left
                          : flip.toSpread.right
                      }
                      side={flip.direction === 'next' ? 'left' : 'right'}
                      onSelectChapter={() => {}}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Bottom Page-Turn Controls */}
        <div className="w-full flex items-center justify-between px-1">
          <button
            type="button"
            data-testid="lore-book-prev-btn"
            onClick={handlePrev}
            disabled={!canPrev}
            className="px-btn px-3.5 py-1.5 text-xs font-bold cursor-pointer disabled:opacity-40"
          >
            ← Prev Page
          </button>
          <span className="text-[10px] text-[#e6c896] hidden sm:inline">
            Use ← / → keys or click page corners to flip
          </span>
          <button
            type="button"
            data-testid="lore-book-next-btn"
            onClick={handleNext}
            disabled={!canNext}
            className="px-btn px-3.5 py-1.5 text-xs font-bold cursor-pointer disabled:opacity-40"
          >
            Next Page →
          </button>
        </div>
      </div>
    </div>
  );
};
