// `Battlefield Percher` - a static blocksOnlyFlying, an activation pumping itself
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { BATTLEFIELD_PERCHER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(BATTLEFIELD_PERCHER, "Flying\nThis creature can block only creatures with flying.\n{1}{B}: This creature gets +1/+1 until end of turn.");
const LINES = PRINTED.split('\n');

export const BATTLEFIELD_PERCHER_SCRIPT: CardScript = {
  oracleId: BATTLEFIELD_PERCHER.oracleId,
  name: BATTLEFIELD_PERCHER.name,
  activated: [
    {
      ref: `${BATTLEFIELD_PERCHER.oracleId}#a0`,
      text: LINES[2] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 1, toughness: 1 }];
      },
    },
  ],
  combat: [
    {
      abilityId: 'blocksOnlyFlying-1',
      text: LINES[1] as string,
      activeZones: ['battlefield'],
      canBlock: (ctx, self, blocker, attacker) => blocker !== self || ctx.derive(attacker).keywords.has('flying'),
    },
  ],
};
