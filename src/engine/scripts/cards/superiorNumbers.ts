// `Superior Numbers` — the TWO-SIDED census: my creatures minus the target
// opponent's, floored at nothing. Two probed specs, the opponent
// restriction enforced. D255.

import { SUPERIOR_NUMBERS } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript, ScriptCtx } from '../api';
import type { EventBody } from '../../types/events';
import type { PlayerId } from '../../types/ids';

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
  SUPERIOR_NUMBERS,
  'Superior Numbers deals damage to target creature equal to the number of creatures you control in excess of the number of creatures target opponent controls.',
);

function creatureCount(ctx: ScriptCtx, who: PlayerId): number {
  let n = 0;
  for (const id of ctx.state.zones.battlefield) {
    const card = ctx.state.cards[id];
    if (!card || card.controller !== who) continue;
    if (ctx.derive(id).typeLine.types.includes('Creature')) n += 1;
  }
  return n;
}

export const SUPERIOR_NUMBERS_SCRIPT: CardScript = {
  oracleId: SUPERIOR_NUMBERS.oracleId,
  name: SUPERIOR_NUMBERS.name,
  spell: {
    text: TEXT,
    resolve: (ctx, self, obj): readonly EventBody[] => {
      const victim = obj.targets[0];
      const opponent = obj.targets[1];
      if (!victim || victim.kind !== 'card') return [];
      if (!opponent || opponent.kind !== 'player') return [];
      if (ctx.state.cards[victim.id]?.zone.kind !== 'battlefield') return [];
      const amount = creatureCount(ctx, obj.controller) - creatureCount(ctx, opponent.id);
      if (amount <= 0) return [];
      return [
        {
          t: 'DamageDealt',
          damages: [
            {
              source: self,
              target: { kind: 'card', id: victim.id },
              amount,
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
