// `Servant of Tymaret` - a becomesUntapped trigger vocab, an activation regenerate
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SERVANT_OF_TYMARET } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SERVANT_OF_TYMARET, "Inspired — Whenever this creature becomes untapped, each opponent loses 1 life. You gain life equal to the life lost this way.\n{2}{B}: Regenerate this creature.");
const LINES = PRINTED.split('\n');

const VOCAB_L0 = vocabularyEffects("Each opponent loses 1 life. You gain life equal to the life lost this way.", SERVANT_OF_TYMARET.name);
const VOCAB_T_L0 = vocabularyTargets("Each opponent loses 1 life. You gain life equal to the life lost this way.");

export const SERVANT_OF_TYMARET_SCRIPT: CardScript = {
  oracleId: SERVANT_OF_TYMARET.oracleId,
  name: SERVANT_OF_TYMARET.name,
  activated: [
    {
      ref: `${SERVANT_OF_TYMARET.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'RegenerationShieldAdded', card: self }];
      },
    },
  ],
  triggers: [
    {
      abilityId: 'becomesUntapped-0',
      text: LINES[0] as string,
      event: 'PermanentsUntapped',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'PermanentsUntapped' && ev.cards.includes(self),
      label: () => "Servant of Tymaret - Each opponent loses 1 life. You gain life equal to the life lost this way.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
