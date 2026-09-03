// `Hissing Miasma` - "Whenever a creature attacks you, its controller loses 1 life."
// - once PER attacking creature (per-item, D185; `obj.item` is the attacker),
// counting only the ones attacking this enchantment's controller. Whole after
// D295's "its controller loses N life" sentence reading.

import { HISSING_MIASMA } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(HISSING_MIASMA, 'Whenever a creature attacks you, its controller loses 1 life.');

export const HISSING_MIASMA_SCRIPT: CardScript = {
  oracleId: HISSING_MIASMA.oracleId,
  name: HISSING_MIASMA.name,
  triggers: [
    {
      abilityId: 'attacked',
      text: TEXT,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      targets: [],
      matches: (_ctx, _self, ev) => ev.t === 'AttackersDeclared',
      perItem: (ctx, self, ev) => {
        if (ev.t !== 'AttackersDeclared') return [];
        const me = ctx.query.controllerOf(self);
        return ev.attackers.filter((a) => a.defender.kind === 'player' && a.defender.id === me).map((a) => a.card);
      },
      label: () => 'Hissing Miasma - its controller loses 1 life',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const attacker = obj.item ? ctx.state.cards[obj.item] : undefined;
        if (!attacker) return [];
        const who = ctx.state.players[attacker.controller];
        if (!who) return [];
        return [{ t: 'LifeChanged', player: attacker.controller, delta: -1, to: who.life - 1 }];
      },
    },
  ],
};
