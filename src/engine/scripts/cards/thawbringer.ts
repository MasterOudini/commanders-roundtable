// `Thawbringer` — the enters-OR-dies pair meeting the surveil ask: ONE printed
// line, two defs, one shared resolve (Lys Alana Informant's shape, D223). The
// dies arm looks back (D147). D258.

import { THAWBRINGER } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript, ScriptCtx } from '../api';
import type { EventBody } from '../../types/events';

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

const TEXT = printed(
  THAWBRINGER,
  'When this creature enters or dies, surveil 1. (Look at the top card of your library. You may put it into your graveyard.)',
);

function surveil(ctx: ScriptCtx, obj: { controller: string; label: string }): readonly EventBody[] {
  const library = ctx.state.zones.library[obj.controller] ?? [];
  const n = Math.min(1, library.length);
  if (n === 0) return [];
  const top = library.slice(library.length - n);
  return [
    { t: 'CardsRevealed', cards: top, to: [obj.controller] },
    {
      t: 'AwaitingSet',
      awaiting: {
        kind: 'scryChoice',
        player: obj.controller,
        count: n,
        toGraveyard: true,
        thenDraw: 0,
        label: obj.label,
      },
    },
  ];
}

export const THAWBRINGER_SCRIPT: CardScript = {
  oracleId: THAWBRINGER.oracleId,
  name: THAWBRINGER.name,
  triggers: [
    {
      abilityId: 'etb',
      text: TEXT,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield',
        ),
      label: () => 'Thawbringer — surveil 1',
      resolve: (ctx, _self, obj): readonly EventBody[] => surveil(ctx, obj),
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
      label: () => 'Thawbringer — surveil 1',
      resolve: (ctx, _self, obj): readonly EventBody[] => surveil(ctx, obj),
    },
  ],
};
