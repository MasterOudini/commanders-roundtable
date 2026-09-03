// `Wretched Anurid` - "Whenever another creature enters, you lose 1 life." - once
// PER creature (the bus's per-item mode, D185), for cards and for tokens.
// Whole after D295's "you lose N life" sentence reading.

import { WRETCHED_ANURID } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript, ScriptCtx } from '../api';
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

const TEXT = printed(WRETCHED_ANURID, 'Whenever another creature enters, you lose 1 life.');

function loseOne(ctx: ScriptCtx, controller: PlayerId): readonly EventBody[] {
  const me = ctx.state.players[controller];
  if (!me) return [];
  return [{ t: 'LifeChanged', player: controller, delta: -1, to: me.life - 1 }];
}

export const WRETCHED_ANURID_SCRIPT: CardScript = {
  oracleId: WRETCHED_ANURID.oracleId,
  name: WRETCHED_ANURID.name,
  triggers: [
    {
      abilityId: 'another-creature-enters',
      text: TEXT,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: [],
      matches: (_ctx, _self, ev) => ev.t === 'CardsMoved',
      perItem: (ctx, self, ev) =>
        ev.t !== 'CardsMoved'
          ? []
          : ev.moves
              .filter((m) => m.card !== self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield' && ctx.derive(m.card).typeLine.types.includes('Creature'))
              .map((m) => m.card),
      label: () => 'Wretched Anurid - lose 1 life',
      resolve: (ctx, _self, obj): readonly EventBody[] => loseOne(ctx, obj.controller),
    },
    {
      abilityId: 'another-token-enters',
      text: TEXT,
      event: 'TokenCreated',
      activeZones: ['battlefield'],
      optional: false,
      targets: [],
      matches: (_ctx, _self, ev) => ev.t === 'TokenCreated',
      perItem: (ctx, self, ev) => (ev.t === 'TokenCreated' && ev.card !== self && ctx.derive(ev.card).typeLine.types.includes('Creature') ? [ev.card] : []),
      label: () => 'Wretched Anurid - lose 1 life',
      resolve: (ctx, _self, obj): readonly EventBody[] => loseOne(ctx, obj.controller),
    },
  ],
};
