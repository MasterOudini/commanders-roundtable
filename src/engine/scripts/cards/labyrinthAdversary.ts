// `Labyrinth Adversary` - a youAttack trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { LABYRINTH_ADVERSARY } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(LABYRINTH_ADVERSARY, "Trample (This creature can deal excess combat damage to the player it's attacking.)\nWhenever you attack, you may pay {1}{R}. When you do, target creature can't block this turn.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("You may pay {1}{R}. When you do, target creature can't block this turn.", LABYRINTH_ADVERSARY.name);
const VOCAB_T_L1 = vocabularyTargets("You may pay {1}{R}. When you do, target creature can't block this turn.");

export const LABYRINTH_ADVERSARY_SCRIPT: CardScript = {
  oracleId: LABYRINTH_ADVERSARY.oracleId,
  name: LABYRINTH_ADVERSARY.name,
  triggers: [
    {
      abilityId: 'youAttack-1',
      text: LINES[1] as string,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'AttackersDeclared' && ev.attackers.some((a) => ctx.state.cards[a.card]?.controller === ctx.query.controllerOf(self)),
      label: () => "Labyrinth Adversary - You may pay {1}{R}. When you do, target creature can't block this turn.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
