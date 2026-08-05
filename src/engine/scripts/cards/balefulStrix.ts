// `Baleful Strix` — `{U}{B}` 1/1 Artifact Creature, "Flying, deathtouch\nWhen
// this creature enters, draw a card." Both keywords are Tier-2's (enforced
// since M1/M5); this script owes the trigger line and claims exactly that
// (M6.4a, D158 — §7 rung 2, already dealt in the fuzz DECK).

import { BALEFUL_STRIX } from '../../../data/fixtures/engineCards';
import { drawEvents } from '../../effects';
import type { CardData } from '../../../data/cardTypes';
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

const PRINTED = printed(BALEFUL_STRIX, 'Flying, deathtouch\nWhen this creature enters, draw a card.');
const TEXT = PRINTED.split('\n')[1] as string;

export const BALEFUL_STRIX_SCRIPT: CardScript = {
  oracleId: BALEFUL_STRIX.oracleId,
  name: BALEFUL_STRIX.name,
  triggers: [
    {
      abilityId: 'etb',
      text: TEXT,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield',
        ),
      label: () => 'Baleful Strix — draw a card',
      resolve: (ctx, _self, obj): readonly EventBody[] => drawEvents(ctx.state, obj.controller, 1),
    },
  ],
};
