// `Steelclad Spirit` - a creatureEnters trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { STEELCLAD_SPIRIT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(STEELCLAD_SPIRIT, "Defender\nWhenever an enchantment you control enters, this creature can attack this turn as though it didn't have defender.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("~ can attack this turn as though it didn't have defender.", STEELCLAD_SPIRIT.name);
const VOCAB_T_L1 = vocabularyTargets("~ can attack this turn as though it didn't have defender.");

export const STEELCLAD_SPIRIT_SCRIPT: CardScript = {
  oracleId: STEELCLAD_SPIRIT.oracleId,
  name: STEELCLAD_SPIRIT.name,
  triggers: [
    {
      abilityId: 'creatureEnters-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.to.kind === 'battlefield' && m.from.kind !== 'battlefield' && ctx.state.cards[m.card]?.controller === ctx.query.controllerOf(self) && ctx.derive(m.card).typeLine.types.includes('Enchantment'),
        ),
      label: () => "Steelclad Spirit - ~ can attack this turn as though it didn't have defender.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
