// `Blessed Reversal` — "You gain 3 life for each creature attacking you."
// The combat read is the DEFENDER: an attacker aimed at my planeswalker is
// not attacking ME. D200.

import { BLESSED_REVERSAL } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(BLESSED_REVERSAL, 'You gain 3 life for each creature attacking you.');

export const BLESSED_REVERSAL_SCRIPT: CardScript = {
  oracleId: BLESSED_REVERSAL.oracleId,
  name: BLESSED_REVERSAL.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      let n = 0;
      for (const a of ctx.state.combat?.attackers ?? []) {
        if (a.defender.kind !== 'player' || a.defender.id !== obj.controller) continue;
        if (ctx.state.cards[a.card]?.zone.kind !== 'battlefield') continue;
        n++;
      }
      if (n === 0) return [];
      const life = ctx.state.players[obj.controller]?.life ?? 0;
      return [{ t: 'LifeChanged', player: obj.controller, delta: 3 * n, to: life + 3 * n }];
    },
  },
};
