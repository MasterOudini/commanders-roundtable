// `Accelerated Mutation` — "Target creature gets +X/+X until end of turn,
// where X is the greatest mana value among permanents you control." The
// first BOARD-COMPUTED pump: X is read at resolution from the caster's own
// permanents' mana values (the oracle's, via each instance's printing —
// tokens and faceless blanks count 0), riding the same
// PtModifiedUntilEndOfTurn every pump rides. D196.

import { ACCELERATED_MUTATION } from '../../../data/fixtures/engineCards';
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
  ACCELERATED_MUTATION,
  'Target creature gets +X/+X until end of turn, where X is the greatest mana value among permanents you control.',
);

export const ACCELERATED_MUTATION_SCRIPT: CardScript = {
  oracleId: ACCELERATED_MUTATION.oracleId,
  name: ACCELERATED_MUTATION.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      if (ctx.state.cards[target.id]?.zone.kind !== 'battlefield') return [];
      let x = 0;
      for (const id of ctx.state.zones.battlefield) {
        const card = ctx.state.cards[id];
        if (!card || card.controller !== obj.controller) continue;
        const mv = ctx.oracle.byPrinting(card.printingId)?.manaValue ?? 0;
        if (mv > x) x = mv;
      }
      if (x <= 0) return [];
      return [{ t: 'PtModifiedUntilEndOfTurn', card: target.id, power: x, toughness: x }];
    },
  },
};
