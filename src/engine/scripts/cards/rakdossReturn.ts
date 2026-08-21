// `Rakdos's Return` — "Rakdos's Return deals X damage to target opponent
// or planeswalker. That player or that planeswalker's controller
// discards X cards." The X burn whose aftermath is D137's ask at the
// TARGET — the ask comes LAST, and a hand of X or fewer goes whole and
// choicelessly (CR 701.8a, the Mind Burst rule). D237.

import { RAKDOS_S_RETURN } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript } from '../api';
import type { EventBody } from '../../types/events';
import type { PlayerId } from '../../types/ids';

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
  RAKDOS_S_RETURN,
  "Rakdos's Return deals X damage to target opponent or planeswalker. That player or that planeswalker's controller discards X cards.",
);

export const RAKDOSS_RETURN_SCRIPT: CardScript = {
  oracleId: RAKDOS_S_RETURN.oracleId,
  name: RAKDOS_S_RETURN.name,
  spell: {
    text: TEXT,
    resolve: (ctx, self, obj): readonly EventBody[] => {
      const x = obj.xValue ?? 0;
      const target = obj.targets[0];
      if (!target || x === 0) return [];
      let who: PlayerId | null = null;
      const events: EventBody[] = [];
      const hit = (
        to: { kind: 'card'; id: string } | { kind: 'player'; id: string },
      ): EventBody => ({
        t: 'DamageDealt',
        damages: [
          {
            source: self,
            target: to,
            amount: x,
            deathtouch: false,
            lifelinkTo: null,
            isCommanderDamage: false,
            viaTrample: 0,
            toxic: 0,
            applyAs: 'normal',
          },
        ],
      });
      if (target.kind === 'player') {
        const player = ctx.state.players[target.id];
        if (!player || player.hasLost) return [];
        who = target.id;
        events.push(hit({ kind: 'player', id: target.id }));
      } else if (target.kind === 'card') {
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield') return [];
        who = card.controller;
        events.push(hit({ kind: 'card', id: target.id }));
      } else {
        return [];
      }
      const victim = ctx.state.players[who];
      if (!victim || victim.hasLost) return events;
      const hand = ctx.state.zones.hand[who] ?? [];
      if (hand.length === 0) return events;
      if (hand.length <= x) {
        // CR 701.8a — no choice: the whole hand goes.
        const owner = who;
        events.push({
          t: 'CardsMoved',
          moves: hand.map((id) => ({
            card: id,
            from: { kind: 'hand' as const, player: owner },
            to: { kind: 'graveyard' as const, player: ctx.state.cards[id]?.owner ?? owner },
          })),
        });
        return events;
      }
      events.push({
        t: 'AwaitingSet',
        awaiting: {
          kind: 'chooseFromZone',
          player: who,
          zone: 'hand',
          rest: null,
          count: x,
          label: obj.label,
        },
      });
      return events;
    },
  },
};
