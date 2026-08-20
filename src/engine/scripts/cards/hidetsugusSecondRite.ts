// `Hidetsugu's Second Rite` — EXACTLY 10 life or nothing: the printed
// conditional read at resolution, both branches real. D217.

import { HIDETSUGU_S_SECOND_RITE } from '../../../data/fixtures/engineCards';
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
  HIDETSUGU_S_SECOND_RITE,
  "If target player has exactly 10 life, Hidetsugu's Second Rite deals 10 damage to that player.",
);

export const HIDETSUGUS_SECOND_RITE_SCRIPT: CardScript = {
  oracleId: HIDETSUGU_S_SECOND_RITE.oracleId,
  name: HIDETSUGU_S_SECOND_RITE.name,
  spell: {
    text: TEXT,
    resolve: (ctx, self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'player') return [];
      const p = ctx.state.players[target.id];
      if (!p || p.hasLost) return [];
      if (p.life !== 10) return [];
      return [
        {
          t: 'DamageDealt',
          damages: [
            {
              source: self,
              target: { kind: 'player', id: target.id },
              amount: 10,
              deathtouch: false,
              lifelinkTo: null,
              isCommanderDamage: false,
              viaTrample: 0,
              toxic: 0,
              applyAs: 'normal',
            },
          ],
        },
      ];
    },
  },
};
