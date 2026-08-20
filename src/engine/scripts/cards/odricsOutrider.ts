// `Odric's Outrider` — "Whenever this creature or another creature you
// control dies, put a +1/+1 counter on target creature you control." The
// self-inclusive dies watcher (looks back) with a targeted counter. D229.

import { ODRIC_S_OUTRIDER } from '../../../data/fixtures/engineCards';
import { parseTargetClauses } from '../../../data/targetParse';
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
  ODRIC_S_OUTRIDER,
  "Whenever this creature or another creature you control dies, put a +1/+1 counter on target creature you control.",
);

export const ODRICS_OUTRIDER_SCRIPT: CardScript = {
  oracleId: ODRIC_S_OUTRIDER.oracleId,
  name: ODRIC_S_OUTRIDER.name,
  triggers: [
    {
      abilityId: 'dies-counter',
      text: TEXT,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      looksBack: true,
      optional: false,
      targets: parseTargetClauses(TEXT),
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some((m) => {
          if (m.from.kind !== 'battlefield' || m.to.kind !== 'graveyard') return false;
          if (m.card === self) return true;
          const inst = ctx.state.cards[m.card];
          if (!inst || inst.controller !== ctx.query.controllerOf(self)) return false;
          return ctx.derive(m.card).typeLine.types.includes('Creature');
        }),
      label: () => "Odric's Outrider — put a +1/+1 counter on target creature you control",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        return ctx.state.cards[target.id]?.zone.kind === 'battlefield'
          ? [{ t: 'CountersChanged', changes: [{ card: target.id, kind: '+1/+1', delta: 1 }] }]
          : [];
      },
    },
  ],
};
