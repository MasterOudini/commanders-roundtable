// `Goblin Heelcutter` - a attacks trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { GOBLIN_HEELCUTTER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(GOBLIN_HEELCUTTER, "Whenever this creature attacks, target creature can't block this turn.\nDash {2}{R} (You may cast this spell for its dash cost. If you do, it gains haste, and it's returned from the battlefield to its owner's hand at the beginning of the next end step.)");
const LINES = PRINTED.split('\n');

const VOCAB_L0 = vocabularyEffects("Target creature can't block this turn.", GOBLIN_HEELCUTTER.name);
const VOCAB_T_L0 = vocabularyTargets("Target creature can't block this turn.");

export const GOBLIN_HEELCUTTER_SCRIPT: CardScript = {
  oracleId: GOBLIN_HEELCUTTER.oracleId,
  name: GOBLIN_HEELCUTTER.name,
  triggers: [
    {
      abilityId: 'attacks-0',
      text: LINES[0] as string,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L0,
      matches: (_ctx, self, ev) => ev.t === 'AttackersDeclared' && ev.attackers.some((a) => a.card === self),
      label: () => "Goblin Heelcutter - Target creature can't block this turn.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
