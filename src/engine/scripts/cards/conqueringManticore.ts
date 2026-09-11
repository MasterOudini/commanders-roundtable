// `Conquering Manticore` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { CONQUERING_MANTICORE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(CONQUERING_MANTICORE, "Flying\nWhen this creature enters, gain control of target creature an opponent controls until end of turn. Untap that creature. It gains haste until end of turn.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Gain control of target creature an opponent controls until end of turn. Untap that creature. It gains haste until end of turn.", CONQUERING_MANTICORE.name);
const VOCAB_T_L1 = vocabularyTargets("Gain control of target creature an opponent controls until end of turn. Untap that creature. It gains haste until end of turn.");

export const CONQUERING_MANTICORE_SCRIPT: CardScript = {
  oracleId: CONQUERING_MANTICORE.oracleId,
  name: CONQUERING_MANTICORE.name,
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
      label: () => "Conquering Manticore - Gain control of target creature an opponent controls until end of turn. Untap that creature. It gains haste until end of turn.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
