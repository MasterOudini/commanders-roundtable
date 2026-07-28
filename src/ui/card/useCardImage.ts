import { useEffect, useState } from 'react';
import type { ImageTier } from '../../types/bridge';

// The four-step fallback chain for a card face's art.
//
// The governing rule: a card is NEVER a blank rectangle and NEVER a spinner. A
// player must be able to read and play a card whose art has not arrived — so the
// terminal fallback is a SyntheticFace built from the (always-local) oracle data,
// not an absence.
//
//   1. requested tier cached           → show it
//   2. art_crop cached, full is not    → show `chit` now, upgrade on arrival
//   3. nothing cached                  → SyntheticFace + a request to fetch it
//   4. fetch failed                    → SyntheticFace persists, aggregated toast
//
// Images come through the privileged cardimg:// scheme (electron/cardimg.cjs).
// A 404 from it is the normal "not cached yet" signal, and requesting a missing
// image is also what enqueues the download — so rendering a card is what causes
// its art to be fetched. No separate "warm this card" call is needed.

export type ImageStatus = 'loading' | 'ready' | 'art-only' | 'missing';

export interface CardImageState {
  /** cardimg:// URL to render, or null when there is nothing to show. */
  src: string | null;
  /** art_crop URL, when only the crop is available. */
  artCropSrc: string | null;
  status: ImageStatus;
}

export function cardImageUrl(tier: ImageTier | 'art_crop' | 'small' | 'normal', imageId: string): string {
  return `cardimg://card/${tier}/${imageId}`;
}

/**
 * Probe results, memoized per `tier|imageId` for the lifetime of the renderer.
 *
 * ⚠️ Added for M2 and load-bearing for the flight layer. A flight clone renders
 * the same card as the slot it left, and without this memo its fresh mount would
 * start at `status: 'loading'` and paint a SyntheticFace for the frame or two the
 * `new Image()` probe takes to come back from cache — a card would visibly
 * degrade to a typeset placeholder the instant it started moving and snap back on
 * landing. With the memo, a card already known to be `ready` renders its art in
 * the very first frame of the clone.
 *
 * A 'missing' or 'art-only' result is still re-probed in the background, so art
 * arriving from the download queue continues to upgrade the card in place.
 */
const probeMemo = new Map<string, CardImageState>();

/** Test/dev hook: drop memoized probe results (e.g. after clearing the cache). */
export function resetCardImageMemo(): void {
  probeMemo.clear();
}

/**
 * Probe the cache for a face's art.
 *
 * Loading through `new Image()` rather than fetch: fetch is blocked for
 * cardimg: by CSP (connect-src is 'self'), while img-src allows it. The decoded
 * frame also lands in Chromium's own image cache, so the subsequent <img> render
 * is instant and eviction is Chromium's problem rather than ours — which is why
 * we drop the reference instead of holding ImageBitmaps (400 cards × 745×1040×4 B
 * would be 1.2 GB).
 */
export function useCardImage(imageId: string | null, tier: ImageTier): CardImageState {
  const memoKey = imageId ? `${tier}|${imageId}` : null;
  const [state, setState] = useState<CardImageState>(
    () =>
      (memoKey ? probeMemo.get(memoKey) : null) ?? {
        src: null,
        artCropSrc: null,
        status: 'loading',
      },
  );

  useEffect(() => {
    if (!imageId || !memoKey) {
      setState({ src: null, artCropSrc: null, status: 'missing' });
      return;
    }

    let cancelled = false;
    const fullUrl = cardImageUrl(tier, imageId);
    const cropUrl = cardImageUrl('art_crop', imageId);

    const known = probeMemo.get(memoKey);
    if (known) {
      setState(known);
      // A settled 'ready' cannot improve. Anything else can, as the download
      // queue lands art, so keep probing in the background — but never flash
      // back to 'loading' while doing it.
      if (known.status === 'ready') return;
    } else {
      setState({ src: null, artCropSrc: null, status: 'loading' });
    }

    const probe = (url: string) =>
      new Promise<boolean>((resolve) => {
        const img = new Image();
        img.onload = () => resolve(true);
        img.onerror = () => resolve(false);
        img.src = url;
      });

    const commit = (next: CardImageState) => {
      probeMemo.set(memoKey, next);
      if (!cancelled) setState(next);
    };

    void (async () => {
      if (await probe(fullUrl)) {
        commit({ src: fullUrl, artCropSrc: null, status: 'ready' });
        return;
      }
      if (cancelled) return;
      // Step 2: the crop often lands first because it is ~30× smaller.
      if (await probe(cropUrl)) {
        commit({ src: null, artCropSrc: cropUrl, status: 'art-only' });
        return;
      }
      commit({ src: null, artCropSrc: null, status: 'missing' });
    })();

    return () => { cancelled = true; };
  }, [imageId, memoKey, tier]);

  return state;
}
