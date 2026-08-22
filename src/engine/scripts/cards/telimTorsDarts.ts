// `Telim'Tor's Darts` — "{2}, {T}: This artifact deals 1 damage to target
// player or planeswalker." The player-or-planeswalker compound on the
// ACTIVATED path (Taste of Blood's aim, one seam over). D257.

import { TELIM_TOR_S_DARTS } from '../../../data/fixtures/engineCards';
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
  TELIM_TOR_S_DARTS,
  '{2}, {T}: This artifact deals 1 damage to target player or planeswalker.',
);

export const TELIM_TORS_DARTS_SCRIPT: CardScript = {
  oracleId: TELIM_TOR_S_DARTS.oracleId,
  name: TELIM_TOR_S_DARTS.name,
  activated: [
    {
      ref: `${TELIM_TOR_S_DARTS.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target) return [];
        if (target.kind === 'card' && ctx.state.cards[target.id]?.zone.kind !== 'battlefield')
          return [];
        return [
          {
            t: 'DamageDealt',
            damages: [
              {
                source: self,
                target:
                  target.kind === 'player'
                    ? { kind: 'player', id: target.id }
                    : { kind: 'card', id: target.id },
                amount: 1,
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
  ],
};
