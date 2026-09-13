// `Zenith Seeker` - a youDiscard trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ZENITH_SEEKER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ZENITH_SEEKER, "Flying\nWhenever you cycle or discard a card, target creature gains flying until end of turn.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Target creature gains flying until end of turn.", ZENITH_SEEKER.name);
const VOCAB_T_L1 = vocabularyTargets("Target creature gains flying until end of turn.");

export const ZENITH_SEEKER_SCRIPT: CardScript = {
  oracleId: ZENITH_SEEKER.oracleId,
  name: ZENITH_SEEKER.name,
  triggers: [
    {
      abilityId: 'youDiscard-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L1,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => (m.reason === 'cycling' || m.reason === 'discard') && m.from.kind === 'hand' && m.from.player === ctx.query.controllerOf(self),
        ),
      label: () => "Zenith Seeker - Target creature gains flying until end of turn.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
