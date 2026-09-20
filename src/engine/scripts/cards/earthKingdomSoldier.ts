// `Earth Kingdom Soldier` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { EARTH_KINGDOM_SOLDIER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(EARTH_KINGDOM_SOLDIER, "Vigilance\nWhen this creature enters, put a +1/+1 counter on each of up to two target creatures you control.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Put a +1/+1 counter on each of up to two target creatures you control.", EARTH_KINGDOM_SOLDIER.name);
const VOCAB_T_L1 = vocabularyTargets("Put a +1/+1 counter on each of up to two target creatures you control.");

export const EARTH_KINGDOM_SOLDIER_SCRIPT: CardScript = {
  oracleId: EARTH_KINGDOM_SOLDIER.oracleId,
  name: EARTH_KINGDOM_SOLDIER.name,
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
      label: () => "Earth Kingdom Soldier - Put a +1/+1 counter on each of up to two target creatures you control.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
