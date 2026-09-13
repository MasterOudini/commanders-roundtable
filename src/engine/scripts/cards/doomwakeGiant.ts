// `Doomwake Giant` - a constellation trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { DOOMWAKE_GIANT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(DOOMWAKE_GIANT, "Constellation — Whenever this creature or another enchantment you control enters, creatures your opponents control get -1/-1 until end of turn.");

const VOCAB_L0 = vocabularyEffects("Creatures your opponents control get -1/-1 until end of turn.", DOOMWAKE_GIANT.name);
const VOCAB_T_L0 = vocabularyTargets("Creatures your opponents control get -1/-1 until end of turn.");

export const DOOMWAKE_GIANT_SCRIPT: CardScript = {
  oracleId: DOOMWAKE_GIANT.oracleId,
  name: DOOMWAKE_GIANT.name,
  triggers: [
    {
      abilityId: 'constellation-0',
      text: PRINTED,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.to.kind === 'battlefield' && m.from.kind !== 'battlefield' && ctx.state.cards[m.card]?.controller === ctx.query.controllerOf(self) && (m.card === self || ctx.derive(m.card).typeLine.types.includes('Enchantment')),
        ),
      label: () => "Doomwake Giant - Creatures your opponents control get -1/-1 until end of turn.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
