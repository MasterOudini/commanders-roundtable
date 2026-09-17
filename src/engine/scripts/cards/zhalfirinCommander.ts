// `Zhalfirin Commander` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ZHALFIRIN_COMMANDER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ZHALFIRIN_COMMANDER, "Flanking (Whenever a creature without flanking blocks this creature, the blocking creature gets -1/-1 until end of turn.)\n{1}{W}{W}: Target Knight creature gets +1/+1 until end of turn.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Target Knight creature gets +1/+1 until end of turn.", ZHALFIRIN_COMMANDER.name);
const VOCAB_T_A0 = vocabularyTargets("Target Knight creature gets +1/+1 until end of turn.");

export const ZHALFIRIN_COMMANDER_SCRIPT: CardScript = {
  oracleId: ZHALFIRIN_COMMANDER.oracleId,
  name: ZHALFIRIN_COMMANDER.name,
  activated: [
    {
      ref: `${ZHALFIRIN_COMMANDER.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
