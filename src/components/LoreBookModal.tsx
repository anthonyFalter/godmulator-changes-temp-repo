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

const FLIP_DURATION_MS = 380;

const LoreEmblemIcon: React.FC<{ emblem: string }> = ({ emblem }) => {
  switch (emblem) {
    case 'titan':
      return <PowerPixelIcon power="divine_titan" className="w-4 h-4 pixelated-canvas shrink-0" />;
    case 'zombie':
      return <PowerPixelIcon power="zombie_virus" className="w-4 h-4 pixelated-canvas shrink-0" />;
    case 'disaster':
      return <PowerPixelIcon power="meteor_strike" className="w-4 h-4 pixelated-canvas shrink-0" />;
    case 'war':
      return <PowerPixelIcon power="start_war" className="w-4 h-4 pixelated-canvas shrink-0" />;
    case 'peace':
      return <PowerPixelIcon power="harmony_dove" className="w-4 h-4 pixelated-canvas shrink-0" />;
    case 'divine':
      return <PowerPixelIcon power="blessing" className="w-4 h-4 pixelated-canvas shrink-0" />;
    case 'wonder':
      return <PowerPixelIcon power="golden_age" className="w-4 h-4 pixelated-canvas shrink-0" />;
    case 'kingdom':
      return <PowerPixelIcon power="divine_shield" className="w-4 h-4 pixelated-canvas shrink-0" />;
    case 'epoch':
      return <PowerPixelIcon power="eureka" className="w-4 h-4 pixelated-canvas shrink-0" />;
    default:
      return <HudPixelIcon kind="loreBook" className="w-4 h-4 pixelated-canvas shrink-0" />;
  }
};

const LoreEntryVerse: React.FC<{
  entry: LoreEntry;
  onJump?: (x: number, z: number) => void;
}> = ({ entry, onJump }) => {
  const firstChar = entry.body.charAt(0);
  const restBody = entry.body.slice(1);

  return (
    <article className="mb-6 last:mb-0">
      <div className="flex items-baseline justify-between gap-3 mb-1.5">
        <div className="flex items-center gap-2 min-w-0">
          <LoreEmblemIcon emblem={entry.emblem} />
          <h4 className="text-[13px] sm:text-sm font-bold text-[#2b150b] leading-snug truncate">
            {entry.title}
          </h4>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 text-[11px] tabular-nums text-[#734d2c]">
          <span>{entry.yearLabel}</span>
          {entry.x !== undefined && entry.z !== undefined && onJump && (
            <button
              type="button"
              onClick={() => onJump(entry.x!, entry.z!)}
              title={`Pan camera to (${entry.x}, ${entry.z})`}
              className="text-[#8b2222] hover:text-[#5c1111] font-bold underline underline-offset-2 cursor-pointer"
            >
              Locate
            </button>
          )}
        </div>
      </div>

      <p className="text-[12px] sm:text-[13px] leading-[1.65] text-[#2f1d11]">
        <span className="float-left mr-1.5 mt-0.5 text-[26px] font-black leading-[0.85] text-[#8b2222]">
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
      className={`lore-parchment w-full h-full px-6 py-6 sm:px-8 sm:py-7 flex flex-col justify-between overflow-hidden select-none ${
        side === 'left' ? 'lore-parchment-left' : 'lore-parchment-right'
      }`}
    >
      {page.kind === 'title' && (
        <div className="h-full flex flex-col items-center justify-between text-center">
          {/* Optical-center title block: positioned slightly above mathematical center */}
          <div className="flex-1 flex flex-col items-center justify-center pb-8">
            <HudPixelIcon kind="loreBook" className="w-10 h-10 pixelated-canvas mb-4" />
            <h2 className="text-xl sm:text-2xl font-black text-[#261209] leading-tight max-w-[260px]">
              {page.worldName}
            </h2>
            <p className="mt-2 text-xs sm:text-[13px] font-semibold text-[#6e4624] tabular-nums">
              {page.epochName} · Year {page.year}
            </p>
          </div>

          <p className="text-[11px] text-[#7a5230] tabular-nums">
            {page.kingdomCount} {page.kingdomCount === 1 ? 'realm' : 'realms'} · {page.population}{' '}
            souls · {page.wonderCount} {page.wonderCount === 1 ? 'wonder' : 'wonders'}
          </p>
        </div>
      )}

      {page.kind === 'toc' && (
        <div className="h-full flex flex-col justify-between">
          <div>
            <h3 className="text-base sm:text-lg font-black text-[#261209] mb-4">
              Contents
            </h3>

            <nav aria-label="Lore Book Chapters" className="space-y-1 overflow-y-auto max-h-[330px] pr-1">
              {page.chapters.map((ch: LoreChapterSummary) => (
                <button
                  key={`${ch.chapterNumber}_${ch.title}`}
                  type="button"
                  onClick={() => onSelectChapter(ch.spreadIndex)}
                  className="w-full min-h-[40px] text-left px-2 py-2 hover:bg-[#e5d0a1] flex items-baseline justify-between gap-3 cursor-pointer transition-colors"
                >
                  <span className="text-xs sm:text-[13px] font-bold text-[#2b150b] truncate">
                    Chapter {ch.roman} — {ch.title}
                  </span>
                  <span className="text-[11px] font-semibold text-[#734d2c] tabular-nums shrink-0">
                    Yr {ch.startYear}
                  </span>
                </button>
              ))}
            </nav>
          </div>

          <p className="text-[11px] text-[#7a5230] tabular-nums">
            {page.totalEntries} {page.totalEntries === 1 ? 'entry' : 'entries'} recorded
          </p>
        </div>
      )}

      {page.kind === 'story' && (
        <>
          <div className="flex-1 overflow-y-auto pr-1">
            {page.isChapterStart && (
              <h3 className="text-sm sm:text-base font-black text-[#8b2222] mb-5">
                Chapter {page.chapterRoman} — {page.chapterTitle}
              </h3>
            )}
            {page.entries.map((entry) => (
              <LoreEntryVerse key={entry.id} entry={entry} onJump={onJump} />
            ))}
          </div>

          <div
            className={`flex items-center text-[11px] font-semibold text-[#7a5230] tabular-nums pt-3 ${
              side === 'left' ? 'justify-start' : 'justify-end'
            }`}
          >
            <span>{page.pageNumber}</span>
          </div>
        </>
      )}

      {page.kind === 'blank' && (
        <>
          <div className="flex-1 flex items-center justify-center text-center px-6">
            <p className="text-xs sm:text-[13px] text-[#7a5230] leading-relaxed">
              {page.epilogueQuote}
            </p>
          </div>
          <div className="flex items-center justify-end text-[11px] font-semibold text-[#7a5230] tabular-nums pt-3">
            <span>{page.pageNumber}</span>
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

  // Interruptible page turn: rapid clicks immediately advance from the in-flight target
  const triggerFlipTo = useCallback(
    (targetIdx: number) => {
      const baseIndex = flip ? flip.toIndex : clampedIndex;
      const clampedTarget = Math.max(0, Math.min(spreads.length - 1, targetIdx));
      if (clampedTarget === baseIndex) return;

      if (flipTimerRef.current !== null) {
        window.clearTimeout(flipTimerRef.current);
        flipTimerRef.current = null;
      }
      if (flip) {
        setSpreadIndex(baseIndex);
      }

      const direction: 'next' | 'prev' = clampedTarget > baseIndex ? 'next' : 'prev';
      soundEngine.playPageFlip();
      soundEngine.playClick();
      flipKeyRef.current += 1;
      setFlip({
        direction,
        fromSpread: spreads[baseIndex],
        toSpread: spreads[clampedTarget],
        toIndex: clampedTarget,
        key: flipKeyRef.current,
      });
      flipTimerRef.current = window.setTimeout(() => {
        setSpreadIndex(clampedTarget);
        setFlip(null);
        flipTimerRef.current = null;
      }, FLIP_DURATION_MS);
    },
    [clampedIndex, flip, spreads],
  );

  const activeLogicalIndex = flip ? flip.toIndex : clampedIndex;

  const handleNext = useCallback(() => {
    triggerFlipTo(activeLogicalIndex + 1);
  }, [activeLogicalIndex, triggerFlipTo]);

  const handlePrev = useCallback(() => {
    triggerFlipTo(activeLogicalIndex - 1);
  }, [activeLogicalIndex, triggerFlipTo]);

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

  const canPrev = activeLogicalIndex > 0;
  const canNext = activeLogicalIndex < spreads.length - 1;

  return (
    <div
      data-testid="lore-book-modal"
      className="fixed inset-0 z-[65] bg-black/75 flex items-center justify-center p-3 sm:p-6"
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
      <div className="relative w-full max-w-[800px] flex flex-col items-center gap-3">
        {/* Top bar */}
        <div className="w-full flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => triggerFlipTo(0)}
              disabled={activeLogicalIndex === 0}
              className="px-btn min-h-[36px] px-3 text-xs font-bold cursor-pointer disabled:opacity-40"
            >
              Contents
            </button>
            <span className="text-xs font-semibold text-[#e6cca0] tabular-nums">
              {activeLogicalIndex + 1} / {spreads.length}
            </span>
          </div>
          <button
            type="button"
            data-testid="lore-book-close-btn"
            onClick={() => {
              soundEngine.playClick();
              onClose();
            }}
            className="px-btn min-h-[36px] px-3 text-xs font-bold cursor-pointer"
          >
            Close
          </button>
        </div>

        {/* Pixelated Open Tome */}
        <div className="lore-book-cover relative w-full p-2.5 sm:p-3.5">
          {/* Crimson silk ribbon bookmark */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-7 bg-[#8b2222] border-x-2 border-b-2 border-[#2a0606] z-30"
          />

          {/* Layered pixel paper stack */}
          <div className="relative bg-[#cbb282] px-1.5 py-1 border-2 border-[#261108]">
            <div className="lore-stage relative grid grid-cols-1 sm:grid-cols-2 min-h-[420px] sm:min-h-[460px] max-h-[70vh] border-2 border-[#5c3b1e] bg-[#f2e2be]">
              {/* Left Page */}
              <div className="relative h-[420px] sm:h-[460px] border-b-2 sm:border-b-0 sm:border-r-2 border-[#6e4624] overflow-hidden">
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
                    className="hidden sm:block absolute bottom-0 left-0 w-11 h-11 cursor-pointer group"
                    title="Previous page"
                  >
                    <span className="block absolute bottom-0 left-0 w-4 h-4 bg-[#d9c190] border-t-2 border-r-2 border-[#8c693c] opacity-60 group-hover:opacity-100 transition-opacity" />
                  </button>
                )}
              </div>

              {/* Right Page */}
              <div className="relative h-[420px] sm:h-[460px] overflow-hidden">
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
                    className="hidden sm:block absolute bottom-0 right-0 w-11 h-11 cursor-pointer group"
                    title="Next page"
                  >
                    <span className="block absolute bottom-0 right-0 w-4 h-4 bg-[#d9c190] border-t-2 border-l-2 border-[#8c693c] opacity-60 group-hover:opacity-100 transition-opacity" />
                  </button>
                )}
              </div>

              {/* 3D Animated Turning Leaf */}
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
                  <div className="lore-flip-face absolute inset-0 border-l-2 border-[#6e4624] overflow-hidden">
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
                  <div className="lore-flip-face lore-flip-back absolute inset-0 border-r-2 border-[#6e4624] overflow-hidden">
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

        {/* Bottom Page-Turn Controls (44px+ touch targets) */}
        <div className="w-full flex items-center justify-between">
          <button
            type="button"
            data-testid="lore-book-prev-btn"
            onClick={handlePrev}
            disabled={!canPrev}
            className="px-btn min-h-[44px] px-4 text-xs font-bold cursor-pointer disabled:opacity-35"
          >
            ← Previous
          </button>
          <button
            type="button"
            data-testid="lore-book-next-btn"
            onClick={handleNext}
            disabled={!canNext}
            className="px-btn min-h-[44px] px-4 text-xs font-bold cursor-pointer disabled:opacity-35"
          >
            Next →
          </button>
        </div>
      </div>
    </div>
  );
};
