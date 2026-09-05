// `Grim Guardian` - a constellation trigger loseLifeOpponents
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { GRIM_GUARDIAN } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(GRIM_GUARDIAN, "Constellation — Whenever this creature or another enchantment you control enters, each opponent loses 1 life.");

export const GRIM_GUARDIAN_SCRIPT: CardScript = {
  oracleId: GRIM_GUARDIAN.oracleId,
  name: GRIM_GUARDIAN.name,
  triggers: [
    {
      abilityId: 'constellation-0',
      text: PRINTED,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.to.kind === 'battlefield' && m.from.kind !== 'battlefield' && ctx.state.cards[m.card]?.controller === ctx.query.controllerOf(self) && (m.card === self || ctx.derive(m.card).typeLine.types.includes('Enchantment')),
        ),
      label: () => "Grim Guardian - loseLifeOpponents",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const out: EventBody[] = [];
        for (const [pid, p] of Object.entries(ctx.state.players)) {
          if (pid === obj.controller) continue;
          out.push({ t: 'LifeChanged', player: pid, delta: -1, to: p.life - 1 });
        }
        return out;
      },
    },
  ],
};
