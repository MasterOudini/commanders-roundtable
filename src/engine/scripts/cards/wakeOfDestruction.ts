// `Wake of Destruction` — Echoing Calm's oracle NAME match (D210), one type
// over: the target land plus every OTHER land sharing its printed name, any
// controller — so my own Islands go with theirs.
//
// ⚠️ The name is read BEFORE any move, because a resolve cannot see its own
// effects (D260/D264/D266) and the target is the first thing to leave. D267.

import { WAKE_OF_DESTRUCTION } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript } from '../api';
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
  WAKE_OF_DESTRUCTION,
  'Destroy target land and all other lands with the same name as that land.',
);

export const WAKE_OF_DESTRUCTION_SCRIPT: CardScript = {
  oracleId: WAKE_OF_DESTRUCTION.oracleId,
  name: WAKE_OF_DESTRUCTION.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      const victim = ctx.state.cards[target.id];
      if (!victim || victim.zone.kind !== 'battlefield') return [];
      const name = ctx.oracle.byPrinting(victim.printingId)?.name;
      const moves = [];
      for (const id of ctx.state.zones.battlefield) {
        const card = ctx.state.cards[id];
        if (!card) continue;
        const isTarget = id === target.id;
        if (!isTarget) {
          if (!ctx.derive(id).typeLine.types.includes('Land')) continue;
          if (ctx.oracle.byPrinting(card.printingId)?.name !== name) continue;
        }
        if (ctx.derive(id).keywords.has('indestructible')) continue;
        moves.push({
          card: id,
          from: { kind: 'battlefield' as const, player: card.controller },
          to: { kind: 'graveyard' as const, player: card.owner },
        });
      }
      if (moves.length === 0) return [];
      return [{ t: 'CardsMoved', moves }];
    },
  },
};
