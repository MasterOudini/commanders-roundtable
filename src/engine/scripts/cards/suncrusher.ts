// `Suncrusher` - an activation vocab, an activation bounceSelf
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SUNCRUSHER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SUNCRUSHER, "Sunburst (This creature enters with a +1/+1 counter on it for each color of mana spent to cast it.)\n{4}, {T}, Remove a +1/+1 counter from this creature: Destroy target creature.\n{2}, Remove a +1/+1 counter from this creature: Return this creature to its owner's hand.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Destroy target creature.", SUNCRUSHER.name);
const VOCAB_T_A0 = vocabularyTargets("Destroy target creature.");

export const SUNCRUSHER_SCRIPT: CardScript = {
  oracleId: SUNCRUSHER.oracleId,
  name: SUNCRUSHER.name,
  activated: [
    {
      ref: `${SUNCRUSHER.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
    {
      ref: `${SUNCRUSHER.oracleId}#a1`,
      text: LINES[2] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'CardsMoved', moves: [{ card: self, from: { kind: 'battlefield', player: me.controller }, to: { kind: 'hand', player: me.owner } }] }];
      },
    },
  ],
};
