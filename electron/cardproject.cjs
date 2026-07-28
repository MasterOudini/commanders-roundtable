// Scryfall record (63 fields) → our CardData shape (src/data/cardTypes.ts).
//
// A deliberate projection, not a pass-through. Two reasons:
//   • the renderer should not be coupled to Scryfall's schema — a field rename
//     upstream would otherwise ripple into twenty components;
//   • 116k records × 63 fields is a lot of bytes to keep and parse when we use
//     about fifteen of them.
//
// ⚠️ This file and src/data/cardTypes.ts are the SAME contract — change both
// together. The projection is validated against the type by the battery, not by
// the compiler, because this side is CommonJS.

const { foldName } = require('./cardfold.cjs');

/** Warning buckets, so ingest problems are counted rather than silently ignored. */
function newWarnings() {
  return Object.create(null);
}
function warn(warnings, key) {
  warnings[key] = (warnings[key] ?? 0) + 1;
}

const COLOR_LETTERS = new Set(['W', 'U', 'B', 'R', 'G']);

function colorArray(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((c) => COLOR_LETTERS.has(c));
}

/**
 * Layouts we recognise. Anything else is mapped to 'other' — which is safe
 * (rendering keys off `singleImage`, not off this) but is also counted as a
 * warning, so the list is worth keeping honest: a warning log full of expected
 * entries teaches you to ignore it.
 *
 * Measured against the 2026-07-26 default_cards release, the layouts appearing
 * beyond the obvious ones were: planar 330, mutate 146, emblem 137,
 * double_faced_token 120, vanguard 119, scheme 110, prepare 94,
 * reversible_card 81, host 29, case 26, augment 17.
 *
 * Of those, these are ordinary playable cards and belong here:
 */
const KNOWN_LAYOUTS = new Set([
  'normal', 'transform', 'modal_dfc', 'meld', 'split', 'flip', 'adventure',
  'leveler', 'saga', 'class', 'battle', 'prototype', 'token',
  'mutate', // Ikoria creatures — normal cards with an extra casting mode
  'case', // Murders at Karlov Manor enchantments
  'prepare', // enchantment half of a prepared card
  'reversible_card', // two printed faces, both real; oracle_id lives on the faces
]);

/**
 * The rest are deliberately NOT normal cards — planes, schemes, Vanguard avatars,
 * emblems, Un-set host/augment halves, and token backs. They are still indexed
 * (someone may want to look one up, and the token tools can use them); they just
 * carry layout 'other' and are not expected to render like a spell.
 */
const NON_CARD_LAYOUTS = new Set([
  'planar', 'scheme', 'vanguard', 'emblem', 'host', 'augment', 'double_faced_token',
]);

/**
 * Printing preference. LOWER is better; ties break on release date, then id.
 *
 * This decides which printing a bare decklist name resolves to — "1 Sol Ring"
 * should give a normal paper English card with a good scan, not an Arena-only
 * printing or an oversized Commander-deck display card.
 */
function printingRank(card) {
  let rank = 0;
  if (card.digital) rank += 32; // Arena/MTGO-only: not a paper card at all
  if (card.lang && card.lang !== 'en') rank += 16;
  if (card.oversized) rank += 8; // display/Vanguard cards, not playable objects
  if (card.set_type === 'memorabilia' || card.set_type === 'funny') rank += 4;
  if (card.image_status !== 'highres_scan') rank += 2;
  if (card.border_color === 'gold' || card.border_color === 'silver') rank += 1;
  return rank;
}

/** released_at 'YYYY-MM-DD' → 20260726, for a cheap numeric tie-break. */
function releaseKey(released) {
  if (typeof released !== 'string') return 0;
  const n = Number(released.slice(0, 10).replace(/-/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function buildFace(source, imageId) {
  return {
    name: typeof source.name === 'string' ? source.name : '',
    manaCost: typeof source.mana_cost === 'string' ? source.mana_cost : '',
    typeLine: typeof source.type_line === 'string' ? source.type_line : '',
    oracleText: typeof source.oracle_text === 'string' ? source.oracle_text : '',
    flavorText: typeof source.flavor_text === 'string' ? source.flavor_text : null,
    power: typeof source.power === 'string' ? source.power : null,
    toughness: typeof source.toughness === 'string' ? source.toughness : null,
    loyalty: typeof source.loyalty === 'string' ? source.loyalty : null,
    defense: typeof source.defense === 'string' ? source.defense : null,
    colors: colorArray(source.colors),
    artist: typeof source.artist === 'string' ? source.artist : null,
    imageId,
  };
}

/**
 * Project one Scryfall card. Returns null for records that are not playable
 * objects at all (art series, tokens-of-tokens with no name, etc.).
 *
 * @param {object} card    a parsed Scryfall card object
 * @param {object} warnings mutable warning counter
 */
function projectCard(card, warnings = newWarnings()) {
  if (!card || typeof card !== 'object') {
    warn(warnings, 'notAnObject');
    return null;
  }
  const scryfallId = card.id;
  if (typeof scryfallId !== 'string' || scryfallId.length !== 36) {
    warn(warnings, 'missingId');
    return null;
  }
  if (typeof card.name !== 'string' || card.name.length === 0) {
    warn(warnings, 'missingName');
    return null;
  }
  // Art series cards share names with real cards and would pollute lookups.
  if (card.layout === 'art_series') {
    warn(warnings, 'skippedArtSeries');
    return null;
  }

  // ⚠️ oracle_id is absent at the root on reversible_card layouts; it lives on
  // the faces there. Falling back keeps singleton checks working for them.
  const oracleId = typeof card.oracle_id === 'string'
    ? card.oracle_id
    : card.card_faces?.[0]?.oracle_id;
  if (typeof oracleId !== 'string') warn(warnings, 'missingOracleId');

  const rawFaces = Array.isArray(card.card_faces) ? card.card_faces : null;

  // The distinction that decides whether flipping swaps an IMAGE or just text:
  // transform / modal_dfc / reversible have image_uris per face; split, flip and
  // adventure print every face on ONE image.
  const perFaceImages = !!rawFaces && rawFaces.every((f) => f && f.image_uris);
  const singleImage = !perFaceImages;

  let faces;
  if (rawFaces && rawFaces.length > 0) {
    faces = rawFaces.map((f, i) =>
      buildFace(f, perFaceImages ? `${scryfallId}-${i}` : scryfallId),
    );
    // Split/adventure keep cost and type on the faces but P/T at the root for
    // some layouts; backfill so a face is never missing its own numbers.
    if (singleImage) {
      for (const face of faces) {
        if (face.typeLine === '' && typeof card.type_line === 'string') {
          face.typeLine = card.type_line;
        }
      }
    }
  } else {
    faces = [buildFace(card, scryfallId)];
  }

  if (!card.image_uris && !perFaceImages) warn(warnings, 'noImageUris');
  // Only an UNEXPECTED layout is a warning. A known non-card layout is a fact
  // about Magic, not a problem with our ingest.
  if (!KNOWN_LAYOUTS.has(card.layout) && !NON_CARD_LAYOUTS.has(card.layout)) {
    warn(warnings, `unknownLayout:${card.layout}`);
  }
  if (!Array.isArray(card.keywords)) warn(warnings, 'missingKeywords');
  if (!card.legalities || typeof card.legalities.commander !== 'string') {
    warn(warnings, 'missingCommanderLegality');
  }

  return {
    scryfallId,
    oracleId: oracleId ?? scryfallId,
    name: card.name,
    layout: KNOWN_LAYOUTS.has(card.layout) ? card.layout : 'other',
    faces,
    // ⚠️ Straight from Scryfall. Never hand-roll colour identity: Scryfall
    // already implements CR 903.4 across hybrid, phyrexian, colour indicators
    // and both faces of a DFC. Recomputing it would be strictly worse.
    colorIdentity: colorArray(card.color_identity),
    cmc: typeof card.cmc === 'number' ? card.cmc : 0,
    keywords: Array.isArray(card.keywords) ? card.keywords.filter((k) => typeof k === 'string') : [],
    setCode: typeof card.set === 'string' ? card.set : '',
    collectorNumber: typeof card.collector_number === 'string' ? card.collector_number : '',
    commanderLegality: card.legalities?.commander ?? 'not_legal',
    singleImage,
  };
}

/** Index-only metadata that never needs a record read. */
function projectIndexFields(card, projected) {
  return {
    id: projected.scryfallId,
    name: foldName(projected.name),
    set: projected.setCode.toLowerCase(),
    cn: projected.collectorNumber.toLowerCase(),
    rank: printingRank(card),
    rel: releaseKey(card.released_at),
  };
}

module.exports = { projectCard, projectIndexFields, printingRank, releaseKey, newWarnings };
