// `Quicksmith Genius` - a artifactEnters trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { QUICKSMITH_GENIUS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(QUICKSMITH_GENIUS, "Whenever an artifact you control enters, you may discard a card. If you do, draw a card.");

const VOCAB_L0 = vocabularyEffects("You may discard a card. If you do, draw a card.", QUICKSMITH_GENIUS.name);
const VOCAB_T_L0 = vocabularyTargets("You may discard a card. If you do, draw a card.");

export const QUICKSMITH_GENIUS_SCRIPT: CardScript = {
  oracleId: QUICKSMITH_GENIUS.oracleId,
  name: QUICKSMITH_GENIUS.name,
  triggers: [
    {
      abilityId: 'artifactEnters-0',
      text: PRINTED,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.to.kind === 'battlefield' && m.from.kind !== 'battlefield' && ctx.state.cards[m.card]?.controller === ctx.query.controllerOf(self) && ctx.derive(m.card).typeLine.types.includes('Artifact'),
        ),
      label: () => "Quicksmith Genius - You may discard a card. If you do, draw a card.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
