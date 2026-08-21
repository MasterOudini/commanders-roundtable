// `Spoils of Evil` — the census RITUAL over a target OPPONENT'S graveyard
// (the restriction probed and enforced): {C} and a life per artifact or
// creature card, typed off the ORACLE face. D251.

import { SPOILS_OF_EVIL } from '../../../data/fixtures/engineCards';
import { faceOf } from '../../oracle';
import { EMPTY_POOL } from '../../types/mana';
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
  SPOILS_OF_EVIL,
  "For each artifact or creature card in target opponent's graveyard, add {C} and you gain 1 life.",
);

export const SPOILS_OF_EVIL_SCRIPT: CardScript = {
  oracleId: SPOILS_OF_EVIL.oracleId,
  name: SPOILS_OF_EVIL.name,
  spell: {
    text: TEXT,
    resolve: (ctx, self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'player') return [];
      let n = 0;
      for (const id of ctx.state.zones.graveyard[target.id] ?? []) {
        const inst = ctx.state.cards[id];
        if (!inst) continue;
        const oc = ctx.oracle.byPrinting(inst.printingId);
        if (!oc) continue;
        const types = faceOf(oc, inst.faceIndex).typeLine.types;
        if (types.includes('Artifact') || types.includes('Creature')) n += 1;
      }
      if (n <= 0) return [];
      const events: EventBody[] = [
        { t: 'ManaAdded', player: obj.controller, mana: { ...EMPTY_POOL, C: n }, source: self },
      ];
      const player = ctx.state.players[obj.controller];
      if (player && !player.hasLost) {
        events.push({ t: 'LifeChanged', player: obj.controller, delta: n, to: player.life + n });
      }
      return events;
    },
  },
};
