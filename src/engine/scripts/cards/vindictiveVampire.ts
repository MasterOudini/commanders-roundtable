// `Vindictive Vampire` - a anotherCreatureDies trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { VINDICTIVE_VAMPIRE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(VINDICTIVE_VAMPIRE, "Whenever another creature you control dies, this creature deals 1 damage to each opponent and you gain 1 life.");

const VOCAB_L0 = vocabularyEffects("~ deals 1 damage to each opponent and you gain 1 life.", VINDICTIVE_VAMPIRE.name);
const VOCAB_T_L0 = vocabularyTargets("~ deals 1 damage to each opponent and you gain 1 life.");

export const VINDICTIVE_VAMPIRE_SCRIPT: CardScript = {
  oracleId: VINDICTIVE_VAMPIRE.oracleId,
  name: VINDICTIVE_VAMPIRE.name,
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
          (m) => m.card !== self && m.from.kind === 'battlefield' && m.to.kind === 'graveyard' && ctx.state.cards[m.card]?.controller === ctx.query.controllerOf(self) && ctx.derive(m.card).typeLine.types.includes('Creature'),
        ),
      label: () => "Vindictive Vampire - ~ deals 1 damage to each opponent and you gain 1 life.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
