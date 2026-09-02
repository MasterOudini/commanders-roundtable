// `Unhinge` — the target player chooses a card of their hand to discard; I
// draw. The ask goes LAST (D195), after my draw, and only when they hold a
// card at all.

import { UNHINGE } from '../../../data/fixtures/engineCards';
import { drawEvents } from '../../effects';
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

const TEXT = printed(UNHINGE, 'Target player discards a card.\nDraw a card.');

export const UNHINGE_SCRIPT: CardScript = {
  oracleId: UNHINGE.oracleId,
  name: UNHINGE.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'player') return [];
      const victim = ctx.state.players[target.id];
      if (!victim || victim.hasLost) return [];
      const events: EventBody[] = [...drawEvents(ctx.state, obj.controller, 1)];
      // Their hand AFTER my draw: my draw never touches it unless I am the
      // target, in which case the drawn card is in the hand they choose from.
      const before = (ctx.state.zones.hand[target.id] ?? []).length;
      const library = ctx.state.zones.library[obj.controller] ?? [];
      const after = target.id === obj.controller ? before + Math.min(1, library.length) : before;
      if (after === 0) return events;
      events.push({
        t: 'AwaitingSet',
        awaiting: { kind: 'chooseFromZone', player: target.id, zone: 'hand', rest: null, count: 1, label: obj.label },
      });
      return events;
    },
  },
};
