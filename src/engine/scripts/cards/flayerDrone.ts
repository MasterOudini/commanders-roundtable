// `Flayer Drone` - a anotherCreatureEnters trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { FLAYER_DRONE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(FLAYER_DRONE, "Devoid (This card has no color.)\nFirst strike\nWhenever another colorless creature you control enters, target opponent loses 1 life.");
const LINES = PRINTED.split('\n');

const VOCAB_L2 = vocabularyEffects("Target opponent loses 1 life.", FLAYER_DRONE.name);
const VOCAB_T_L2 = vocabularyTargets("Target opponent loses 1 life.");

export const FLAYER_DRONE_SCRIPT: CardScript = {
  oracleId: FLAYER_DRONE.oracleId,
  name: FLAYER_DRONE.name,
  triggers: [
    {
      abilityId: 'anotherCreatureEnters-2',
      text: LINES[2] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L2,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.card !== self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield' && ctx.state.cards[m.card]?.controller === ctx.query.controllerOf(self) && ctx.derive(m.card).typeLine.types.includes('Creature') && ctx.derive(m.card).colors.length === 0,
        ),
      label: () => "Flayer Drone - Target opponent loses 1 life.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L2, VOCAB_T_L2);
      },
    },
  ],
};
