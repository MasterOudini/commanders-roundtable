// `Deathbellow Raider` - a static mustAttack, an activation regenerate
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { DEATHBELLOW_RAIDER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(DEATHBELLOW_RAIDER, "This creature attacks each combat if able.\n{2}{B}: Regenerate this creature.");
const LINES = PRINTED.split('\n');

export const DEATHBELLOW_RAIDER_SCRIPT: CardScript = {
  oracleId: DEATHBELLOW_RAIDER.oracleId,
  name: DEATHBELLOW_RAIDER.name,
  activated: [
    {
      ref: `${DEATHBELLOW_RAIDER.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'RegenerationShieldAdded', card: self }];
      },
    },
  ],
  combat: [
    {
      abilityId: 'mustAttack-0',
      text: LINES[0] as string,
      activeZones: ['battlefield'],
      mustAttack: (_ctx, self, candidate) => candidate === self,
    },
  ],
};
