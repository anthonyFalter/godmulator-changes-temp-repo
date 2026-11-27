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

/* --- Pixel-Art Book Ornaments (crisp integer pixel grids) --- */

const BrassCornerClasp: React.FC<{ position: 'tl' | 'tr' | 'bl' | 'br' }> = ({ position }) => {
  const posClass =
    position === 'tl'
      ? '-top-[3px] -left-[3px]'
      : position === 'tr'
        ? '-top-[3px] -right-[3px] -scale-x-100'
        : position === 'bl'
          ? '-bottom-[3px] -left-[3px] -scale-y-100'
          : '-bottom-[3px] -right-[3px] -scale-x-100 -scale-y-100';

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 12 12"
      shapeRendering="crispEdges"
      className={`pointer-events-none absolute ${posClass} w-6 h-6 sm:w-7 sm:h-7 z-10 pixelated-canvas`}
    >
      <path d="M0 0h12v4h-5v1h-2v2h-1v5h-4z" fill="#140804" />
      <path d="M1 1h10v2h-6v1h-1v1h-1v6h-2z" fill="#c79538" />
      <path d="M1 1h9v1h-8v8h-1z" fill="#f5d26b" />
      <path d="M4 3h7v1h-7zM3 4h1v7h-1z" fill="#7c5218" />
      <rect x="2" y="2" width="1" height="1" fill="#52310b" />
      <rect x="8" y="2" width="1" height="1" fill="#52310b" />
      <rect x="2" y="8" width="1" height="1" fill="#52310b" />
    </svg>
  );
};

const PixelRibbonBookmark: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg
    aria-hidden="true"
    viewBox="0 0 10 20"
    shapeRendering="crispEdges"
    className={`pointer-events-none pixelated-canvas ${className}`}
  >
    <path d="M0 0h10v20h-2v-2h-2v-2h-2v2h-2v2h-2z" fill="#210505" />
    <path d="M1 0h8v18h-1v-2h-2v-2h-2v2h-2v2h-1z" fill="#8f1e1e" />
    <rect x="2" y="0" width="2" height="14" fill="#c73a32" />
    <rect x="7" y="0" width="2" height="16" fill="#631111" />
    <rect x="1" y="11" width="8" height="2" fill="#e5ba52" />
    <rect x="2" y="11" width="2" height="1" fill="#fff0a6" />
  </svg>
);

const PixelWaxSeal: React.FC<{ className?: string }> = ({ className = 'w-11 h-11 sm:w-12 sm:h-12' }) => (
  <svg
    aria-hidden="true"
    viewBox="0 0 16 16"
    shapeRendering="crispEdges"
    className={`pixelated-canvas ${className}`}
  >
    <path d="M5 1h6v1h2v1h1v2h1v6h-1v2h-1v1h-2v1h-6v-1h-2v-1h-1v-2h-1v-6h1v-2h1v-1h2z" fill="#2d0909" />
    <path d="M5 2h6v1h2v2h1v6h-1v2h-2v1h-6v-1h-2v-2h-1v-6h1v-2h2z" fill="#9c2222" />
    <path d="M5 2h5v1h-5zM3 4h1v5h-1zM4 3h1v1h-1z" fill="#cf4238" />
    <path d="M5 4h6v1h1v6h-1v1h-6v-1h-1v-6h1z" fill="#701313" />
    <path d="M7 5h2v2h2v2h-2v2h-2v-2h-2v-2h2z" fill="#e6b84c" />
    <rect x="7" y="7" width="2" height="2" fill="#fff1a8" />
  </svg>
);

const PixelDivider: React.FC<{ className?: string }> = ({ className = 'my-2.5' }) => (
  <div aria-hidden="true" className={`flex items-center justify-center gap-2 ${className}`}>
    <span className="h-[2px] flex-1 bg-[#b8965d]" />
    <span className="w-2 h-2 bg-[#8b2222] border border-[#4a180d] rotate-45 shrink-0" />
    <span className="h-[2px] flex-1 bg-[#b8965d]" />
  </div>
);

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
    case 'rebellion':
      return <PowerPixelIcon power="bloodlust_frenzy" className="w-4 h-4 pixelated-canvas shrink-0" />;
    case 'culture':
      return <PowerPixelIcon power="golden_age" className="w-4 h-4 pixelated-canvas shrink-0" />;
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

const stopFlipProp = (e: React.SyntheticEvent) => {
  e.stopPropagation();
};

const LoreEntryVerse: React.FC<{
  entry: LoreEntry;
  onJump?: (x: number, z: number) => void;
}> = ({ entry, onJump }) => {
  const firstChar = entry.body.charAt(0);
  const restBody = entry.body.slice(1);

  return (
    <article className="mb-4 last:mb-0">
      <div className="flex items-baseline justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <LoreEmblemIcon emblem={entry.emblem} />
          <h4 className="text-[13px] sm:text-sm font-bold text-[#2b150b] leading-snug truncate">
            {entry.title}
          </h4>
        </div>

        <div className="flex items-center gap-2 shrink-0 text-[11px] tabular-nums text-[#734d2c]">
          <span>{entry.yearLabel}</span>
          {entry.x !== undefined && entry.z !== undefined && onJump && (
            <button
              type="button"
              onMouseDown={stopFlipProp}
              onTouchStart={stopFlipProp}
              onClick={(e) => {
                e.stopPropagation();
                onJump(entry.x!, entry.z!);
              }}
              title="Behold this place"
              className="text-[#8b2222] hover:text-[#5c1111] font-bold underline underline-offset-2 cursor-pointer"
            >
              Behold
            </button>
          )}
        </div>
      </div>

      <p className="text-[12px] sm:text-[13px] leading-[1.62] text-[#2f1d11]">
        <span className="float-left mr-2 mt-0.5 px-1.5 py-0.5 bg-[#e6cf9c] border-2 border-[#8b5d2b] text-[20px] font-black leading-none text-[#8b2222] shadow-[inset_1px_1px_0_#f9eccb]">
          {firstChar}
        </span>
        {restBody}
      </p>
    </article>
  );
};

function getParchmentUrl(side: 'left' | 'right' | 'single'): string {
  const base = import.meta.env.BASE_URL || '/';
  const normalizedBase = base.endsWith('/') ? base : `${base}/`;
  return `${normalizedBase}assets/lore/parchment_${side}.png`;
}

const PageSurface: React.FC<{
  page: LoreBookPage;
  side: 'left' | 'right' | 'single';
  onSelectChapter: (ch: LoreChapterSummary) => void;
  onJump?: (x: number, z: number) => void;
}> = ({ page, side, onSelectChapter, onJump }) => {
  return (
    <div
      className="lore-parchment w-full h-full px-6 py-5 sm:px-8 sm:py-6 flex flex-col justify-between overflow-hidden select-none"
      style={{ backgroundImage: `url(${getParchmentUrl(side)})` }}
    >
      {page.kind === 'title' && (
        <div className="h-full flex flex-col items-center justify-between text-center px-2 py-2">
          <div className="lore-banner px-3 py-1 text-[10px] tracking-[0.18em] uppercase font-bold">
            The Great Chronicle
          </div>

          <div className="flex-1 flex flex-col items-center justify-center py-2">
            <PixelWaxSeal className="w-11 h-11 sm:w-12 sm:h-12 mb-3" />
            <h2 className="text-xl sm:text-2xl font-black text-[#261209] leading-tight max-w-[250px]">
              {page.worldName}
            </h2>
            <PixelDivider className="w-32 my-2.5" />
            <p className="text-[11.5px] sm:text-xs text-[#543318] leading-relaxed max-w-[235px]">
              {page.epigraph}
            </p>
            <p className="mt-3 text-xs font-bold text-[#8b2222] tabular-nums">
              {page.epochName} · Year {page.year}
            </p>
          </div>

          <p className="text-[11px] text-[#634020] leading-snug max-w-[240px]">
            {page.colophon}
          </p>
        </div>
      )}

      {page.kind === 'toc' && (
        <div className="h-full flex flex-col justify-between">
          <div className="min-h-0 flex-1 flex flex-col">
            <div className="lore-banner px-3 py-1.5 mb-3 text-center">
              <h3 className="text-xs sm:text-sm font-black tracking-[0.12em] uppercase">
                Table of Chapters
              </h3>
            </div>

            <nav aria-label="Lore Book Chapters" className="space-y-1.5 overflow-y-auto flex-1 pr-1">
              {page.chapters.map((ch: LoreChapterSummary) => (
                <button
                  key={`${ch.chapterNumber}_${ch.title}`}
                  type="button"
                  onMouseDown={stopFlipProp}
                  onTouchStart={stopFlipProp}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectChapter(ch);
                  }}
                  className="w-full min-h-[36px] text-left px-2.5 py-1.5 bg-[#cfa974]/60 hover:bg-[#b8894f]/75 border-2 border-[#7b5228] flex items-baseline justify-between gap-2 cursor-pointer"
                >
                  <span className="text-xs sm:text-[13px] font-bold text-[#2b150b] truncate">
                    Chapter {ch.roman} — {ch.title}
                  </span>
                  <span className="text-[11px] font-bold text-[#5d3818] tabular-nums shrink-0">
                    Yr {ch.startYear}
                  </span>
                </button>
              ))}
            </nav>
          </div>

          <p className="text-[11px] text-[#6e4824] tabular-nums pt-2 text-center">
            {page.totalEntries} {page.totalEntries === 1 ? 'tale' : 'tales'} preserved in ink
          </p>
        </div>
      )}

      {page.kind === 'story' && (
        <>
          <div className="flex-1 overflow-y-auto pr-1 min-h-0">
            {page.isChapterStart && (
              <header className="mb-3.5 text-center">
                <div className="lore-banner px-3 py-1 mb-1.5 inline-block max-w-full">
                  <span className="text-[11px] sm:text-xs font-black tracking-wide uppercase truncate block">
                    Ch. {page.chapterRoman} — {page.chapterTitle}
                  </span>
                </div>
                <p className="text-[11px] text-[#5e3a1c] leading-snug">
                  “{page.chapterEpigraph}”
                </p>
                <PixelDivider className="mt-2 mb-1" />
              </header>
            )}
            {page.entries.map((entry) => (
              <LoreEntryVerse key={entry.id} entry={entry} onJump={onJump} />
            ))}
          </div>

          <div
            className={`flex items-center text-[11px] font-bold text-[#7a5230] tabular-nums pt-2 border-t border-[#d8be89] ${
              side === 'left'
                ? 'justify-start'
                : side === 'right'
                  ? 'justify-end'
                  : 'justify-center'
            }`}
          >
            <span>— {page.pageNumber} —</span>
          </div>
        </>
      )}

      {page.kind === 'blank' && (
        <>
          <div className="flex-1 flex flex-col items-center justify-center text-center px-5">
            <HudPixelIcon kind="loreBook" className="w-8 h-8 pixelated-canvas opacity-60 mb-3" />
            <p className="text-xs sm:text-[13px] text-[#6e4826] leading-relaxed max-w-[230px]">
              {page.epilogueQuote}
            </p>
          </div>
          <div className="flex items-center justify-end text-[11px] font-bold text-[#7a5230] tabular-nums pt-2 border-t border-[#d8be89]">
            <span>— {page.pageNumber} —</span>
          </div>
        </>
      )}
    </div>
  );
};

interface DesktopFlipState {
  direction: 'next' | 'prev';
  fromSpread: LoreBookSpread;
  toSpread: LoreBookSpread;
  toIndex: number;
  key: number;
}

interface MobileFlipState {
  direction: 'next' | 'prev';
  fromPage: LoreBookPage;
  toPage: LoreBookPage;
  toIndex: number;
  key: number;
}

const FLIP_MS = 380;

const LoreBookModalInner: React.FC<LoreBookModalProps> = ({
  sim,
  worldName,
  onClose,
  onJumpToLocation,
}) => {
  // Snapshot spreads when opened so background HUD ticks never re-render the book mid-fold
  const { spreads, pages } = useMemo(
    () => buildLoreBookSpreads(sim, worldName),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [worldName],
  );

  const [isMobile, setIsMobile] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 639px)').matches : false,
  );
  const [spreadIndex, setSpreadIndex] = useState<number>(0);
  const [mobilePageIndex, setMobilePageIndex] = useState<number>(0);
  const [desktopFlip, setDesktopFlip] = useState<DesktopFlipState | null>(null);
  const [mobileFlip, setMobileFlip] = useState<MobileFlipState | null>(null);

  const flipTimerRef = useRef<number | null>(null);
  const flipKeyRef = useRef<number>(1);
  const touchStartXRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(max-width: 639px)');
    const onChange = (e: MediaQueryListEvent) => {
      setIsMobile(e.matches);
      setDesktopFlip(null);
      setMobileFlip(null);
    };
    setIsMobile(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    return () => {
      if (flipTimerRef.current !== null) {
        window.clearTimeout(flipTimerRef.current);
      }
    };
  }, []);

  const clampedSpreadIdx = Math.min(spreadIndex, Math.max(0, spreads.length - 1));
  const clampedMobileIdx = Math.min(mobilePageIndex, Math.max(0, pages.length - 1));

  const finishDesktopFlip = useCallback((targetIdx: number) => {
    if (flipTimerRef.current !== null) {
      window.clearTimeout(flipTimerRef.current);
      flipTimerRef.current = null;
    }
    setSpreadIndex(targetIdx);
    setDesktopFlip(null);
  }, []);

  const finishMobileFlip = useCallback((targetIdx: number) => {
    if (flipTimerRef.current !== null) {
      window.clearTimeout(flipTimerRef.current);
      flipTimerRef.current = null;
    }
    setMobilePageIndex(targetIdx);
    setMobileFlip(null);
  }, []);

  const flipToDesktopSpread = useCallback(
    (targetIdx: number) => {
      const baseIdx = desktopFlip ? desktopFlip.toIndex : clampedSpreadIdx;
      const clampedTarget = Math.max(0, Math.min(spreads.length - 1, targetIdx));
      if (clampedTarget === baseIdx) return;

      if (flipTimerRef.current !== null) {
        window.clearTimeout(flipTimerRef.current);
        flipTimerRef.current = null;
      }
      if (desktopFlip) {
        setSpreadIndex(baseIdx);
      }

      const direction: 'next' | 'prev' = clampedTarget > baseIdx ? 'next' : 'prev';
      soundEngine.playPageFlip();
      soundEngine.playClick();
      flipKeyRef.current += 1;
      setDesktopFlip({
        direction,
        fromSpread: spreads[baseIdx],
        toSpread: spreads[clampedTarget],
        toIndex: clampedTarget,
        key: flipKeyRef.current,
      });
      flipTimerRef.current = window.setTimeout(() => {
        finishDesktopFlip(clampedTarget);
      }, FLIP_MS + 40);
    },
    [clampedSpreadIdx, desktopFlip, finishDesktopFlip, spreads],
  );

  const flipToMobilePage = useCallback(
    (targetIdx: number) => {
      const baseIdx = mobileFlip ? mobileFlip.toIndex : clampedMobileIdx;
      const clampedTarget = Math.max(0, Math.min(pages.length - 1, targetIdx));
      if (clampedTarget === baseIdx) return;

      if (flipTimerRef.current !== null) {
        window.clearTimeout(flipTimerRef.current);
        flipTimerRef.current = null;
      }
      if (mobileFlip) {
        setMobilePageIndex(baseIdx);
      }

      const direction: 'next' | 'prev' = clampedTarget > baseIdx ? 'next' : 'prev';
      soundEngine.playPageFlip();
      soundEngine.playClick();
      flipKeyRef.current += 1;
      setMobileFlip({
        direction,
        fromPage: pages[baseIdx],
        toPage: pages[clampedTarget],
        toIndex: clampedTarget,
        key: flipKeyRef.current,
      });
      flipTimerRef.current = window.setTimeout(() => {
        finishMobileFlip(clampedTarget);
      }, FLIP_MS + 40);
    },
    [clampedMobileIdx, finishMobileFlip, mobileFlip, pages],
  );

  const activeDesktopIdx = desktopFlip ? desktopFlip.toIndex : clampedSpreadIdx;
  const activeMobileIdx = mobileFlip ? mobileFlip.toIndex : clampedMobileIdx;

  const handleNext = useCallback(() => {
    if (isMobile) flipToMobilePage(activeMobileIdx + 1);
    else flipToDesktopSpread(activeDesktopIdx + 1);
  }, [activeDesktopIdx, activeMobileIdx, flipToDesktopSpread, flipToMobilePage, isMobile]);

  const handlePrev = useCallback(() => {
    if (isMobile) flipToMobilePage(activeMobileIdx - 1);
    else flipToDesktopSpread(activeDesktopIdx - 1);
  }, [activeDesktopIdx, activeMobileIdx, flipToDesktopSpread, flipToMobilePage, isMobile]);

  const handleGoContents = useCallback(() => {
    if (isMobile) flipToMobilePage(1);
    else flipToDesktopSpread(0);
  }, [flipToDesktopSpread, flipToMobilePage, isMobile]);

  const handleSelectChapter = useCallback(
    (ch: LoreChapterSummary) => {
      if (isMobile) flipToMobilePage(ch.pageIndex);
      else flipToDesktopSpread(ch.spreadIndex);
    },
    [flipToDesktopSpread, flipToMobilePage, isMobile],
  );

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

  const canPrev = isMobile ? activeMobileIdx > 0 : activeDesktopIdx > 0;
  const canNext = isMobile
    ? activeMobileIdx < pages.length - 1
    : activeDesktopIdx < spreads.length - 1;
  const atContents = isMobile ? activeMobileIdx === 1 : activeDesktopIdx === 0;
  const pageCounterText = isMobile
    ? `Page ${activeMobileIdx + 1} / ${pages.length}`
    : `${activeDesktopIdx + 1} / ${spreads.length}`;

  const currentSpread = spreads[clampedSpreadIdx] ?? spreads[0];
  const displayedLeft = desktopFlip
    ? desktopFlip.direction === 'prev'
      ? desktopFlip.toSpread.left
      : desktopFlip.fromSpread.left
    : currentSpread.left;
  const displayedRight = desktopFlip
    ? desktopFlip.direction === 'next'
      ? desktopFlip.toSpread.right
      : desktopFlip.fromSpread.right
    : currentSpread.right;

  const mobileUnderPage = mobileFlip
    ? mobileFlip.direction === 'next'
      ? mobileFlip.toPage
      : mobileFlip.fromPage
    : pages[clampedMobileIdx] ?? pages[0];
  const mobileLeafPage = mobileFlip
    ? mobileFlip.direction === 'next'
      ? mobileFlip.fromPage
      : mobileFlip.toPage
    : null;

  return (
    <div
      data-testid="lore-book-modal"
      className="fixed inset-0 z-[65] bg-black/80 flex items-center justify-center p-2.5 sm:p-6"
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
      <div className="relative w-full max-w-[400px] sm:max-w-[820px] flex flex-col items-center gap-2.5 sm:gap-3">
        {/* Top bar */}
        <div className="w-full flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleGoContents}
              disabled={atContents}
              className="px-btn min-h-[36px] px-3 text-xs font-bold cursor-pointer disabled:opacity-40"
            >
              Contents
            </button>
            <span className="text-xs font-semibold text-[#e6cca0] tabular-nums">
              {pageCounterText}
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

        {/* Pixel-Art Burgundy Leather Tome */}
        <div className="lore-book-cover relative w-full p-2.5 pb-4 sm:p-3.5 sm:pb-5">
          <BrassCornerClasp position="tl" />
          <BrassCornerClasp position="tr" />
          <BrassCornerClasp position="bl" />
          <BrassCornerClasp position="br" />

          <PixelRibbonBookmark
            className={`absolute -top-1.5 z-20 w-4 h-8 sm:w-5 sm:h-10 ${
              isMobile ? 'left-5' : 'left-1/2 -translate-x-1/2'
            }`}
          />

          {/* Thick Stacked Pixel Paper Block */}
          <div className="lore-paper-stack relative px-1.5 py-1 sm:px-2 sm:py-1">
            <div className="relative flex border-2 border-[#5c3b1e] bg-[#f4e2b8] overflow-visible">
              {/* Mobile left leather binding spine */}
              {isMobile && (
                <div
                  aria-hidden="true"
                  className="lore-spine-strip w-3 shrink-0 border-r-2 border-[#22070a] z-10"
                />
              )}

              {/* GPU 3D Book Stage */}
              <div className="lore-stage flex-1 min-w-0 h-[min(62dvh,460px)] sm:h-[460px]">
                {isMobile ? (
                  <div className="relative w-full h-full">
                    <div className="w-full h-full overflow-hidden">
                      <PageSurface
                        page={mobileUnderPage}
                        side="single"
                        onSelectChapter={handleSelectChapter}
                        onJump={handleJump}
                      />
                    </div>
                    {mobileFlip && mobileLeafPage && (
                      <div
                        key={mobileFlip.key}
                        aria-hidden="true"
                        onAnimationEnd={(e) => {
                          if (e.target === e.currentTarget) {
                            finishMobileFlip(mobileFlip.toIndex);
                          }
                        }}
                        className={`pointer-events-none absolute inset-0 z-40 lore-flip-leaf ${
                          mobileFlip.direction === 'next'
                            ? 'lore-flip-mobile-next'
                            : 'lore-flip-mobile-prev'
                        }`}
                      >
                        <div className="absolute inset-0 overflow-hidden shadow-lg">
                          <PageSurface
                            page={mobileLeafPage}
                            side="single"
                            onSelectChapter={() => {}}
                          />
                          <div className="lore-flip-shade absolute inset-0 bg-[#2b150b] pointer-events-none" />
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="relative grid grid-cols-2 w-full h-full">
                    {/* Static Left Page */}
                    <div className="relative h-full border-r-2 border-[#6e4624] overflow-hidden">
                      <PageSurface
                        page={displayedLeft}
                        side="left"
                        onSelectChapter={handleSelectChapter}
                        onJump={handleJump}
                      />
                      {canPrev && (
                        <button
                          type="button"
                          aria-label="Previous page"
                          onClick={handlePrev}
                          className="absolute bottom-0 left-0 w-12 h-12 cursor-pointer group"
                          title="Previous page (←)"
                        >
                          <span className="block absolute bottom-0 left-0 w-4 h-4 bg-[#d9c190] border-t-2 border-r-2 border-[#8c693c] opacity-65 group-hover:opacity-100 transition-opacity" />
                        </button>
                      )}
                    </div>

                    {/* Static Right Page */}
                    <div className="relative h-full overflow-hidden">
                      <PageSurface
                        page={displayedRight}
                        side="right"
                        onSelectChapter={handleSelectChapter}
                        onJump={handleJump}
                      />
                      {canNext && (
                        <button
                          type="button"
                          aria-label="Next page"
                          onClick={handleNext}
                          className="absolute bottom-0 right-0 w-12 h-12 cursor-pointer group"
                          title="Next page (→)"
                        >
                          <span className="block absolute bottom-0 right-0 w-4 h-4 bg-[#d9c190] border-t-2 border-l-2 border-[#8c693c] opacity-65 group-hover:opacity-100 transition-opacity" />
                        </button>
                      )}
                    </div>

                    {/* Center Leather Spine Seam */}
                    <div
                      aria-hidden="true"
                      className="lore-spine-strip pointer-events-none absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-2 z-20 opacity-75"
                    />

                    {/* GPU-Accelerated 3D Turning Leaf (Forward & Backward Symmetric Fold) */}
                    {desktopFlip && (
                      <div
                        key={desktopFlip.key}
                        aria-hidden="true"
                        onAnimationEnd={(e) => {
                          if (e.target === e.currentTarget) {
                            finishDesktopFlip(desktopFlip.toIndex);
                          }
                        }}
                        className={`pointer-events-none absolute top-0 bottom-0 w-1/2 z-50 lore-flip-leaf ${
                          desktopFlip.direction === 'next'
                            ? 'left-1/2 lore-flip-next'
                            : 'left-0 lore-flip-prev'
                        }`}
                      >
                        {/* Front face of the turning leaf */}
                        <div className="lore-flip-face absolute inset-0 border-x border-[#6e4624] overflow-hidden shadow-xl">
                          <PageSurface
                            page={
                              desktopFlip.direction === 'next'
                                ? desktopFlip.fromSpread.right
                                : desktopFlip.fromSpread.left
                            }
                            side={desktopFlip.direction === 'next' ? 'right' : 'left'}
                            onSelectChapter={() => {}}
                          />
                          <div className="lore-flip-shade absolute inset-0 bg-[#2b150b] pointer-events-none" />
                        </div>
                        {/* Back face of the turning leaf */}
                        <div className="lore-flip-face lore-flip-back absolute inset-0 border-x border-[#6e4624] overflow-hidden shadow-xl">
                          <PageSurface
                            page={
                              desktopFlip.direction === 'next'
                                ? desktopFlip.toSpread.left
                                : desktopFlip.toSpread.right
                            }
                            side={desktopFlip.direction === 'next' ? 'left' : 'right'}
                            onSelectChapter={() => {}}
                          />
                          <div className="lore-flip-shade absolute inset-0 bg-[#2b150b] pointer-events-none" />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Page-Turn Controls (44px+ touch targets) */}
        <div className="w-full flex items-center justify-between gap-2">
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

export const LoreBookModal = React.memo(
  LoreBookModalInner,
  (prev, next) => prev.sim === next.sim && prev.worldName === next.worldName,
);
