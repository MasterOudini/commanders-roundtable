// `Mindscour Dragon` - a combatDamageOpponent trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { MINDSCOUR_DRAGON } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(MINDSCOUR_DRAGON, "Flying\nWhenever this creature deals combat damage to an opponent, target player mills four cards.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Target player mills four cards.", MINDSCOUR_DRAGON.name);
const VOCAB_T_L1 = vocabularyTargets("Target player mills four cards.");

export const MINDSCOUR_DRAGON_SCRIPT: CardScript = {
  oracleId: MINDSCOUR_DRAGON.oracleId,
  name: MINDSCOUR_DRAGON.name,
  triggers: [
    {
      abilityId: 'combatDamageOpponent-1',
      text: LINES[1] as string,
      event: 'CombatDamageDealt',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L1,
      matches: (ctx, self, ev) => ev.t === 'CombatDamageDealt' && ev.damages.some((d) => d.source === self && d.target.kind === 'player' && d.target.id !== ctx.query.controllerOf(self) && d.amount > 0),
      label: () => "Mindscour Dragon - Target player mills four cards.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
