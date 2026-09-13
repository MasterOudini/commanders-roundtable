// `Midnight Reaper` - a anotherCreatureDies trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { MIDNIGHT_REAPER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(MIDNIGHT_REAPER, "Whenever a nontoken creature you control dies, this creature deals 1 damage to you and you draw a card.");

const VOCAB_L0 = vocabularyEffects("~ deals 1 damage to you and you draw a card.", MIDNIGHT_REAPER.name);
const VOCAB_T_L0 = vocabularyTargets("~ deals 1 damage to you and you draw a card.");

export const MIDNIGHT_REAPER_SCRIPT: CardScript = {
  oracleId: MIDNIGHT_REAPER.oracleId,
  name: MIDNIGHT_REAPER.name,
  triggers: [
    {
      abilityId: 'anotherCreatureDies-0',
      text: PRINTED,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.from.kind === 'battlefield' && m.to.kind === 'graveyard' && ctx.state.cards[m.card]?.controller === ctx.query.controllerOf(self) && ctx.derive(m.card).typeLine.types.includes('Creature') && !ctx.state.cards[m.card]?.isToken,
        ),
      label: () => "Midnight Reaper - ~ deals 1 damage to you and you draw a card.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
