// `Poison-Blade Mentor` - a attacks trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { POISON_BLADE_MENTOR } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(POISON_BLADE_MENTOR, "Deathtouch (Any amount of damage this deals to a creature is enough to destroy it.)\nWhenever this creature attacks, another target Assassin you control gains deathtouch until end of turn.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Another target Assassin you control gains deathtouch until end of turn.", POISON_BLADE_MENTOR.name);
const VOCAB_T_L1 = vocabularyTargets("Another target Assassin you control gains deathtouch until end of turn.");

export const POISON_BLADE_MENTOR_SCRIPT: CardScript = {
  oracleId: POISON_BLADE_MENTOR.oracleId,
  name: POISON_BLADE_MENTOR.name,
  triggers: [
    {
      abilityId: 'attacks-1',
      text: LINES[1] as string,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L1,
      matches: (_ctx, self, ev) => ev.t === 'AttackersDeclared' && ev.attackers.some((a) => a.card === self),
      label: () => "Poison-Blade Mentor - Another target Assassin you control gains deathtouch until end of turn.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
