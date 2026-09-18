// `Wall of Junk` - a blocks trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { WALL_OF_JUNK } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(WALL_OF_JUNK, "Defender (This creature can't attack.)\nWhen this creature blocks, return it to its owner's hand at end of combat. (Return it only if it's on the battlefield.)");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Return ~ to its owner's hand at end of combat.", WALL_OF_JUNK.name);
const VOCAB_T_L1 = vocabularyTargets("Return ~ to its owner's hand at end of combat.");

export const WALL_OF_JUNK_SCRIPT: CardScript = {
  oracleId: WALL_OF_JUNK.oracleId,
  name: WALL_OF_JUNK.name,
  triggers: [
    {
      abilityId: 'blocks-1',
      text: LINES[1] as string,
      event: 'BlockersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'BlockersDeclared' && ev.blocks.some((b) => b.blocker === self),
      label: () => "Wall of Junk - Return ~ to its owner's hand at end of combat.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
