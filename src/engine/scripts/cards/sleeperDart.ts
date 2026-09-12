// `Sleeper Dart` - a etb trigger draw, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SLEEPER_DART } from '../../../data/fixtures/engineCards';
import { drawEvents } from '../../effects';
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

const PRINTED = printed(SLEEPER_DART, "When this artifact enters, draw a card.\n{T}, Sacrifice this artifact: Target creature doesn't untap during its controller's next untap step.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Target creature doesn't untap during its controller's next untap step.", SLEEPER_DART.name);
const VOCAB_T_A0 = vocabularyTargets("Target creature doesn't untap during its controller's next untap step.");

export const SLEEPER_DART_SCRIPT: CardScript = {
  oracleId: SLEEPER_DART.oracleId,
  name: SLEEPER_DART.name,
  activated: [
    {
      ref: `${SLEEPER_DART.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
  triggers: [
    {
      abilityId: 'etb-0',
      text: LINES[0] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Sleeper Dart - draw",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return drawEvents(ctx.state, obj.controller, 1);
      },
    },
  ],
};
