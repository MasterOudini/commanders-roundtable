// `Dying to Serve` - a youDiscard trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { DYING_TO_SERVE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(DYING_TO_SERVE, "Whenever you discard one or more cards, create a tapped 2/2 black Zombie creature token. This ability triggers only once each turn.");

const VOCAB_L0 = vocabularyEffects("Create a tapped 2/2 black Zombie creature token.", DYING_TO_SERVE.name);
const VOCAB_T_L0 = vocabularyTargets("Create a tapped 2/2 black Zombie creature token.");

export const DYING_TO_SERVE_SCRIPT: CardScript = {
  oracleId: DYING_TO_SERVE.oracleId,
  name: DYING_TO_SERVE.name,
  triggers: [
    {
      abilityId: 'youDiscard-0',
      text: PRINTED,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      oncePerTurn: true,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.reason === 'discard' && m.from.kind === 'hand' && m.from.player === ctx.query.controllerOf(self),
        ),
      label: () => "Dying to Serve - Create a tapped 2/2 black Zombie creature token.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
