// `Dwarven Weaponsmith` - an activation counterOnTarget
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { DWARVEN_WEAPONSMITH } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(DWARVEN_WEAPONSMITH, "{T}, Sacrifice an artifact: Put a +1/+1 counter on target creature. Activate only during your upkeep.");

export const DWARVEN_WEAPONSMITH_SCRIPT: CardScript = {
  oracleId: DWARVEN_WEAPONSMITH.oracleId,
  name: DWARVEN_WEAPONSMITH.name,
  activated: [
    {
      ref: `${DWARVEN_WEAPONSMITH.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield') return [];
        return [{ t: 'CountersChanged', changes: [{ card: target.id, kind: "+1/+1", delta: 1 }] }];
      },
    },
  ],
};
