import type { ReactNode } from 'react';

type CarouselImg = { id: string; imageUrl?: string | null };

export function NoticeImageCarousel({
  images,
  slideIndex,
  onPrev,
  onNext,
  ariaPrev,
  ariaNext,
}: {
  images: CarouselImg[];
  slideIndex: number;
  onPrev: () => void;
  onNext: () => void;
  ariaPrev: string;
  ariaNext: string;
}) {
  const n = images.length;
  const idx = n === 0 ? 0 : Math.min(Math.max(0, slideIndex), n - 1);
  const current = images[idx];
  const showNav = n > 1;

  return (
    <div className="relative flex min-h-[160px] max-h-[min(28rem,70vh)] w-full items-center justify-center overflow-hidden rounded-xl bg-white/60 group">
      {current?.imageUrl ? (
        <img
          src={current.imageUrl}
          alt=""
          className="max-h-[min(28rem,70vh)] h-auto w-auto max-w-full select-none object-contain object-center"
          loading="lazy"
          draggable={false}
        />
      ) : null}
      {showNav && (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onPrev();
            }}
            className="absolute left-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-slate-900/55 text-white shadow-md backdrop-blur-sm transition hover:bg-slate-900/75 disabled:opacity-40"
            aria-label={ariaPrev}
            disabled={idx <= 0}
          >
            <span className="text-lg leading-none" aria-hidden>
              ‹
            </span>
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onNext();
            }}
            className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-slate-900/55 text-white shadow-md backdrop-blur-sm transition hover:bg-slate-900/75 disabled:opacity-40"
            aria-label={ariaNext}
            disabled={idx >= n - 1}
          >
            <span className="text-lg leading-none" aria-hidden>
              ›
            </span>
          </button>
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-slate-900/50 px-2.5 py-0.5 text-[11px] font-medium tabular-nums text-white backdrop-blur-sm">
            {idx + 1} / {n}
          </div>
        </>
      )}
    </div>
  );
}

/** 캐러셀만 감싸는 래퍼 — 목록·상세에서 공통 패딩 */
export function NoticeImageCarouselFrame({ children }: { children: ReactNode }) {
  return <div className="border-b border-slate-100 bg-slate-100/80 p-2 sm:p-3">{children}</div>;
}
