import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { PageFlip } from 'page-flip/dist/js/page-flip.module.js';
import {
  buildLoreBookSpreads,
  LoreBookPage,
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
      return <PowerPixelIcon power="floral_paradise" className="w-4 h-4 pixelated-canvas shrink-0" />;
    case 'peace':
      return <PowerPixelIcon power="harmony_dove" className="w-4 h-4 pixelated-canvas shrink-0" />;
    case 'divine':
      return <PowerPixelIcon power="blessing" className="w-4 h-4 pixelated-canvas shrink-0" />;
    case 'wonder':
      return <PowerPixelIcon power="bountiful_harvest" className="w-4 h-4 pixelated-canvas shrink-0" />;
    case 'kingdom':
      return <PowerPixelIcon power="divine_shield" className="w-4 h-4 pixelated-canvas shrink-0" />;
    case 'epoch':
      return <PowerPixelIcon power="chrono_surge" className="w-4 h-4 pixelated-canvas shrink-0" />;
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

const LoreBookModalInner: React.FC<LoreBookModalProps> = ({
  sim,
  worldName,
  onClose,
  onJumpToLocation,
}) => {
  // Snapshot spreads when opened so background HUD ticks never re-render portaled StPageFlip pages mid-fold
  const { spreads, pages } = useMemo(
    () => buildLoreBookSpreads(sim, worldName),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [worldName],
  );

  // Flattened full page list (even count on desktop spreads so left+right pair cleanly)
  const bookPages = useMemo<LoreBookPage[]>(() => {
    const out: LoreBookPage[] = [];
    for (const sp of spreads) {
      out.push(sp.left, sp.right);
    }
    return out;
  }, [spreads]);

  const [isMobile, setIsMobile] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 639px)').matches : false,
  );
  const [currentPage, setCurrentPage] = useState<number>(0);
  const [portalNodes, setPortalNodes] = useState<HTMLDivElement[]>([]);

  const stageRef = useRef<HTMLDivElement | null>(null);
  const pageFlipRef = useRef<PageFlip | null>(null);
  const currentPageRef = useRef<number>(0);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(max-width: 639px)');
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    setIsMobile(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const activePages = isMobile ? pages : bookPages;
  const pageCount = activePages.length;

  // Mount StPageFlip into a dedicated DOM host & portal React page surfaces into its page nodes.
  // This gives real physical curved corner-peeling physics with zero React DOM-reconciliation conflicts.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || pageCount === 0) return;

    const innerHost = document.createElement('div');
    innerHost.style.width = '100%';
    innerHost.style.height = '100%';
    stage.appendChild(innerHost);

    const nodes: HTMLDivElement[] = [];
    for (let i = 0; i < pageCount; i++) {
      const div = document.createElement('div');
      div.className = 'lore-pf-page w-full h-full overflow-hidden';
      div.style.contain = 'layout style';
      innerHost.appendChild(div);
      nodes.push(div);
    }
    setPortalNodes(nodes);

    const startIdx = Math.min(currentPageRef.current, pageCount - 1);
    const pf = new PageFlip(innerHost, {
      startPage: startIdx,
      width: isMobile ? 340 : 380,
      height: isMobile ? 460 : 460,
      size: 'stretch',
      minWidth: 240,
      maxWidth: isMobile ? 420 : 440,
      minHeight: 340,
      maxHeight: 520,
      drawShadow: true,
      maxShadowOpacity: 0.24,
      flippingTime: 650,
      usePortrait: isMobile,
      startZIndex: 50,
      autoSize: true,
      showCover: false,
      mobileScrollSupport: true,
      clickEventForward: true,
      useMouseEvents: true,
      swipeDistance: 26,
      showPageCorners: true,
      disableFlipByClick: false,
    });

    pf.loadFromHTML(nodes);
    pf.on('flip', (e) => {
      const idx = typeof e.data === 'number' ? e.data : pf.getCurrentPageIndex();
      currentPageRef.current = idx;
      setCurrentPage(idx);
      soundEngine.playPageFlip();
    });

    pageFlipRef.current = pf;
    setCurrentPage(startIdx);

    return () => {
      pageFlipRef.current = null;
      setPortalNodes([]);
      try {
        pf.destroy();
      } catch {
        // Ignore teardown race if already removed
      }
      if (innerHost.parentNode === stage) {
        stage.removeChild(innerHost);
      }
    };
  }, [isMobile, pageCount]);

  // Symmetric rect-aware curved corner flips for both Next and Previous
  // (fixes StPageFlip's hardcoded x: 10 bug in flipPrev and aligns both directions identically)
  const triggerAnimatedTurn = useCallback((pf: PageFlip, direction: 'next' | 'prev') => {
    const internal = pf as unknown as {
      getBoundsRect?: () => { left: number; top?: number; width: number; pageWidth: number; height: number };
      getFlipController?: () => { flip?: (pos: { x: number; y: number }) => void };
    };
    try {
      const rect = internal.getBoundsRect?.();
      const ctrl = internal.getFlipController?.();
      if (rect && ctrl && typeof ctrl.flip === 'function') {
        const y = Math.max(8, (rect.top ?? 0) + rect.height - 8);
        const x =
          direction === 'next'
            ? rect.left + rect.pageWidth * 2 - 12
            : Math.max(8, rect.left + 12);
        ctrl.flip({ x, y });
        return;
      }
    } catch {
      // Fallback to built-in helpers
    }
    if (direction === 'next') {
      pf.flipNext('bottom');
    } else {
      pf.flipPrev('bottom');
    }
  }, []);

  const triggerAnimatedToPage = useCallback(
    (pf: PageFlip, target: number) => {
      const cur = pf.getCurrentPageIndex();
      if (target < cur) {
        const internal = pf as unknown as {
          getPageCollection?: () => {
            getSpreadIndexByPage: (p: number) => number;
            setCurrentSpreadIndex: (s: number) => void;
          };
        };
        try {
          const pc = internal.getPageCollection?.();
          if (pc) {
            const targetSpread = pc.getSpreadIndexByPage(target);
            pc.setCurrentSpreadIndex(targetSpread + 1);
            triggerAnimatedTurn(pf, 'prev');
            return;
          }
        } catch {
          // Fallback below
        }
        pf.flip(target, 'bottom');
      } else if (target > cur) {
        const internal = pf as unknown as {
          getPageCollection?: () => {
            getSpreadIndexByPage: (p: number) => number;
            setCurrentSpreadIndex: (s: number) => void;
          };
        };
        try {
          const pc = internal.getPageCollection?.();
          if (pc) {
            const targetSpread = pc.getSpreadIndexByPage(target);
            pc.setCurrentSpreadIndex(Math.max(0, targetSpread - 1));
            triggerAnimatedTurn(pf, 'next');
            return;
          }
        } catch {
          // Fallback below
        }
        pf.flip(target, 'bottom');
      }
    },
    [triggerAnimatedTurn],
  );

  const handleNext = useCallback(() => {
    const pf = pageFlipRef.current;
    if (!pf) return;
    soundEngine.playClick();
    triggerAnimatedTurn(pf, 'next');
  }, [triggerAnimatedTurn]);

  const handlePrev = useCallback(() => {
    const pf = pageFlipRef.current;
    if (!pf) return;
    soundEngine.playClick();
    triggerAnimatedTurn(pf, 'prev');
  }, [triggerAnimatedTurn]);

  const handleGoContents = useCallback(() => {
    const pf = pageFlipRef.current;
    if (!pf) return;
    soundEngine.playClick();
    triggerAnimatedToPage(pf, isMobile ? 1 : 0);
  }, [isMobile, triggerAnimatedToPage]);

  const handleSelectChapter = useCallback(
    (ch: LoreChapterSummary) => {
      const pf = pageFlipRef.current;
      if (!pf) return;
      soundEngine.playClick();
      const target = Math.min(isMobile ? ch.pageIndex : ch.spreadIndex * 2, pageCount - 1);
      triggerAnimatedToPage(pf, target);
    },
    [isMobile, pageCount, triggerAnimatedToPage],
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

  const canPrev = currentPage > 0;
  const canNext = isMobile ? currentPage < pageCount - 1 : currentPage < pageCount - 2;
  const atContents = isMobile ? currentPage === 1 : currentPage === 0;
  const pageCounterText = isMobile
    ? `Page ${Math.min(currentPage + 1, pageCount)} / ${pageCount}`
    : `${Math.floor(currentPage / 2) + 1} / ${spreads.length}`;

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

        {/* Pixel-Art Burgundy Leather Tome (overflow-visible + lower z-index so turning leaves float cleanly above) */}
        <div className="lore-book-cover relative w-full p-2.5 pb-4 sm:p-3.5 sm:pb-5">
          {/* 4 Hammered Brass Pixel Corner Clasps (z-10, below turning pages) */}
          <BrassCornerClasp position="tl" />
          <BrassCornerClasp position="tr" />
          <BrassCornerClasp position="bl" />
          <BrassCornerClasp position="br" />

          {/* Pixel-Art Crimson Silk Bookmark Ribbon (z-20, below turning pages) */}
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

              {/* StPageFlip Mount Host (z-40, startZIndex: 50 — always above cover & clasps) */}
              <div
                ref={stageRef}
                className="lore-stage flex-1 min-w-0 h-[min(62dvh,460px)] sm:h-[460px]"
              />

              {/* Desktop center leather spine seam (z-10, behind turning pages) */}
              {!isMobile && (
                <div
                  aria-hidden="true"
                  className="lore-spine-strip pointer-events-none absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-2 z-10 opacity-75"
                />
              )}
            </div>
          </div>
        </div>

        {/* Portal React PageSurfaces directly into StPageFlip's page DOM nodes */}
        {portalNodes.map((node, idx) => {
          const page = activePages[idx];
          if (!page) return null;
          const side: 'left' | 'right' | 'single' = isMobile
            ? 'single'
            : idx % 2 === 0
              ? 'left'
              : 'right';
          return createPortal(
            <PageSurface
              key={`${page.kind}_${idx}`}
              page={page}
              side={side}
              onSelectChapter={handleSelectChapter}
              onJump={handleJump}
            />,
            node,
          );
        })}

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
          <span className="text-[11px] text-[#cbb286]">Drag corner or swipe to turn</span>
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
