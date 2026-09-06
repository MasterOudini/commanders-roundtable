// `Rustvine Cultivator` - an activation selfCounter, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { RUSTVINE_CULTIVATOR } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(RUSTVINE_CULTIVATOR, "{T}: Put an oil counter on this creature.\n{T}, Remove an oil counter from this creature: Untap target land.");
const LINES = PRINTED.split('\n');

const VOCAB_A1 = vocabularyEffects("Untap target land.", RUSTVINE_CULTIVATOR.name);
const VOCAB_T_A1 = vocabularyTargets("Untap target land.");

export const RUSTVINE_CULTIVATOR_SCRIPT: CardScript = {
  oracleId: RUSTVINE_CULTIVATOR.oracleId,
  name: RUSTVINE_CULTIVATOR.name,
  activated: [
    {
      ref: `${RUSTVINE_CULTIVATOR.oracleId}#a0`,
      text: LINES[0] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'CountersChanged', changes: [{ card: self, kind: "oil", delta: 1 }] }];
      },
    },
    {
      ref: `${RUSTVINE_CULTIVATOR.oracleId}#a1`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A1, VOCAB_T_A1);
      },
    },
  ],
};
