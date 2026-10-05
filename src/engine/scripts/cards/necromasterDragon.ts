// `Necromaster Dragon` - a combatDamagePlayer trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { NECROMASTER_DRAGON } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import { vocabularyEffects, vocabularyTargets } from '../vocabulary';
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

const PRINTED = printed(NECROMASTER_DRAGON, "Flying\nWhenever this creature deals combat damage to a player, you may pay {2}. If you do, create a 2/2 black Zombie creature token and each opponent mills two cards.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("You may pay {2}. If you do, create a 2/2 black Zombie creature token and each opponent mills two cards.", NECROMASTER_DRAGON.name);
const VOCAB_T_L1 = vocabularyTargets("You may pay {2}. If you do, create a 2/2 black Zombie creature token and each opponent mills two cards.");

export const NECROMASTER_DRAGON_SCRIPT: CardScript = {
  oracleId: NECROMASTER_DRAGON.oracleId,
  name: NECROMASTER_DRAGON.name,
  triggers: [
    {
      abilityId: 'combatDamagePlayer-1',
      text: LINES[1] as string,
      event: 'CombatDamageDealt',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'CombatDamageDealt' && ev.damages.some((d) => d.source === self && d.target.kind === 'player' && d.amount > 0),
      label: () => "Necromaster Dragon - You may pay {2}. If you do, create a 2/2 black Zombie creature token and each opponent mills two cards.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
