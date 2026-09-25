// `Minister of Pain` - a exploits trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { MINISTER_OF_PAIN } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(MINISTER_OF_PAIN, "Exploit (When this creature enters, you may sacrifice a creature.)\nWhen this creature exploits a creature, creatures your opponents control get -1/-1 until end of turn.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Creatures your opponents control get -1/-1 until end of turn.", MINISTER_OF_PAIN.name);
const VOCAB_T_L1 = vocabularyTargets("Creatures your opponents control get -1/-1 until end of turn.");

export const MINISTER_OF_PAIN_SCRIPT: CardScript = {
  oracleId: MINISTER_OF_PAIN.oracleId,
  name: MINISTER_OF_PAIN.name,
  triggers: [
    {
      abilityId: 'exploits-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      matches: (_ctx, self, ev) => ev.t === 'CardsMoved' && ev.moves.some((m) => m.exploitedBy === self),
      label: () => "Minister of Pain - Creatures your opponents control get -1/-1 until end of turn.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
