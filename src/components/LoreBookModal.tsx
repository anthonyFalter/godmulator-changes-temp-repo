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

interface DesktopFlipState {
  mode: 'desktop';
  direction: 'next' | 'prev';
  fromSpread: LoreBookSpread;
  toSpread: LoreBookSpread;
  toIndex: number;
  key: number;
}

interface MobileFlipState {
  mode: 'mobile';
  direction: 'next' | 'prev';
  fromPage: LoreBookPage;
  toPage: LoreBookPage;
  toIndex: number;
  key: number;
}

type FlipTransitionState = DesktopFlipState | MobileFlipState;

const DESKTOP_FLIP_MS = 580;
const MOBILE_FLIP_MS = 520;

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
      className={`pointer-events-none absolute ${posClass} w-6 h-6 sm:w-7 sm:h-7 z-30 pixelated-canvas`}
    >
      {/* Dark pixel outline */}
      <path d="M0 0h12v4h-5v1h-2v2h-1v5h-4z" fill="#140804" />
      {/* Base hammered brass */}
      <path d="M1 1h10v2h-6v1h-1v1h-1v6h-2z" fill="#c79538" />
      {/* Specular gold top-left highlight */}
      <path d="M1 1h9v1h-8v8h-1z" fill="#f5d26b" />
      {/* Inner shadow bevel */}
      <path d="M4 3h7v1h-7zM3 4h1v7h-1z" fill="#7c5218" />
      {/* 3 tiny brass rivets */}
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
    {/* Outline */}
    <path d="M0 0h10v20h-2v-2h-2v-2h-2v2h-2v2h-2z" fill="#210505" />
    {/* Deep crimson silk */}
    <path d="M1 0h8v18h-1v-2h-2v-2h-2v2h-2v2h-1z" fill="#8f1e1e" />
    {/* Silk sheen highlight */}
    <rect x="2" y="0" width="2" height="14" fill="#c73a32" />
    {/* Shadow edge */}
    <rect x="7" y="0" width="2" height="16" fill="#631111" />
    {/* Gold woven stripe near bottom */}
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
    {/* Outer wax silhouette */}
    <path d="M5 1h6v1h2v1h1v2h1v6h-1v2h-1v1h-2v1h-6v-1h-2v-1h-1v-2h-1v-6h1v-2h1v-1h2z" fill="#2d0909" />
    {/* Crimson wax body */}
    <path d="M5 2h6v1h2v2h1v6h-1v2h-2v1h-6v-1h-2v-2h-1v-6h1v-2h2z" fill="#9c2222" />
    {/* Raised wax rim highlight */}
    <path d="M5 2h5v1h-5zM3 4h1v5h-1zM4 3h1v1h-1z" fill="#cf4238" />
    {/* Inner recessed stamp circle */}
    <path d="M5 4h6v1h1v6h-1v1h-6v-1h-1v-6h1z" fill="#701313" />
    {/* Golden 4-point star/crown crest */}
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
    <article className="mb-5 last:mb-0">
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
              onClick={() => onJump(entry.x!, entry.z!)}
              title="Behold this place"
              className="text-[#8b2222] hover:text-[#5c1111] font-bold underline underline-offset-2 cursor-pointer"
            >
              Behold
            </button>
          )}
        </div>
      </div>

      <p className="text-[12.5px] sm:text-[13px] leading-[1.68] text-[#2f1d11] font-serif">
        <span className="float-left mr-2 mt-0.5 px-1.5 py-0.5 bg-[#e6cf9c] border-2 border-[#8b5d2b] text-[22px] font-black leading-none text-[#8b2222] shadow-[inset_1px_1px_0_#f9eccb]">
          {firstChar}
        </span>
        {restBody}
      </p>
    </article>
  );
};

const PageSurface: React.FC<{
  page: LoreBookPage;
  side: 'left' | 'right' | 'single';
  onSelectChapter: (ch: LoreChapterSummary) => void;
  onJump?: (x: number, z: number) => void;
}> = ({ page, side, onSelectChapter, onJump }) => {
  const sideClass =
    side === 'left'
      ? 'lore-parchment-left'
      : side === 'right'
        ? 'lore-parchment-right'
        : 'lore-parchment-single';

  return (
    <div
      className={`lore-parchment w-full h-full px-5 py-5 sm:px-7 sm:py-6 flex flex-col justify-between overflow-hidden select-none ${sideClass}`}
    >
      {page.kind === 'title' && (
        <div className="h-full flex flex-col items-center justify-between text-center border-2 border-[#c8ab73] p-4 sm:p-5 bg-[#f7ead0]/45">
          <div className="text-[10px] tracking-[0.22em] uppercase font-bold text-[#7d552c]">
            The Great Chronicle of
          </div>

          <div className="flex-1 flex flex-col items-center justify-center py-2">
            <PixelWaxSeal className="w-11 h-11 sm:w-12 sm:h-12 mb-3" />
            <h2 className="text-xl sm:text-2xl font-black font-serif text-[#261209] leading-tight max-w-[260px]">
              {page.worldName}
            </h2>
            <PixelDivider className="w-32 my-2.5" />
            <p className="text-[11.5px] sm:text-xs italic font-serif text-[#5e3b1c] leading-relaxed max-w-[240px]">
              {page.epigraph}
            </p>
            <p className="mt-3 text-xs font-bold text-[#8b2222] tabular-nums">
              {page.epochName} · Year {page.year}
            </p>
          </div>

          <p className="text-[11px] font-serif italic text-[#6d4826] leading-snug max-w-[250px]">
            {page.colophon}
          </p>
        </div>
      )}

      {page.kind === 'toc' && (
        <div className="h-full flex flex-col justify-between">
          <div className="min-h-0 flex-1 flex flex-col">
            <div className="text-center mb-1">
              <h3 className="text-base sm:text-lg font-black font-serif text-[#261209] tracking-wide">
                Table of Chapters
              </h3>
            </div>
            <PixelDivider className="mt-1 mb-3" />

            <nav aria-label="Lore Book Chapters" className="space-y-1 overflow-y-auto flex-1 pr-1">
              {page.chapters.map((ch: LoreChapterSummary) => (
                <button
                  key={`${ch.chapterNumber}_${ch.title}`}
                  type="button"
                  onClick={() => onSelectChapter(ch)}
                  className="w-full min-h-[40px] text-left px-2.5 py-2 hover:bg-[#e5d0a1] border-b border-dashed border-[#cfb480] flex items-baseline justify-between gap-2 cursor-pointer transition-colors"
                >
                  <span className="text-xs sm:text-[13px] font-bold font-serif text-[#2b150b] truncate">
                    Chapter {ch.roman} — {ch.title}
                  </span>
                  <span className="text-[11px] font-semibold text-[#734d2c] tabular-nums shrink-0">
                    Yr {ch.startYear}
                  </span>
                </button>
              ))}
            </nav>
          </div>

          <p className="text-[11px] font-serif italic text-[#7a5230] tabular-nums pt-2 text-center">
            {page.totalEntries} {page.totalEntries === 1 ? 'tale' : 'tales'} preserved in ink
          </p>
        </div>
      )}

      {page.kind === 'story' && (
        <>
          <div className="flex-1 overflow-y-auto pr-1 min-h-0">
            {page.isChapterStart && (
              <header className="mb-4 text-center">
                <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#7d552c]">
                  Chapter {page.chapterRoman}
                </p>
                <h3 className="text-sm sm:text-base font-black font-serif text-[#8b2222] leading-snug">
                  {page.chapterTitle}
                </h3>
                <p className="text-[11px] italic font-serif text-[#6b4624] mt-0.5 leading-snug">
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
            className={`flex items-center text-[11px] font-bold font-serif text-[#7a5230] tabular-nums pt-2 border-t border-[#d8be89] ${
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
            <p className="text-xs sm:text-[13px] italic font-serif text-[#6e4826] leading-relaxed max-w-[230px]">
              {page.epilogueQuote}
            </p>
          </div>
          <div className="flex items-center justify-end text-[11px] font-bold font-serif text-[#7a5230] tabular-nums pt-2 border-t border-[#d8be89]">
            <span>— {page.pageNumber} —</span>
          </div>
        </>
      )}
    </div>
  );
};

/**
 * 4-segment articulated 3D curved turning leaf.
 * Each vertical 25% strip is nested inside the previous strip with its own Y-rotation
 * bend keyframe, producing a smooth physical paper arch as the page turns.
 */
const CurvedTurningLeaf: React.FC<{
  frontPage: LoreBookPage;
  frontSide: 'left' | 'right' | 'single';
  backPage: LoreBookPage | null;
  backSide: 'left' | 'right' | 'single';
  animPrefix: 'lore-anim-next' | 'lore-anim-prev' | 'lore-anim-mob-next' | 'lore-anim-mob-prev';
  hinge: 'left' | 'right';
}> = ({ frontPage, frontSide, backPage, backSide, animPrefix, hinge }) => {
  const renderSegment = (segIndex: number): React.ReactNode => {
    const isHingeLeft = hinge === 'left';
    const frontSliceIdx = isHingeLeft ? segIndex : 3 - segIndex;
    const backSliceIdx = isHingeLeft ? 3 - segIndex : segIndex;

    const posStyle: React.CSSProperties =
      segIndex === 0
        ? isHingeLeft
          ? { left: 0, width: '25%' }
          : { right: 0, width: '25%' }
        : isHingeLeft
          ? { left: '100%', width: '100%' }
          : { right: '100%', width: '100%' };

    // Subtle curved-crest lighting gradient across each strip
    const shadeBg =
      segIndex === 1 || segIndex === 2
        ? 'linear-gradient(90deg, rgba(46,24,8,0.12) 0%, rgba(255,248,224,0.22) 50%, rgba(46,24,8,0.22) 100%)'
        : 'linear-gradient(90deg, rgba(46,24,8,0.22) 0%, rgba(255,248,224,0.10) 100%)';

    return (
      <div
        className={`lore-curl-seg absolute top-0 bottom-0 ${animPrefix}-${segIndex}`}
        style={posStyle}
      >
        {/* Front Face Slice */}
        <div className="lore-curl-face absolute inset-0 overflow-hidden">
          <div
            className="absolute top-0 bottom-0"
            style={{ width: '400%', left: `${-frontSliceIdx * 100}%` }}
          >
            <PageSurface page={frontPage} side={frontSide} onSelectChapter={() => {}} />
          </div>
          <div
            aria-hidden="true"
            className="lore-curl-shade-overlay pointer-events-none absolute inset-0"
            style={{ background: shadeBg }}
          />
        </div>

        {/* Back Face Slice */}
        <div className="lore-curl-face lore-curl-back absolute inset-0 overflow-hidden bg-[#ecd8ae]">
          {backPage && (
            <div
              className="absolute top-0 bottom-0"
              style={{ width: '400%', left: `${-backSliceIdx * 100}%` }}
            >
              <PageSurface page={backPage} side={backSide} onSelectChapter={() => {}} />
            </div>
          )}
          <div
            aria-hidden="true"
            className="lore-curl-shade-overlay pointer-events-none absolute inset-0"
            style={{ background: shadeBg }}
          />
        </div>

        {/* Next articulated child strip */}
        {segIndex < 3 && renderSegment(segIndex + 1)}
      </div>
    );
  };

  return <>{renderSegment(0)}</>;
};

export const LoreBookModal: React.FC<LoreBookModalProps> = ({
  sim,
  worldName,
  onClose,
  onJumpToLocation,
}) => {
  const { spreads, pages } = useMemo(
    () => buildLoreBookSpreads(sim, worldName),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sim, sim.loreBook?.entries.length, sim.chronicle.length, worldName],
  );

  const [isMobile, setIsMobile] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 639px)').matches : false,
  );
  const [spreadIndex, setSpreadIndex] = useState<number>(0);
  const [mobilePageIndex, setMobilePageIndex] = useState<number>(0);
  const [flip, setFlip] = useState<FlipTransitionState | null>(null);
  const flipTimerRef = useRef<number | null>(null);
  const flipKeyRef = useRef<number>(1);
  const touchStartXRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(max-width: 639px)');
    const onChange = (e: MediaQueryListEvent) => {
      setIsMobile(e.matches);
      setFlip(null);
      if (flipTimerRef.current !== null) {
        window.clearTimeout(flipTimerRef.current);
        flipTimerRef.current = null;
      }
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
  const currentSpread = spreads[clampedSpreadIdx] ?? spreads[0];
  const currentMobilePage = pages[clampedMobileIdx] ?? pages[0];

  const triggerDesktopFlipTo = useCallback(
    (targetIdx: number) => {
      const baseIndex = flip?.mode === 'desktop' ? flip.toIndex : clampedSpreadIdx;
      const clampedTarget = Math.max(0, Math.min(spreads.length - 1, targetIdx));
      if (clampedTarget === baseIndex) return;

      if (flipTimerRef.current !== null) {
        window.clearTimeout(flipTimerRef.current);
        flipTimerRef.current = null;
      }
      if (flip?.mode === 'desktop') {
        setSpreadIndex(baseIndex);
      }

      const direction: 'next' | 'prev' = clampedTarget > baseIndex ? 'next' : 'prev';
      soundEngine.playPageFlip();
      soundEngine.playClick();
      flipKeyRef.current += 1;
      setFlip({
        mode: 'desktop',
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
      }, DESKTOP_FLIP_MS);
    },
    [clampedSpreadIdx, flip, spreads],
  );

  const triggerMobileFlipTo = useCallback(
    (targetIdx: number) => {
      const baseIndex = flip?.mode === 'mobile' ? flip.toIndex : clampedMobileIdx;
      const clampedTarget = Math.max(0, Math.min(pages.length - 1, targetIdx));
      if (clampedTarget === baseIndex) return;

      if (flipTimerRef.current !== null) {
        window.clearTimeout(flipTimerRef.current);
        flipTimerRef.current = null;
      }
      if (flip?.mode === 'mobile') {
        setMobilePageIndex(baseIndex);
      }

      const direction: 'next' | 'prev' = clampedTarget > baseIndex ? 'next' : 'prev';
      soundEngine.playPageFlip();
      soundEngine.playClick();
      flipKeyRef.current += 1;
      setFlip({
        mode: 'mobile',
        direction,
        fromPage: pages[baseIndex],
        toPage: pages[clampedTarget],
        toIndex: clampedTarget,
        key: flipKeyRef.current,
      });
      flipTimerRef.current = window.setTimeout(() => {
        setMobilePageIndex(clampedTarget);
        setFlip(null);
        flipTimerRef.current = null;
      }, MOBILE_FLIP_MS);
    },
    [clampedMobileIdx, flip, pages],
  );

  const activeDesktopIdx = flip?.mode === 'desktop' ? flip.toIndex : clampedSpreadIdx;
  const activeMobileIdx = flip?.mode === 'mobile' ? flip.toIndex : clampedMobileIdx;

  const handleNext = useCallback(() => {
    if (isMobile) triggerMobileFlipTo(activeMobileIdx + 1);
    else triggerDesktopFlipTo(activeDesktopIdx + 1);
  }, [activeDesktopIdx, activeMobileIdx, isMobile, triggerDesktopFlipTo, triggerMobileFlipTo]);

  const handlePrev = useCallback(() => {
    if (isMobile) triggerMobileFlipTo(activeMobileIdx - 1);
    else triggerDesktopFlipTo(activeDesktopIdx - 1);
  }, [activeDesktopIdx, activeMobileIdx, isMobile, triggerDesktopFlipTo, triggerMobileFlipTo]);

  const handleGoContents = useCallback(() => {
    if (isMobile) triggerMobileFlipTo(1);
    else triggerDesktopFlipTo(0);
  }, [isMobile, triggerDesktopFlipTo, triggerMobileFlipTo]);

  const handleSelectChapter = useCallback(
    (ch: LoreChapterSummary) => {
      if (isMobile) triggerMobileFlipTo(ch.pageIndex);
      else triggerDesktopFlipTo(ch.spreadIndex);
    },
    [isMobile, triggerDesktopFlipTo, triggerMobileFlipTo],
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

  const desktopFlip = flip?.mode === 'desktop' ? flip : null;
  const mobileFlip = flip?.mode === 'mobile' ? flip : null;

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

  // On mobile: during NEXT flip, show target page underneath while old page curls off;
  // during PREV flip, show old page underneath while target page unfurls on top.
  const displayedMobileUnder = mobileFlip
    ? mobileFlip.direction === 'next'
      ? mobileFlip.toPage
      : mobileFlip.fromPage
    : currentMobilePage;

  const canPrev = isMobile ? activeMobileIdx > 0 : activeDesktopIdx > 0;
  const canNext = isMobile
    ? activeMobileIdx < pages.length - 1
    : activeDesktopIdx < spreads.length - 1;
  const atContents = isMobile ? activeMobileIdx === 1 : activeDesktopIdx === 0;
  const pageCounterText = isMobile
    ? `Page ${activeMobileIdx + 1} / ${pages.length}`
    : `${activeDesktopIdx + 1} / ${spreads.length}`;

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
        if (dx <= -42) handleNext();
        else if (dx >= 42) handlePrev();
      }}
    >
      <div className="relative w-full max-w-[430px] sm:max-w-[820px] flex flex-col items-center gap-2.5 sm:gap-3">
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

        {/* Pixel-Art Leather Tome */}
        <div className="lore-book-cover relative w-full p-2.5 pb-4 sm:p-3.5 sm:pb-5">
          {/* 4 Hammered Brass Pixel Corner Clasps */}
          <BrassCornerClasp position="tl" />
          <BrassCornerClasp position="tr" />
          <BrassCornerClasp position="bl" />
          <BrassCornerClasp position="br" />

          {/* Pixel-Art Crimson Silk Bookmark Ribbon */}
          <PixelRibbonBookmark
            className={`absolute -top-1.5 z-30 w-4 h-8 sm:w-5 sm:h-10 ${
              isMobile ? 'left-5' : 'left-1/2 -translate-x-1/2'
            }`}
          />

          {/* Thick Stacked Pixel Paper Block */}
          <div className="lore-paper-stack relative px-1.5 py-1 sm:px-2 sm:py-1">
            {isMobile ? (
              /* MOBILE: Single-Page Pixel Tome with Left Leather Spine + Curved 3D Page Curl */
              <div className="lore-stage relative flex h-[min(64dvh,470px)] border-2 border-[#5c3b1e] bg-[#f4e4c1]">
                {/* Left Leather Binding Spine */}
                <div aria-hidden="true" className="lore-spine-strip w-3 shrink-0 border-r-2 border-[#1c0b05]" />

                {/* Active Single Page */}
                <div className="relative flex-1 h-full overflow-hidden">
                  <PageSurface
                    page={displayedMobileUnder}
                    side="single"
                    onSelectChapter={handleSelectChapter}
                    onJump={handleJump}
                  />

                  {/* Subtle cast shadow on underlying page during mobile curl */}
                  {mobileFlip && (
                    <div
                      key={`mob-sh-${mobileFlip.key}`}
                      aria-hidden="true"
                      className="lore-under-shadow-overlay pointer-events-none absolute inset-0 bg-gradient-to-r from-[#261106]/40 via-[#261106]/15 to-transparent"
                    />
                  )}

                  {/* Dog-eared corner tap targets on mobile */}
                  {canPrev && (
                    <button
                      type="button"
                      aria-label="Previous page"
                      onClick={handlePrev}
                      className="absolute bottom-0 left-0 w-10 h-10 cursor-pointer"
                    >
                      <span className="block absolute bottom-0 left-0 w-3.5 h-3.5 bg-[#d9c190] border-t-2 border-r-2 border-[#8c693c] opacity-70" />
                    </button>
                  )}
                  {canNext && (
                    <button
                      type="button"
                      aria-label="Next page"
                      onClick={handleNext}
                      className="absolute bottom-0 right-0 w-10 h-10 cursor-pointer"
                    >
                      <span className="block absolute bottom-0 right-0 w-3.5 h-3.5 bg-[#d9c190] border-t-2 border-l-2 border-[#8c693c] opacity-70" />
                    </button>
                  )}

                  {/* 4-Segment Curved 3D Mobile Turning Leaf */}
                  {mobileFlip && (
                    <div
                      key={mobileFlip.key}
                      aria-hidden="true"
                      className="lore-curl-root pointer-events-none absolute inset-0 z-30"
                    >
                      <CurvedTurningLeaf
                        frontPage={
                          mobileFlip.direction === 'next' ? mobileFlip.fromPage : mobileFlip.toPage
                        }
                        frontSide="single"
                        backPage={null}
                        backSide="single"
                        animPrefix={
                          mobileFlip.direction === 'next'
                            ? 'lore-anim-mob-next'
                            : 'lore-anim-mob-prev'
                        }
                        hinge="left"
                      />
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* DESKTOP: Open 2-Page Spread with Center Gold-Banded Spine + Curved 3D Page Curl */
              <div className="lore-stage relative grid grid-cols-2 h-[460px] max-h-[70vh] border-2 border-[#5c3b1e] bg-[#f4e4c1]">
                {/* Left Page */}
                <div className="relative h-full border-r border-[#6e4624] overflow-hidden">
                  <PageSurface
                    page={displayedLeft}
                    side="left"
                    onSelectChapter={handleSelectChapter}
                    onJump={handleJump}
                  />
                  {desktopFlip?.direction === 'prev' && (
                    <div
                      key={`lsh-${desktopFlip.key}`}
                      aria-hidden="true"
                      className="lore-under-shadow-overlay pointer-events-none absolute inset-0 bg-gradient-to-l from-[#261106]/35 via-[#261106]/10 to-transparent"
                    />
                  )}
                  {canPrev && (
                    <button
                      type="button"
                      aria-label="Previous page"
                      onClick={handlePrev}
                      className="absolute bottom-0 left-0 w-11 h-11 cursor-pointer group"
                      title="Previous page"
                    >
                      <span className="block absolute bottom-0 left-0 w-4 h-4 bg-[#d9c190] border-t-2 border-r-2 border-[#8c693c] opacity-65 group-hover:opacity-100 transition-opacity" />
                    </button>
                  )}
                </div>

                {/* Right Page */}
                <div className="relative h-full border-l border-[#6e4624] overflow-hidden">
                  <PageSurface
                    page={displayedRight}
                    side="right"
                    onSelectChapter={handleSelectChapter}
                    onJump={handleJump}
                  />
                  {desktopFlip?.direction === 'next' && (
                    <div
                      key={`rsh-${desktopFlip.key}`}
                      aria-hidden="true"
                      className="lore-under-shadow-overlay pointer-events-none absolute inset-0 bg-gradient-to-r from-[#261106]/35 via-[#261106]/10 to-transparent"
                    />
                  )}
                  {canNext && (
                    <button
                      type="button"
                      aria-label="Next page"
                      onClick={handleNext}
                      className="absolute bottom-0 right-0 w-11 h-11 cursor-pointer group"
                      title="Next page"
                    >
                      <span className="block absolute bottom-0 right-0 w-4 h-4 bg-[#d9c190] border-t-2 border-l-2 border-[#8c693c] opacity-65 group-hover:opacity-100 transition-opacity" />
                    </button>
                  )}
                </div>

                {/* Center Pixel-Art Leather Spine Gutter */}
                <div
                  aria-hidden="true"
                  className="lore-spine-strip pointer-events-none absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-2.5 z-20 opacity-90"
                />

                {/* 4-Segment Articulated Curved 3D Turning Leaf */}
                {desktopFlip && (
                  <div
                    key={desktopFlip.key}
                    aria-hidden="true"
                    className={`lore-curl-root pointer-events-none absolute top-0 bottom-0 w-1/2 z-30 ${
                      desktopFlip.direction === 'next' ? 'left-1/2' : 'left-0'
                    }`}
                  >
                    <CurvedTurningLeaf
                      frontPage={
                        desktopFlip.direction === 'next'
                          ? desktopFlip.fromSpread.right
                          : desktopFlip.fromSpread.left
                      }
                      frontSide={desktopFlip.direction === 'next' ? 'right' : 'left'}
                      backPage={
                        desktopFlip.direction === 'next'
                          ? desktopFlip.toSpread.left
                          : desktopFlip.toSpread.right
                      }
                      backSide={desktopFlip.direction === 'next' ? 'left' : 'right'}
                      animPrefix={
                        desktopFlip.direction === 'next' ? 'lore-anim-next' : 'lore-anim-prev'
                      }
                      hinge={desktopFlip.direction === 'next' ? 'left' : 'right'}
                    />
                  </div>
                )}
              </div>
            )}
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
          <span className="text-[11px] text-[#cbb286] sm:hidden">Swipe to turn</span>
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
