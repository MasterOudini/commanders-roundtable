// `Dictate of Erebos` - a creatureYouControlDies trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { DICTATE_OF_EREBOS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(DICTATE_OF_EREBOS, "Flash\nWhenever a creature you control dies, each opponent sacrifices a creature of their choice.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Each opponent sacrifices a creature of their choice.", DICTATE_OF_EREBOS.name);
const VOCAB_T_L1 = vocabularyTargets("Each opponent sacrifices a creature of their choice.");

export const DICTATE_OF_EREBOS_SCRIPT: CardScript = {
  oracleId: DICTATE_OF_EREBOS.oracleId,
  name: DICTATE_OF_EREBOS.name,
  triggers: [
    {
      abilityId: 'creatureYouControlDies-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.from.kind === 'battlefield' && m.to.kind === 'graveyard' && ctx.state.cards[m.card]?.controller === ctx.query.controllerOf(self) && ctx.derive(m.card).typeLine.types.includes('Creature'),
        ),
      label: () => "Dictate of Erebos - Each opponent sacrifices a creature of their choice.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
