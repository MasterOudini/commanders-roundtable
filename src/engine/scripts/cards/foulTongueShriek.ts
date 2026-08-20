// `Foul-Tongue Shriek` — "Target opponent loses 1 life for each attacking
// creature you control. You gain that much life." Dogpile's combat count
// as a drain, cast in the attacker's own window. D214.

import { FOUL_TONGUE_SHRIEK } from '../../../data/fixtures/engineCards';
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
  FOUL_TONGUE_SHRIEK,
  'Target opponent loses 1 life for each attacking creature you control. You gain that much life.',
);

export const FOUL_TONGUE_SHRIEK_SCRIPT: CardScript = {
  oracleId: FOUL_TONGUE_SHRIEK.oracleId,
  name: FOUL_TONGUE_SHRIEK.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'player') return [];
      const p = ctx.state.players[target.id];
      if (!p || p.hasLost) return [];
      let n = 0;
      for (const a of ctx.state.combat?.attackers ?? []) {
        const card = ctx.state.cards[a.card];
        if (!card || card.zone.kind !== 'battlefield') continue;
        if (card.controller !== obj.controller) continue;
        n++;
      }
      if (n === 0) return [];
      const events: EventBody[] = [
        { t: 'LifeChanged', player: target.id, delta: -n, to: p.life - n },
      ];
      const me = ctx.state.players[obj.controller];
      if (me && !me.hasLost) {
        events.push({ t: 'LifeChanged', player: obj.controller, delta: n, to: me.life + n });
      }
      return events;
    },
  },
};
