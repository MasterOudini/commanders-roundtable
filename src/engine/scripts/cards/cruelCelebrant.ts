// `Cruel Celebrant` - a dies trigger drain, a anotherCreatureDies trigger drain
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { CRUEL_CELEBRANT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(CRUEL_CELEBRANT, "Whenever this creature or another creature or planeswalker you control dies, each opponent loses 1 life and you gain 1 life.");

export const CRUEL_CELEBRANT_SCRIPT: CardScript = {
  oracleId: CRUEL_CELEBRANT.oracleId,
  name: CRUEL_CELEBRANT.name,
  triggers: [
    {
      abilityId: 'dies-0',
      text: PRINTED,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      matches: (_ctx, self, ev) => ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.from.kind === 'battlefield' && m.to.kind === 'graveyard'),
      label: () => "Cruel Celebrant - drain",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const out: EventBody[] = [];
        for (const [pid, p] of Object.entries(ctx.state.players)) {
          if (pid === obj.controller) continue;
          out.push({ t: 'LifeChanged', player: pid, delta: -1, to: p.life - 1 });
        }
        const me = ctx.state.players[obj.controller];
        if (me) out.push({ t: 'LifeChanged', player: obj.controller, delta: 1, to: me.life + 1 });
        return out;
      },
    },
    {
      abilityId: 'anotherCreatureDies-0',
      text: PRINTED,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.card !== self && m.from.kind === 'battlefield' && m.to.kind === 'graveyard' && ctx.state.cards[m.card]?.controller === ctx.query.controllerOf(self) && (ctx.derive(m.card).typeLine.types.includes('Creature') || ctx.derive(m.card).typeLine.types.includes('Planeswalker')),
        ),
      label: () => "Cruel Celebrant - drain",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const out: EventBody[] = [];
        for (const [pid, p] of Object.entries(ctx.state.players)) {
          if (pid === obj.controller) continue;
          out.push({ t: 'LifeChanged', player: pid, delta: -1, to: p.life - 1 });
        }
        const me = ctx.state.players[obj.controller];
        if (me) out.push({ t: 'LifeChanged', player: obj.controller, delta: 1, to: me.life + 1 });
        return out;
      },
    },
  ],
};
