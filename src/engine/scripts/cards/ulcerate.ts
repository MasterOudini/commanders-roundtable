// `Ulcerate` — -3/-3 and a 3-life bill on ME. The bill is NOT conditioned on
// the debuff landing: an illegal target fizzles the whole spell (CR 608.2b,
// handled by the engine), but a target that survives still costs the life.
// D263.

import { ULCERATE } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(ULCERATE, 'Target creature gets -3/-3 until end of turn. You lose 3 life.');

export const ULCERATE_SCRIPT: CardScript = {
  oracleId: ULCERATE.oracleId,
  name: ULCERATE.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const events: EventBody[] = [];
      const target = obj.targets[0];
      if (target && target.kind === 'card' && ctx.state.cards[target.id]?.zone.kind === 'battlefield') {
        events.push({ t: 'PtModifiedUntilEndOfTurn', card: target.id, power: -3, toughness: -3 });
      }
      const me = ctx.state.players[obj.controller];
      if (me && !me.hasLost) {
        events.push({ t: 'LifeChanged', player: obj.controller, delta: -3, to: me.life - 3 });
      }
      return events;
    },
  },
};
