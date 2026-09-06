// `Harrier Strix` - a etb trigger vocab, an activation loot
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { HARRIER_STRIX } from '../../../data/fixtures/engineCards';
import { drawEvents } from '../../effects';
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

const PRINTED = printed(HARRIER_STRIX, "Flying\nWhen this creature enters, tap target permanent.\n{2}{U}: Draw a card, then discard a card.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Tap target permanent.", HARRIER_STRIX.name);
const VOCAB_T_L1 = vocabularyTargets("Tap target permanent.");

export const HARRIER_STRIX_SCRIPT: CardScript = {
  oracleId: HARRIER_STRIX.oracleId,
  name: HARRIER_STRIX.name,
  activated: [
    {
      ref: `${HARRIER_STRIX.oracleId}#a0`,
      text: LINES[2] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return [
          ...drawEvents(ctx.state, obj.controller, 1),
          { t: 'AwaitingSet', awaiting: { kind: 'chooseFromZone', player: obj.controller, zone: 'hand', rest: null, count: 1, label: "Harrier Strix - discard a card" } },
        ];
      },
    },
  ],
  triggers: [
    {
      abilityId: 'etb-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L1,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Harrier Strix - Tap target permanent.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
