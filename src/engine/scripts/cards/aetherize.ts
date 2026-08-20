// `Aetherize` — "Return all attacking creatures to their owner's hand."
// The first COMBAT-STATE wipe: the set is `state.combat.attackers`, read at
// resolution, each card home to its OWNER. One CardsMoved — the whole
// attack vanishes at once. D197.

import { AETHERIZE } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(AETHERIZE, "Return all attacking creatures to their owner's hand.");

export const AETHERIZE_SCRIPT: CardScript = {
  oracleId: AETHERIZE.oracleId,
  name: AETHERIZE.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, _obj): readonly EventBody[] => {
      const moves = [];
      for (const decl of ctx.state.combat?.attackers ?? []) {
        const card = ctx.state.cards[decl.card];
        if (!card || card.zone.kind !== 'battlefield') continue;
        moves.push({
          card: decl.card,
          from: { kind: 'battlefield' as const, player: card.controller },
          to: { kind: 'hand' as const, player: card.owner },
        });
      }
      if (moves.length === 0) return [];
      return [{ t: 'CardsMoved', moves }];
    },
  },
};
