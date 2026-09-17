// `Aeronaut Cavalry` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { AERONAUT_CAVALRY } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(AERONAUT_CAVALRY, "Flying\nWhen this creature enters, put a +1/+1 counter on another target Soldier you control.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Put a +1/+1 counter on another target Soldier you control.", AERONAUT_CAVALRY.name);
const VOCAB_T_L1 = vocabularyTargets("Put a +1/+1 counter on another target Soldier you control.");

export const AERONAUT_CAVALRY_SCRIPT: CardScript = {
  oracleId: AERONAUT_CAVALRY.oracleId,
  name: AERONAUT_CAVALRY.name,
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
      label: () => "Aeronaut Cavalry - Put a +1/+1 counter on another target Soldier you control.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
