// `Corridor Monitor` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { CORRIDOR_MONITOR } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(CORRIDOR_MONITOR, "When this creature enters, untap target artifact or creature you control.");

const VOCAB_L0 = vocabularyEffects("Untap target artifact or creature you control.", CORRIDOR_MONITOR.name);
const VOCAB_T_L0 = vocabularyTargets("Untap target artifact or creature you control.");

export const CORRIDOR_MONITOR_SCRIPT: CardScript = {
  oracleId: CORRIDOR_MONITOR.oracleId,
  name: CORRIDOR_MONITOR.name,
  triggers: [
    {
      abilityId: 'etb-0',
      text: PRINTED,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L0,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Corridor Monitor - Untap target artifact or creature you control.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
