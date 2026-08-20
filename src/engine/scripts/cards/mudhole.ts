// `Mudhole` — "Target player exiles all land cards from their graveyard."
// The computed graveyard-subset exile: no choice anywhere, the lands typed
// off the ORACLE face. D226.

import { MUDHOLE } from '../../../data/fixtures/engineCards';
import { faceOf } from '../../oracle';
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

const TEXT = printed(MUDHOLE, 'Target player exiles all land cards from their graveyard.');

export const MUDHOLE_SCRIPT: CardScript = {
  oracleId: MUDHOLE.oracleId,
  name: MUDHOLE.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'player') return [];
      const p = ctx.state.players[target.id];
      if (!p || p.hasLost) return [];
      const moves = [];
      for (const id of ctx.state.zones.graveyard[target.id] ?? []) {
        const card = ctx.state.cards[id];
        const oc = card && ctx.oracle.byPrinting(card.printingId);
        if (!oc || !faceOf(oc, card.faceIndex ?? 0).typeLine.types.includes('Land')) continue;
        moves.push({
          card: id,
          from: { kind: 'graveyard' as const, player: target.id },
          to: { kind: 'exile' as const, player: card.owner },
        });
      }
      if (moves.length === 0) return [];
      return [{ t: 'CardsMoved', moves }];
    },
  },
};
