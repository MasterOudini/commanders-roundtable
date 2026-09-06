// `Fire-Omen Crane` - a attacks trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { FIRE_OMEN_CRANE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(FIRE_OMEN_CRANE, "Flying (This creature can't be blocked except by creatures with flying or reach.)\nWhenever this creature attacks, it deals 1 damage to target creature an opponent controls.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("~ deals 1 damage to target creature an opponent controls.", FIRE_OMEN_CRANE.name);
const VOCAB_T_L1 = vocabularyTargets("~ deals 1 damage to target creature an opponent controls.");

export const FIRE_OMEN_CRANE_SCRIPT: CardScript = {
  oracleId: FIRE_OMEN_CRANE.oracleId,
  name: FIRE_OMEN_CRANE.name,
  triggers: [
    {
      abilityId: 'attacks-1',
      text: LINES[1] as string,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L1,
      matches: (_ctx, self, ev) => ev.t === 'AttackersDeclared' && ev.attackers.some((a) => a.card === self),
      label: () => "Fire-Omen Crane - ~ deals 1 damage to target creature an opponent controls.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
