// `Paleoloth` - a anotherCreatureEnters trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { PALEOLOTH } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(PALEOLOTH, "Whenever another creature you control with power 5 or greater enters, you may return target creature card from your graveyard to your hand.");

const VOCAB_L0 = vocabularyEffects("Return target creature card from your graveyard to your hand.", PALEOLOTH.name);
const VOCAB_T_L0 = vocabularyTargets("Return target creature card from your graveyard to your hand.");

export const PALEOLOTH_SCRIPT: CardScript = {
  oracleId: PALEOLOTH.oracleId,
  name: PALEOLOTH.name,
  triggers: [
    {
      abilityId: 'anotherCreatureEnters-0',
      text: PRINTED,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: true,
      targets: VOCAB_T_L0,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.card !== self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield' && ctx.state.cards[m.card]?.controller === ctx.query.controllerOf(self) && ctx.derive(m.card).typeLine.types.includes('Creature') && (ctx.derive(m.card).power ?? 0) >= 5,
        ),
      label: () => "Paleoloth - Return target creature card from your graveyard to your hand.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
