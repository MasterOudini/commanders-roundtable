// `Goblin Battle Jester` - a castSpell trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { GOBLIN_BATTLE_JESTER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(GOBLIN_BATTLE_JESTER, "Whenever you cast a red spell, target creature can't block this turn.");

const VOCAB_L0 = vocabularyEffects("Target creature can't block this turn.", GOBLIN_BATTLE_JESTER.name);
const VOCAB_T_L0 = vocabularyTargets("Target creature can't block this turn.");

export const GOBLIN_BATTLE_JESTER_SCRIPT: CardScript = {
  oracleId: GOBLIN_BATTLE_JESTER.oracleId,
  name: GOBLIN_BATTLE_JESTER.name,
  triggers: [
    {
      abilityId: 'castSpell-0',
      text: PRINTED,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L0,
      matches: (ctx, self, ev) =>
        ev.t === 'SpellCast' &&
        ev.obj.card !== null &&
        ev.obj.controller === ctx.query.controllerOf(self) &&
        ctx.derive(ev.obj.card).colors.includes('R'),
      label: () => "Goblin Battle Jester - Target creature can't block this turn.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
