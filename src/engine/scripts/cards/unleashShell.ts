// `Unleash Shell` — 5 to a creature-or-planeswalker AND 2 to that permanent's
// CONTROLLER, read off the target rather than named separately.
//
// ⚠️ Damage to a planeswalker is only MARKED in this engine (D257): SBA 4
// bins a walker already at loyalty <= 0 and CR 306.8 is unbuilt, so the test
// asserts `damage` and never a loyalty delta. D264.

import { UNLEASH_SHELL } from '../../../data/fixtures/engineCards';
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
  UNLEASH_SHELL,
  "Unleash Shell deals 5 damage to target creature or planeswalker and 2 damage to that permanent's controller.",
);

export const UNLEASH_SHELL_SCRIPT: CardScript = {
  oracleId: UNLEASH_SHELL.oracleId,
  name: UNLEASH_SHELL.name,
  spell: {
    text: TEXT,
    resolve: (ctx, self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      const card = ctx.state.cards[target.id];
      if (card?.zone.kind !== 'battlefield') return [];

      const rider = ctx.state.players[card.controller];
      const damages: EventBody[] = [
        {
          t: 'DamageDealt',
          damages: [
            {
              source: self,
              target: { kind: 'card', id: target.id },
              amount: 5,
              deathtouch: false,
              lifelinkTo: null,
              isCommanderDamage: false,
              viaTrample: 0,
              toxic: 0,
              applyAs: 'normal',
            },
            ...(rider && !rider.hasLost
              ? [
                  {
                    source: self,
                    target: { kind: 'player' as const, id: card.controller },
                    amount: 2,
                    deathtouch: false,
                    lifelinkTo: null,
                    isCommanderDamage: false,
                    viaTrample: 0,
                    toxic: 0,
                    applyAs: 'normal' as const,
                  },
                ]
              : []),
          ],
        },
      ];
      return damages;
    },
  },
};
