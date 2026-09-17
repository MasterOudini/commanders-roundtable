// `Riftwing Cloudskate` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { RIFTWING_CLOUDSKATE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(RIFTWING_CLOUDSKATE, "Flying\nWhen this creature enters, return target permanent to its owner's hand.\nSuspend 3—{1}{U} (Rather than cast this card from your hand, you may pay {1}{U} and exile it with three time counters on it. At the beginning of your upkeep, remove a time counter. When the last is removed, you may cast it without paying its mana cost. It has haste.)");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Return target permanent to its owner's hand.", RIFTWING_CLOUDSKATE.name);
const VOCAB_T_L1 = vocabularyTargets("Return target permanent to its owner's hand.");

export const RIFTWING_CLOUDSKATE_SCRIPT: CardScript = {
  oracleId: RIFTWING_CLOUDSKATE.oracleId,
  name: RIFTWING_CLOUDSKATE.name,
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
      label: () => "Riftwing Cloudskate - Return target permanent to its owner's hand.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
