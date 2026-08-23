// `Wary Thespian` (Cat Druid) — "When this creature enters or dies, surveil 1."
//
// ⚠️ An EXACT-TEXT TWIN of `Wary Watchdog`: byte-identical oracle text on two
// oracle ids in the same batch, so both are GENERATED from one base
// (gen-enters-or-dies-surveil.cjs) rather than one copied onto the other.
// TWO defs for the one printed line — D178's enters-or-dies pair, the dies
// arm carrying `looksBack`. Surveil is a scry with `toGraveyard: true`, and
// the reveal comes FIRST with the ask LAST (D195). D268.

import { WARY_THESPIAN } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript, ScriptCtx } from '../api';
import type { EventBody } from '../../types/events';
import type { PlayerId } from '../../types/ids';

function printed(card: CardData, expected: string): string {
  const actual = card.faces[0]?.oracleText;
  if (actual !== expected) {
    throw new Error(
      `${card.name} reads "${actual}" and its script was written for "${expected}". ` +
        'Re-read the card before re-registering it (D90).',
    );
  }
  return expected;
}

const TEXT = printed(WARY_THESPIAN, 'When this creature enters or dies, surveil 1. (Look at the top card of your library. You may put it into your graveyard.)');

function surveilOne(ctx: ScriptCtx, controller: PlayerId, label: string): readonly EventBody[] {
  const library = ctx.state.zones.library[controller] ?? [];
  const n = Math.min(1, library.length);
  if (n === 0) return [];
  const top = library.slice(library.length - n);
  return [
    { t: 'CardsRevealed', cards: top, to: [controller] },
    {
      t: 'AwaitingSet',
      awaiting: {
        kind: 'scryChoice',
        player: controller,
        count: n,
        toGraveyard: true,
        thenDraw: 0,
        label,
      },
    },
  ];
}

export const WARY_THESPIAN_SCRIPT: CardScript = {
  oracleId: WARY_THESPIAN.oracleId,
  name: WARY_THESPIAN.name,
  triggers: [
    {
      abilityId: 'enters',
      text: TEXT,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield',
        ),
      label: () => 'Wary Thespian — surveil 1',
      resolve: (ctx, _self, obj): readonly EventBody[] =>
        surveilOne(ctx, obj.controller, obj.label),
    },
    {
      abilityId: 'dies',
      text: TEXT,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.card === self && m.from.kind === 'battlefield' && m.to.kind === 'graveyard',
        ),
      label: () => 'Wary Thespian — surveil 1',
      resolve: (ctx, _self, obj): readonly EventBody[] =>
        surveilOne(ctx, obj.controller, obj.label),
    },
  ],
};
