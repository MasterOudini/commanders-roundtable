// `Ominous Sphinx` - a youDiscard trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { OMINOUS_SPHINX } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(OMINOUS_SPHINX, "Flying\nWhenever you cycle or discard a card, target creature an opponent controls gets -2/-0 until end of turn.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Target creature an opponent controls gets -2/-0 until end of turn.", OMINOUS_SPHINX.name);
const VOCAB_T_L1 = vocabularyTargets("Target creature an opponent controls gets -2/-0 until end of turn.");

export const OMINOUS_SPHINX_SCRIPT: CardScript = {
  oracleId: OMINOUS_SPHINX.oracleId,
  name: OMINOUS_SPHINX.name,
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
      label: () => "Ominous Sphinx - Target creature an opponent controls gets -2/-0 until end of turn.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
