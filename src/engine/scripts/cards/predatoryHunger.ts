// `Predatory Hunger` - a opponentCastsSpell trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { PREDATORY_HUNGER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(PREDATORY_HUNGER, "Enchant creature\nWhenever an opponent casts a creature spell, put a +1/+1 counter on enchanted creature.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Put a +1/+1 counter on enchanted creature.", PREDATORY_HUNGER.name);
const VOCAB_T_L1 = vocabularyTargets("Put a +1/+1 counter on enchanted creature.");

export const PREDATORY_HUNGER_SCRIPT: CardScript = {
  oracleId: PREDATORY_HUNGER.oracleId,
  name: PREDATORY_HUNGER.name,
  triggers: [
    {
      abilityId: 'opponentCastsSpell-1',
      text: LINES[1] as string,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'SpellCast' &&
        ev.obj.card !== null &&
        ev.obj.controller !== ctx.query.controllerOf(self) &&
        ctx.derive(ev.obj.card).typeLine.types.includes('Creature'),
      label: () => "Predatory Hunger - Put a +1/+1 counter on enchanted creature.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
