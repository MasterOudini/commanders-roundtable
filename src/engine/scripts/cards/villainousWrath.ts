// `Villainous Wrath` — the opponent's creature COUNT as life loss, THEN a
// wipe.
//
// ⚠️ The count is taken BEFORE the wipe, which is what the card says ("loses
// life equal to the number of creatures they control. THEN destroy all") —
// and `ctx.state` is the pre-resolution board, so reading it there is
// correct rather than convenient. The ordering rule has now bitten in three
// directions across four batches (D260 exclude, D264 include, this one
// simply reads first). D266.

import { VILLAINOUS_WRATH } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript } from '../api';
import type { EventBody } from '../../types/events';
import type { InstanceId } from '../../types/ids';

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
  VILLAINOUS_WRATH,
  'Target opponent loses life equal to the number of creatures they control. Then destroy all creatures.',
);

export const VILLAINOUS_WRATH_SCRIPT: CardScript = {
  oracleId: VILLAINOUS_WRATH.oracleId,
  name: VILLAINOUS_WRATH.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'player') return [];

      const events: EventBody[] = [];

      let theirs = 0;
      for (const id of ctx.state.zones.battlefield) {
        const inst = ctx.state.cards[id];
        if (!inst || inst.controller !== target.id) continue;
        if (ctx.derive(id).typeLine.types.includes('Creature')) theirs += 1;
      }
      const victim = ctx.state.players[target.id];
      if (theirs > 0 && victim && !victim.hasLost) {
        events.push({
          t: 'LifeChanged',
          player: target.id,
          delta: -theirs,
          to: victim.life - theirs,
        });
      }

      const moves: {
        card: InstanceId;
        from: { kind: 'battlefield'; player: string };
        to: { kind: 'graveyard'; player: string };
      }[] = [];
      for (const id of ctx.state.zones.battlefield) {
        const inst = ctx.state.cards[id];
        if (!inst) continue;
        const d = ctx.derive(id);
        if (!d.typeLine.types.includes('Creature')) continue;
        if (d.keywords.has('indestructible')) continue;
        moves.push({
          card: id,
          from: { kind: 'battlefield', player: inst.controller },
          to: { kind: 'graveyard', player: inst.owner },
        });
      }
      if (moves.length > 0) events.push({ t: 'CardsMoved', moves });
      return events;
    },
  },
};
