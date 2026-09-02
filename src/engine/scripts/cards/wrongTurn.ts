// `Wrong Turn` — "Target opponent gains control of target creature."
//
// ⚠️ TWO specs, and the resolve reads them BY KIND — the player pick and the
// card pick cannot be confused whatever order the answer arrives in, which
// makes this D255-safe without a controller test. `ControlChanged` is the
// event Donate and Harmless Offering already ship. The reminder text about
// combat is the ENGINE's job (a controller change removes from combat), not
// this def's. D271.

import { WRONG_TURN } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(
  WRONG_TURN,
  "Target opponent gains control of target creature. (If an attacking or blocking creature changes controllers, it's removed from combat.)",
);

export const WRONG_TURN_SCRIPT: CardScript = {
  oracleId: WRONG_TURN.oracleId,
  name: WRONG_TURN.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const opponent = obj.targets.find((t) => t.kind === 'player');
      const creature = obj.targets.find((t) => t.kind === 'card');
      if (!opponent || opponent.kind !== 'player') return [];
      if (!creature || creature.kind !== 'card') return [];
      const victim = ctx.state.players[opponent.id];
      if (!victim || victim.hasLost) return [];
      const card = ctx.state.cards[creature.id];
      if (!card || card.zone.kind !== 'battlefield') return [];
      if (card.controller === opponent.id) return [];
      return [{ t: 'ControlChanged', card: creature.id, controller: opponent.id }];
    },
  },
};
