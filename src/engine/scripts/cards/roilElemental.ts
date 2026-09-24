// `Roil Elemental` - a landfall trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ROIL_ELEMENTAL } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ROIL_ELEMENTAL, "Flying\nLandfall — Whenever a land you control enters, you may gain control of target creature for as long as you control this creature.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Gain control of target creature for as long as you control this creature.", ROIL_ELEMENTAL.name);
const VOCAB_T_L1 = vocabularyTargets("Gain control of target creature for as long as you control this creature.");

export const ROIL_ELEMENTAL_SCRIPT: CardScript = {
  oracleId: ROIL_ELEMENTAL.oracleId,
  name: ROIL_ELEMENTAL.name,
  triggers: [
    {
      abilityId: 'landfall-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: true,
      targets: VOCAB_T_L1,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.to.kind === 'battlefield' && m.from.kind !== 'battlefield' && ctx.state.cards[m.card]?.controller === ctx.query.controllerOf(self) && ctx.derive(m.card).typeLine.types.includes('Land'),
        ),
      label: () => "Roil Elemental - Gain control of target creature for as long as you control this creature.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
