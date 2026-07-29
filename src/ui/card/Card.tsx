import { memo, useEffect, useMemo, useState } from 'react';
import { ManaCost } from './ManaCost';
import { SyntheticFace } from './SyntheticFace';
import { useCardImage } from './useCardImage';
import { useSettings } from '../../store/settingsStore';
import { cardSlot, register } from '../anim/rectRegistry';
import {
  CARD_ASPECT,
  PRINTED_NAME_LEGIBLE_HEIGHT,
  identityToken,
  modeForHeight,
  type CardData,
  type CardFace,
  type CardRenderMode,
} from '../../data/cardTypes';

// One component, four render modes. See docs/DECISIONS.md D11 for why we composite
// the real Scryfall image with our own thin chrome rather than picking one:
//   • the printed image alone is unreadable below ~190 px, and its printed
//     power/toughness is WRONG the moment a +1/+1 counter lands;
//   • hand-drawn Arena-style frames mean 15+ variants and end up less faithful.
//
// The chrome therefore re-renders exactly the four things you must read at a
// glance — name, cost, CURRENT P/T, type glyph — sized in CSS px so it does not
// shrink with the art.

export interface CardProps {
  /**
   * Oracle data, or `null` when this card is hidden from the viewing player
   * (an opponent's hand, anyone's library). A null card renders the house back
   * and no chrome — hiddenness is the ABSENCE of data, not a flag, so a
   * component physically cannot leak what it was never given. See
   * `src/view/types.ts`.
   */
  card: CardData | null;
  /** Rendered height in CSS px; width follows the printed aspect ratio. */
  height: number;
  /** Which face to show. Ignored for single-image layouts. */
  faceIndex?: number;
  faceDown?: boolean;
  /**
   * Engine instance id. When set, this slot registers itself with the rect
   * registry as `card:<instanceId>`, which is how the flight layer finds where a
   * card is now and where it is going.
   */
  instanceId?: string;
  /** Flight clones render a Card too, and must NOT claim the real slot's key. */
  registerSlot?: boolean;
  /**
   * True while a clone of this card is in flight: the slot keeps its layout box
   * (so the destination geometry stays final and the hand re-fans immediately)
   * but paints nothing. ⚠️ `visibility: hidden`, never `display: none` — the
   * latter collapses the box and the flight would aim at a stale rect.
   */
  inFlight?: boolean;
  /** Engine-derived current power/toughness, including counters and effects. */
  power?: number | null;
  toughness?: number | null;
  /**
   * Loyalty counters on a planeswalker / defense counters on a battle, RIGHT
   * NOW. Both share the corner box with P/T, because a card is only ever one of
   * the three.
   *
   * ⚠️ A NUMBER, not the counters record. `Card` is memoised on shallow props and
   * exists ~50 times on a 4-player board (see the note on the memo); an object
   * prop would be safe only for as long as the projector kept preserving its
   * identity, which is a promise made somewhere else entirely.
   *
   * ⚠️ Null means "nobody told me", and the printed value is then shown — which
   * is right for a card in a hand or a graveyard, and never wrong on the
   * battlefield: a planeswalker there always has at least one loyalty counter,
   * because SBA 4 bins it the instant it does not.
   */
  loyalty?: number | null;
  defense?: number | null;
  tapped?: boolean;
  summoningSick?: boolean;
  /** Damage marked this turn, drawn as a red pip. */
  damage?: number;
  /** For `pile` mode: how many cards are under this one. */
  pileCount?: number;
  /** Force a mode instead of deriving it from height (used by fixture screens). */
  mode?: CardRenderMode;
  /**
   * Delay before this card's tap/untap transition starts, in ms.
   *
   * ⚠️ This is how the untap-all sweep gets its 34 ms stagger: a CSS
   * `transition-delay`, not twelve JavaScript animations racing the same property.
   * It also stays correct if the row re-packs mid-sweep, which an imperative
   * per-element animation would not.
   */
  tapDelayMs?: number;
  /**
   * Mount UPRIGHT and turn on the next frame, rather than appearing already
   * turned.
   *
   * ⚠️ A CSS transition does not run on an element's first style, so a card that
   * mounts tapped simply IS tapped — no turn. That is every permanent entering
   * the battlefield tapped (Cultivate does it every game) and every pile that
   * splits when you tap one copy of it. Rendering upright for one frame gives the
   * transition something to move from.
   *
   * ⚠️ The CALLER decides, and must not set it for a board that arrived all at
   * once — a rebuild, a resync, a viewer switch — or twenty tapped cards turn in
   * unison for no reason. `BattlefieldBand` owns that judgement.
   */
  turnOnMount?: boolean;
  /**
   * Draw the legibility chrome (name strip, cost pips, P/T, damage, shimmer)?
   *
   * ⚠️ Flight clones pass `false`, and it is a measured win, not tidiness. Mounting
   * a clone cost ~25 ms — 50 ms for a six-card draw — because each clone rendered
   * TWO full Cards with every chrome element. Nobody reads a name strip on a card
   * that is mid-flight for 420 ms; the art and the silhouette are the whole read.
   */
  chrome?: boolean;
  className?: string;
  onClick?: () => void;
  onPointerEnter?: () => void;
  onPointerLeave?: () => void;
}

/** Stand-in face for a hidden card, so nothing downstream needs a null check. */
const HIDDEN_FACE: CardFace = {
  name: 'Hidden card',
  manaCost: '',
  typeLine: '',
  oracleText: '',
  flavorText: null,
  power: null,
  toughness: null,
  loyalty: null,
  defense: null,
  colors: [],
  artist: null,
  imageId: '',
};

/**
 * ⚠️ MEMOISED, and it matters a lot. Measured on a 4-player, 40-permanent board:
 * every view commit produced ONE long frame of 50–58 ms — style and paint, not
 * script — because the whole table re-rendered and Chromium recalculated ~50 cards.
 * The count of long frames tracked the count of view commits exactly (2 commits → 2
 * long frames, 4 → 4). Card is the leaf that exists 50 times, and its props are
 * shallow-comparable, so skipping the unchanged ones removes most of that work.
 *
 * ⚠️ Do NOT pass a freshly-created closure (`onClick={() => f(id)}`) from a parent
 * that re-renders on every commit — that defeats the memo silently and the cost
 * comes straight back. Hoist the handler or key it per card.
 */
const CardImpl = function Card({
  card,
  height,
  faceIndex = 0,
  faceDown = false,
  instanceId,
  registerSlot = true,
  inFlight = false,
  power = null,
  toughness = null,
  loyalty = null,
  defense = null,
  tapped = false,
  summoningSick = false,
  damage = 0,
  pileCount = 0,
  mode: forcedMode,
  tapDelayMs = 0,
  turnOnMount = false,
  chrome = true,
  className = '',
  onClick,
  onPointerEnter,
  onPointerLeave,
}: CardProps) {
  const imageTier = useSettings((s) => s.settings.imageTier);
  // A card with no data can only ever be drawn as its back — there is nothing
  // else to draw. Forcing the mode here means every `showX` flag below resolves
  // to false without a single extra conditional.
  const mode: CardRenderMode = card === null ? 'back' : (forcedMode ?? modeForHeight(height, faceDown));

  const face =
    card === null
      ? HIDDEN_FACE
      : (card.faces[Math.min(faceIndex, card.faces.length - 1)] ?? card.faces[0]!);
  // Single-image layouts (split, flip, adventure) always address face 0's image;
  // only transform/modal_dfc have a file per face.
  const imageId = card === null ? '' : card.singleImage ? card.faces[0]!.imageId : face.imageId;
  const image = useCardImage(mode === 'back' ? null : imageId, imageTier);

  const width = Math.round(height * CARD_ASPECT);
  /** Slide a quarter-turned card back onto its slot's top-left corner. */
  const tapShift = (height - width) / 2;
  const tint = identityToken(card?.colorIdentity ?? []);

  // ── Mount upright, then turn ────────────────────────────────────────────────
  //
  // A CSS transition has nothing to move from on an element's first style, so a
  // card that mounts tapped is simply tapped — the quarter turn never plays. One
  // frame upright fixes that, and the frame is free: it is the frame the card is
  // arriving on anyway.
  //
  // ⚠️ WAIT FOR IT TO BE ON SCREEN. A permanent entering the battlefield mounts
  // while its flight clone is still travelling, with the real slot painting
  // nothing (`inFlight`). Turning on mount would spend the whole animation behind
  // a hidden element and the card would land already turned — the exact bug this
  // is here to fix, one step further along. So the turn waits for the landing.
  const [uprightUntilPainted, setUprightUntilPainted] = useState(turnOnMount);
  useEffect(() => {
    if (!uprightUntilPainted || inFlight) return;
    const frame = requestAnimationFrame(() => setUprightUntilPainted(false));
    return () => cancelAnimationFrame(frame);
  }, [uprightUntilPainted, inFlight]);
  const turned = tapped && !uprightUntilPainted;

  // Above this height the printed name is legible, so our name strip gets out of
  // the way instead of covering the art.
  const showNameStrip = chrome && height < PRINTED_NAME_LEGIBLE_HEIGHT && mode !== 'back';
  const showCost = chrome && (mode === 'full' || mode === 'chit') && !!face.manaCost;
  // The chrome layer is the ONLY place a card's numbers are drawn — SyntheticFace
  // deliberately renders none, so there is exactly one source of truth and the
  // value shown is the CURRENT one (counters, continuous effects) not the printed
  // one. That also covers loyalty and battle defense, which live in the same box.
  const currentPt = power !== null && toughness !== null;
  const printedPt = face.power !== null && face.toughness !== null;
  // ⚠️ The COUNTERS, not the printed number, for a planeswalker or a battle. This
  // box drew `face.loyalty` from M1 until the engine started putting loyalty
  // counters on at all (CR 306.5b), and a planeswalker that reads its printed 3
  // for the rest of the game while the SBA is counting down to 0 is a card the
  // player cannot read at exactly the moment it matters.
  const currentCounter = loyalty ?? defense;
  const printedCounter = face.loyalty ?? face.defense;
  const cornerValue = currentPt
    ? `${power}/${toughness}`
    : printedPt
      ? `${face.power}/${face.toughness}`
      : (currentCounter ?? printedCounter);
  const differsFromPrinted = currentPt
    ? !ptMatchesPrinted(power, toughness, face.power, face.toughness)
    : currentCounter !== null && String(currentCounter) !== printedCounter;
  const showPt = chrome && cornerValue !== null && cornerValue !== undefined && mode !== 'back';

  const label = useMemo(() => {
    if (faceDown || card === null) return 'Face-down card';
    const pt = currentPt ? ` ${power}/${toughness}` : '';
    return `${face.name}${pt}${tapped ? ', tapped' : ''}${summoningSick ? ', summoning sick' : ''}`;
  }, [faceDown, card, face.name, currentPt, power, toughness, tapped, summoningSick]);

  const slotKey = instanceId && registerSlot ? cardSlot(instanceId) : null;

  return (
    <div
      // React 19 cleanup-returning ref: `register` hands back its own
      // unregister function, so there is no useEffect and no null-call dance.
      ref={slotKey ? (el) => register(slotKey, el) : undefined}
      className={`relative select-none ${className}`}
      // ⚠️ THIS ELEMENT CARRIES NO TRANSFORM, NO FILTER AND NO TRANSITION, and
      // that is a rule rather than an omission. It is the element the rect
      // registry registers and the element every BEAT animates through
      // `elementFor()` — a lunge, a landing squash, a damage flinch, a death
      // drop. The tap lives one level down, on `[data-card-turn]`.
      //
      // Both used to live here, and they fought. `motion` writes the element's
      // transform, a CSS `transition: transform` on the same element then
      // interpolates every one of those writes, and the beat comes out as mush:
      // measured, the token and counter pops flattened to peak 1.000 vs settle
      // 1.000 and the reveal never crossed 90°. Worse, combat's
      // `clearCombatPoses` animates this element to identity — which, when the
      // tap was here, silently WIPED the turn off a tapped attacker and left it
      // standing upright while the engine still had it tapped.
      //
      // The old 20.5° lean hid all of that behind an expo-out easing whose first
      // frame covered 60 % of the distance. Two systems, two elements.
      style={{ width, height, visibility: inFlight ? 'hidden' : undefined }}
      role={onClick ? 'button' : 'img'}
      aria-label={label}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); } : undefined}
      data-card-id={card?.scryfallId ?? 'hidden'}
      data-card-mode={mode}
      data-instance-id={instanceId}
      data-in-flight={inFlight ? '1' : undefined}
    >
      <div
        // ── The tap: a full quarter turn to the right, as on a real table ──
        //
        // Its own element, so the turn and the beats never write the same
        // property (see the note on the parent). `inset-0`, so it is exactly the
        // card's box and every absolutely-positioned piece of chrome below still
        // measures against the card rather than against the row.
        //
        // Transform-only, so it composites on the GPU and the layout box never
        // moves — the packer has already reserved the room this turn needs.
        //
        // ⚠️ THE TRANSLATE IS NOT DECORATION. Rotating 90° about the card's centre
        // leaves its painted box hanging (h−w)/2 px off the LEFT of its slot and
        // the same distance below its top. The translate slides that box back onto
        // the slot's top-left corner, so a tapped card occupies exactly
        // `height × width` starting where the untapped card started — which is the
        // footprint `packRow` reserves, to the pixel. Change one and you must
        // change the other.
        //
        // Composition order is right-to-left: rotate first, then translate in the
        // parent's frame. Both interpolate from identity, so the transition is one
        // continuous turn rather than two stages.
        className="absolute inset-0"
        data-card-turn={turned ? '1' : '0'}
        style={{
          transform: turned ? `translate(${tapShift}px, ${-tapShift}px) rotate(90deg)` : undefined,
          // ⚠️ The pivot is the card's CENTRE now, not the old low-centre thumb
          // point: a quarter turn about 62% swings the card up and out of its row.
          transformOrigin: '50% 50%',
          // ⚠️ `--crt-ease-in-out`, NOT the app's usual `--crt-ease-out`, and the
          // difference is the whole feel of the turn:
          //
          //  • `--crt-ease-out` is cubic-bezier(0.16, 1, 0.3, 1) — an expo-out
          //    that spends 60 % of its distance in the first frame. Measured on a
          //    real untap: 90° → 35° in 16 ms, then a long crawl to 0. Over 20.5°
          //    nobody could see that; over 90° it reads as a snap with a tail.
          //  • it is SYMMETRIC, so untapping is the tap played backwards. A card
          //    being straightened and a card being turned are one gesture in two
          //    directions, and an eased-out reverse looks like a different one.
          //
          // The filter stays linear: dimming has no direction to read.
          transition:
            'transform var(--crt-dur) var(--crt-ease-in-out), filter var(--crt-dur) linear',
          transitionDelay: tapDelayMs > 0 ? `${tapDelayMs}ms` : undefined,
          filter: tapped ? 'brightness(0.78) saturate(0.85)' : undefined,
          willChange: tapped ? 'transform' : undefined,
        }}
      >
      {/* ── Face ── */}
      {mode === 'back' ? (
        <CardBack height={height} />
      ) : image.status === 'ready' && image.src ? (
        <img
          src={image.src}
          alt=""
          draggable={false}
          className="h-full w-full rounded-[4.5%] object-cover"
          style={{ animation: 'crt-fade-in 180ms var(--crt-ease-out)' }}
        />
      ) : image.status === 'art-only' && image.artCropSrc ? (
        // `chit`: art crop fills the top, name strip below. At small sizes this
        // shows strictly more information per pixel than a shrunken full card.
        <div className="flex h-full w-full flex-col overflow-hidden rounded-[4.5%] bg-crt-inset">
          <img
            src={image.artCropSrc}
            alt=""
            draggable={false}
            className="w-full object-cover"
            style={{ height: '62%' }}
          />
          <div className="flex flex-1 flex-col justify-center px-[6%]">
            <span
              className="font-display truncate"
              style={{ fontSize: Math.max(8, Math.round(height * 0.06)) }}
            >
              {face.name}
            </span>
            <span
              className="font-sc truncate text-crt-faint"
              style={{ fontSize: Math.max(7, Math.round(height * 0.045)) }}
            >
              {face.typeLine}
            </span>
          </div>
        </div>
      ) : card ? (
        <SyntheticFace
          card={card}
          face={face}
          height={height}
          pending={image.status === 'loading'}
        />
      ) : (
        <CardBack height={height} />
      )}

      {/* ── Chrome (CSS px, so it stays legible as the art shrinks) ── */}

      {showNameStrip && image.status === 'ready' && (
        <div
          // ⚠️ NO backdrop-blur here. It was `backdrop-blur-[1px]`, which meant one
          // backdrop filter PER CARD — around 50 of them on a 4-player board, each
          // forcing a readback of the region beneath it. Measured: view commits
          // produced 64–70 ms frames with only ~18 ms of script, the rest style and
          // paint. A 72%-opaque background gives the same legibility for nothing.
          className="pointer-events-none absolute inset-x-0 top-0 flex items-center gap-1 rounded-t-[4.5%] bg-crt-void/80 px-[5%] py-[1px]"
          style={{ fontSize: 11 }}
        >
          <span className="font-display truncate">{face.name}</span>
        </div>
      )}

      {showCost && (
        <div className="pointer-events-none absolute right-[4%] top-[3%]">
          <ManaCost cost={face.manaCost} size={mode === 'chit' ? 10 : 13} />
        </div>
      )}

      {showPt && (
        <div
          className="crt-num pointer-events-none absolute bottom-[3%] right-[4%] rounded bg-crt-void/85 px-[3px] leading-[1.25]"
          style={{
            fontSize: 12,
            // Current P/T differing from printed is the single most important
            // thing the chrome exists for — colour it so the difference is seen.
            // A planeswalker down to 1 from a printed 3 is the same reading.
            color: differsFromPrinted ? 'var(--color-crt-accent-hi)' : undefined,
            boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${tint} 45%, transparent)`,
          }}
        >
          {cornerValue}
        </div>
      )}

      {chrome && damage > 0 && (
        <div
          className="crt-num pointer-events-none absolute bottom-[3%] left-[4%] rounded bg-crt-danger/90 px-[3px] leading-[1.25] text-crt-void"
          style={{ fontSize: 11 }}
          aria-label={`${damage} damage marked`}
        >
          {damage}
        </div>
      )}

      {chrome && summoningSick && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[4.5%]"
          style={{
            mixBlendMode: 'screen',
            background:
              'linear-gradient(105deg, transparent 38%, oklch(1 0 0 / 0.16) 50%, transparent 62%)',
            backgroundSize: '260% 100%',
            animation: 'crt-shimmer 2600ms var(--crt-ease-in-out) infinite',
          }}
        />
      )}

      {chrome && pileCount > 1 && (
        <div
          className="crt-num pointer-events-none absolute -right-1 -top-1 rounded-full bg-crt-accent px-1.5 text-crt-on-accent"
          style={{ fontSize: 11 }}
        >
          {pileCount}
        </div>
      )}
      </div>
    </div>
  );
};

function ptMatchesPrinted(
  power: number | null,
  toughness: number | null,
  printedPower: string | null,
  printedToughness: string | null,
): boolean {
  return String(power) === printedPower && String(toughness) === printedToughness;
}

export const Card = memo(CardImpl);

/** Our own card back — we cannot ship Wizards' printed back. */
function CardBack({ height }: { height: number }) {
  return (
    <div
      className="flex h-full w-full items-center justify-center rounded-[4.5%]"
      style={{
        background:
          'radial-gradient(120% 90% at 50% 40%, oklch(0.30 0.03 250), var(--color-crt-void))',
        boxShadow: 'inset 0 0 0 1px var(--color-crt-border)',
      }}
    >
      <div
        className="rounded-full"
        style={{
          width: height * 0.42,
          height: height * 0.42,
          boxShadow:
            'inset 0 0 0 2px var(--color-crt-accent-lo), 0 0 12px oklch(0.44 0.07 78 / 0.4)',
        }}
      />
    </div>
  );
}
