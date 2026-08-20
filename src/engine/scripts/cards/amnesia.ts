// `Amnesia` — "Target player reveals their hand and discards all nonland
// cards." No choice anywhere: the reveal shows the whole hand to everyone
// at the table (a public reveal, unlike Gitaxian Probe's private look) and
// the discard is the computed nonland subset, typed off the ORACLE face —
// a hand card has no battlefield derivation. D197.

import { AMNESIA } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript } from '../api';
import type { EventBody } from '../../types/events';
import { parseTypeLine } from '../../../data/oracleParse';

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

const TEXT = printed(AMNESIA, 'Target player reveals their hand and discards all nonland cards.');

export const AMNESIA_SCRIPT: CardScript = {
  oracleId: AMNESIA.oracleId,
  name: AMNESIA.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'player') return [];
      const hand = ctx.state.zones.hand[target.id] ?? [];
      if (hand.length === 0) return [];
      const events: EventBody[] = [
        { t: 'CardsRevealed', cards: [...hand], to: [...ctx.state.seating] },
      ];
      const moves = [];
      for (const id of hand) {
        const inst = ctx.state.cards[id];
        if (!inst) continue;
        const oracleCard = ctx.oracle.byPrinting(inst.printingId);
        const face = oracleCard?.data.faces[0];
        if (!face) continue;
        if (parseTypeLine(face.typeLine).types.includes('Land')) continue;
        moves.push({
          card: id,
          from: { kind: 'hand' as const, player: target.id },
          to: { kind: 'graveyard' as const, player: inst.owner },
        });
      }
      if (moves.length > 0) events.push({ t: 'CardsMoved', moves });
      return events;
    },
  },
};
