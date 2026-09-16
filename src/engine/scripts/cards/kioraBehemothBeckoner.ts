// `Kiora, Behemoth Beckoner` - a creatureEnters trigger draw, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { KIORA_BEHEMOTH_BECKONER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(KIORA_BEHEMOTH_BECKONER, "Whenever a creature you control with power 4 or greater enters, draw a card.\n−1: Untap target permanent.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Untap target permanent.", KIORA_BEHEMOTH_BECKONER.name);
const VOCAB_T_A0 = vocabularyTargets("Untap target permanent.");

export const KIORA_BEHEMOTH_BECKONER_SCRIPT: CardScript = {
  oracleId: KIORA_BEHEMOTH_BECKONER.oracleId,
  name: KIORA_BEHEMOTH_BECKONER.name,
  activated: [
    {
      ref: `${KIORA_BEHEMOTH_BECKONER.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
  triggers: [
    {
      abilityId: 'creatureEnters-0',
      text: LINES[0] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.to.kind === 'battlefield' && m.from.kind !== 'battlefield' && ctx.state.cards[m.card]?.controller === ctx.query.controllerOf(self) && ctx.derive(m.card).typeLine.types.includes('Creature') && (ctx.derive(m.card).power ?? 0) >= 4,
        ),
      label: () => "Kiora, Behemoth Beckoner - draw",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return drawEvents(ctx.state, obj.controller, 1);
      },
    },
  ],
};
