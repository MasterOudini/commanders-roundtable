// `Archfiend of Ifnir` - a youDiscard trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ARCHFIEND_OF_IFNIR } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ARCHFIEND_OF_IFNIR, "Flying\nWhenever you cycle or discard another card, put a -1/-1 counter on each creature your opponents control.\nCycling {2} ({2}, Discard this card: Draw a card.)");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Put a -1/-1 counter on each creature your opponents control.", ARCHFIEND_OF_IFNIR.name);
const VOCAB_T_L1 = vocabularyTargets("Put a -1/-1 counter on each creature your opponents control.");

export const ARCHFIEND_OF_IFNIR_SCRIPT: CardScript = {
  oracleId: ARCHFIEND_OF_IFNIR.oracleId,
  name: ARCHFIEND_OF_IFNIR.name,
  triggers: [
    {
      abilityId: 'youDiscard-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => (m.reason === 'cycling' || m.reason === 'discard') && m.from.kind === 'hand' && m.card !== self && m.from.player === ctx.query.controllerOf(self),
        ),
      label: () => "Archfiend of Ifnir - Put a -1/-1 counter on each creature your opponents control.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
