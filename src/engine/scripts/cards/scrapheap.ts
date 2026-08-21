// `Scrapheap` — "Whenever an artifact or enchantment is put into your
// graveyard from the battlefield, you gain 1 life." The SIXTH perItem
// consumer: one gain per qualifying corpse, typed on the BEFORE state.
// D244.

import { SCRAPHEAP } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript, ScriptCtx } from '../api';
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
  SCRAPHEAP,
  'Whenever an artifact or enchantment is put into your graveyard from the battlefield, you gain 1 life.',
);

function qualifies(ctx: ScriptCtx, dead: InstanceId): boolean {
  const types = ctx.derive(dead).typeLine.types;
  return types.includes('Artifact') || types.includes('Enchantment');
}

export const SCRAPHEAP_SCRIPT: CardScript = {
  oracleId: SCRAPHEAP.oracleId,
  name: SCRAPHEAP.name,
  triggers: [
    {
      abilityId: 'scrapped-gain',
      text: TEXT,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      looksBack: true,
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) =>
            m.from.kind === 'battlefield' &&
            m.to.kind === 'graveyard' &&
            m.to.player === ctx.query.controllerOf(self) &&
            qualifies(ctx, m.card),
        ),
      // One firing PER qualifying corpse.
      perItem: (ctx, self, ev) =>
        ev.t === 'CardsMoved'
          ? ev.moves
              .filter(
                (m) =>
                  m.from.kind === 'battlefield' &&
                  m.to.kind === 'graveyard' &&
                  m.to.player === ctx.query.controllerOf(self) &&
                  qualifies(ctx, m.card),
              )
              .map((m) => m.card)
          : [],
      label: () => 'Scrapheap — you gain 1 life',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const player = ctx.state.players[obj.controller];
        if (!player || player.hasLost) return [];
        return [{ t: 'LifeChanged', player: obj.controller, delta: 1, to: player.life + 1 }];
      },
    },
  ],
};
