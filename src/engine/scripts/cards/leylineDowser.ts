// `Leyline Dowser` - an activation vocab, an activation untapSelf
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { LEYLINE_DOWSER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(LEYLINE_DOWSER, "{1}, {T}: Mill a card. You may put an instant or sorcery card milled this way into your hand.\nTap an untapped legendary creature you control: Untap this artifact.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Mill a card. You may put an instant or sorcery card milled this way into your hand.", LEYLINE_DOWSER.name);
const VOCAB_T_A0 = vocabularyTargets("Mill a card. You may put an instant or sorcery card milled this way into your hand.");

export const LEYLINE_DOWSER_SCRIPT: CardScript = {
  oracleId: LEYLINE_DOWSER.oracleId,
  name: LEYLINE_DOWSER.name,
  activated: [
    {
      ref: `${LEYLINE_DOWSER.oracleId}#a0`,
      text: LINES[0] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
    {
      ref: `${LEYLINE_DOWSER.oracleId}#a1`,
      text: LINES[1] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield' || !me.tapped) return [];
        return [{ t: 'PermanentsUntapped', cards: [self] }];
      },
    },
  ],
};
