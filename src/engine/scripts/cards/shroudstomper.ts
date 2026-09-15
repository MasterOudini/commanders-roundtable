// `Shroudstomper` - a etb trigger vocab, a attacks trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SHROUDSTOMPER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SHROUDSTOMPER, "Deathtouch\nWhenever this creature enters or attacks, each opponent loses 2 life. You gain 2 life and draw a card.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Each opponent loses 2 life. You gain 2 life and draw a card.", SHROUDSTOMPER.name);
const VOCAB_T_L1 = vocabularyTargets("Each opponent loses 2 life. You gain 2 life and draw a card.");

export const SHROUDSTOMPER_SCRIPT: CardScript = {
  oracleId: SHROUDSTOMPER.oracleId,
  name: SHROUDSTOMPER.name,
  triggers: [
    {
      abilityId: 'etb-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Shroudstomper - Each opponent loses 2 life. You gain 2 life and draw a card.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
    {
      abilityId: 'attacks-1',
      text: LINES[1] as string,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'AttackersDeclared' && ev.attackers.some((a) => a.card === self),
      label: () => "Shroudstomper - Each opponent loses 2 life. You gain 2 life and draw a card.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
