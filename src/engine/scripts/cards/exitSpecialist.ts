// `Exit Specialist` - a static cantBeBlockedByPower, a turnedFaceUp trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { EXIT_SPECIALIST } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(EXIT_SPECIALIST, "This creature can't be blocked by creatures with power 3 or greater.\nDisguise {1}{U} (You may cast this card face down for {3} as a 2/2 creature with ward {2}. Turn it face up any time for its disguise cost.)\nWhen this creature is turned face up, return another target creature to its owner's hand.");
const LINES = PRINTED.split('\n');

const VOCAB_L2 = vocabularyEffects("Return another target creature to its owner's hand.", EXIT_SPECIALIST.name);
const VOCAB_T_L2 = vocabularyTargets("Return another target creature to its owner's hand.");

export const EXIT_SPECIALIST_SCRIPT: CardScript = {
  oracleId: EXIT_SPECIALIST.oracleId,
  name: EXIT_SPECIALIST.name,
  triggers: [
    {
      abilityId: 'turnedFaceUp-2',
      text: LINES[2] as string,
      event: 'FaceDownSet',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L2,
      matches: (_ctx, self, ev) => ev.t === 'FaceDownSet' && ev.card === self && !ev.faceDown,
      label: () => "Exit Specialist - Return another target creature to its owner's hand.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L2, VOCAB_T_L2);
      },
    },
  ],
  combat: [
    {
      abilityId: 'cantBeBlockedByPower-0',
      text: LINES[0] as string,
      activeZones: ['battlefield'],
      canBlock: (ctx, self, blocker, attacker) => attacker !== self || (ctx.derive(blocker).power ?? 0) < 3,
    },
  ],
};
