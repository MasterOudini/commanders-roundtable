// `Numot, the Devastator` - a combatDamagePlayer trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { NUMOT_THE_DEVASTATOR } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(NUMOT_THE_DEVASTATOR, "Flying\nWhenever Numot deals combat damage to a player, you may pay {2}{R}. If you do, destroy up to two target lands.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("You may pay {2}{R}. If you do, destroy up to two target lands.", NUMOT_THE_DEVASTATOR.name);
const VOCAB_T_L1 = vocabularyTargets("You may pay {2}{R}. If you do, destroy up to two target lands.");

export const NUMOT_THE_DEVASTATOR_SCRIPT: CardScript = {
  oracleId: NUMOT_THE_DEVASTATOR.oracleId,
  name: NUMOT_THE_DEVASTATOR.name,
  triggers: [
    {
      abilityId: 'combatDamagePlayer-1',
      text: LINES[1] as string,
      event: 'CombatDamageDealt',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L1,
      matches: (_ctx, self, ev) => ev.t === 'CombatDamageDealt' && ev.damages.some((d) => d.source === self && d.target.kind === 'player' && d.amount > 0),
      label: () => "Numot, the Devastator - You may pay {2}{R}. If you do, destroy up to two target lands.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
