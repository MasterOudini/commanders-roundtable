// `Kaijin of the Vanishing Touch` - a blocks trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { KAIJIN_OF_THE_VANISHING_TOUCH } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(KAIJIN_OF_THE_VANISHING_TOUCH, "Defender (This creature can't attack.)\nWhenever this creature blocks a creature, return that creature to its owner's hand at end of combat. (Return it only if it's on the battlefield.)");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Return target creature to its owner's hand at end of combat.", KAIJIN_OF_THE_VANISHING_TOUCH.name);
const VOCAB_T_L1 = vocabularyTargets("Return target creature to its owner's hand at end of combat.");

export const KAIJIN_OF_THE_VANISHING_TOUCH_SCRIPT: CardScript = {
  oracleId: KAIJIN_OF_THE_VANISHING_TOUCH.oracleId,
  name: KAIJIN_OF_THE_VANISHING_TOUCH.name,
  triggers: [
    {
      abilityId: 'blocks-1',
      text: LINES[1] as string,
      event: 'BlockersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      perItem: (_ctx, self, ev) => (ev.t === 'BlockersDeclared' ? ev.blocks.filter((b) => b.blocker === self).map((b) => b.attacker) : []),
      matches: (_ctx, self, ev) => ev.t === 'BlockersDeclared' && ev.blocks.some((b) => b.blocker === self),
      label: () => "Kaijin of the Vanishing Touch - Return target creature to its owner's hand at end of combat.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        if (obj.item === undefined) return [];
        return ctx.vocabulary({ ...obj, targets: [{ kind: 'card', id: obj.item }] }, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
