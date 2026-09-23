// `Bog Hoodlums` - a static cantBlock, a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { BOG_HOODLUMS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(BOG_HOODLUMS, "This creature can't block.\nWhen this creature enters, clash with an opponent. If you win, put a +1/+1 counter on this creature. (Each clashing player reveals the top card of their library, then puts that card on their choice of the top or bottom. A player wins if their card had a greater mana value.)");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Clash with an opponent. If you win, put a +1/+1 counter on ~.", BOG_HOODLUMS.name);
const VOCAB_T_L1 = vocabularyTargets("Clash with an opponent. If you win, put a +1/+1 counter on ~.");

export const BOG_HOODLUMS_SCRIPT: CardScript = {
  oracleId: BOG_HOODLUMS.oracleId,
  name: BOG_HOODLUMS.name,
  triggers: [
    {
      abilityId: 'etb-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Bog Hoodlums - Clash with an opponent. If you win, put a +1/+1 counter on ~.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
  combat: [
    {
      abilityId: 'cantBlock-0',
      text: LINES[0] as string,
      activeZones: ['battlefield'],
      canBlock: (_ctx, self, blocker) => blocker !== self,
    },
  ],
};
