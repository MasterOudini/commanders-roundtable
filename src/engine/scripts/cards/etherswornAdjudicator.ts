// `Ethersworn Adjudicator` - an activation vocab, an activation untapSelf
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ETHERSWORN_ADJUDICATOR } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ETHERSWORN_ADJUDICATOR, "Flying\n{1}{W}{B}, {T}: Destroy target creature or enchantment.\n{2}{U}: Untap this creature.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Destroy target creature or enchantment.", ETHERSWORN_ADJUDICATOR.name);
const VOCAB_T_A0 = vocabularyTargets("Destroy target creature or enchantment.");

export const ETHERSWORN_ADJUDICATOR_SCRIPT: CardScript = {
  oracleId: ETHERSWORN_ADJUDICATOR.oracleId,
  name: ETHERSWORN_ADJUDICATOR.name,
  activated: [
    {
      ref: `${ETHERSWORN_ADJUDICATOR.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
    {
      ref: `${ETHERSWORN_ADJUDICATOR.oracleId}#a1`,
      text: LINES[2] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield' || !me.tapped) return [];
        return [{ t: 'PermanentsUntapped', cards: [self] }];
      },
    },
  ],
};
