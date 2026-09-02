// `Niv-Mizzet, the Firemind` — "Flying\nWhenever you draw a card, Niv-Mizzet
// deals 1 damage to any target.\n{T}: Draw a card." Horizon Chimera's
// per-card draw watcher (DrewCards fanned out PER ITEM, D190) with a target
// — aimed as each firing goes on the stack — and the damage sourced from
// Niv-Mizzet's derived self; the tap draws, which fires the watcher once.
// The keyword line is the engine's. D278.

import { NIV_MIZZET_THE_FIREMIND } from '../../../data/fixtures/engineCards';
import { parseTargetClauses } from '../../../data/targetParse';
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

const PRINTED = printed(
  NIV_MIZZET_THE_FIREMIND,
  'Flying\nWhenever you draw a card, Niv-Mizzet deals 1 damage to any target.\n{T}: Draw a card.',
);
const PING = PRINTED.split('\n')[1] as string;
const DRAW = PRINTED.split('\n')[2] as string;

export const NIV_MIZZET_THE_FIREMIND_SCRIPT: CardScript = {
  oracleId: NIV_MIZZET_THE_FIREMIND.oracleId,
  name: NIV_MIZZET_THE_FIREMIND.name,
  triggers: [
    {
      abilityId: 'draw-ping',
      text: PING,
      event: 'DrewCards',
      activeZones: ['battlefield'],
      optional: false,
      targets: parseTargetClauses(PING),
      matches: (ctx, self, ev) => ev.t === 'DrewCards' && ev.player === ctx.query.controllerOf(self),
      perItem: (_ctx, _self, ev) => (ev.t === 'DrewCards' ? ev.cards : []),
      label: () => 'Niv-Mizzet, the Firemind — 1 damage to any target',
      resolve: (ctx, self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind === 'stack') return [];
        if (target.kind === 'card' && ctx.state.cards[target.id]?.zone.kind !== 'battlefield') return [];
        if (target.kind === 'player') {
          const them = ctx.state.players[target.id];
          if (!them || them.hasLost) return [];
        }
        const d = ctx.derive(self);
        return [
          {
            t: 'DamageDealt',
            damages: [
              {
                source: self,
                target: target.kind === 'player' ? { kind: 'player', id: target.id } : { kind: 'card', id: target.id },
                amount: 1,
                deathtouch: d.keywords.has('deathtouch'),
                lifelinkTo: d.keywords.has('lifelink') ? obj.controller : null,
                isCommanderDamage: false,
                viaTrample: 0,
                toxic: d.toxicAmount,
                applyAs: d.keywords.has('infect') || d.keywords.has('wither') ? 'wither' : 'normal',
              },
            ],
          },
        ];
      },
    },
  ],
  activated: [
    {
      ref: `${NIV_MIZZET_THE_FIREMIND.oracleId}#a0`,
      text: DRAW,
      resolve: (ctx, _self, obj): readonly EventBody[] => drawEvents(ctx.state, obj.controller, 1),
    },
  ],
};
