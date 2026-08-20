// `Infectious Bite` — the one-way bite plus a poison counter for each
// opponent, bitten or not. D219.

import { INFECTIOUS_BITE } from '../../../data/fixtures/engineCards';
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
  INFECTIOUS_BITE,
  "Target creature you control deals damage equal to its power to target creature you don't control. Each opponent gets a poison counter.",
);

export const INFECTIOUS_BITE_SCRIPT: CardScript = {
  oracleId: INFECTIOUS_BITE.oracleId,
  name: INFECTIOUS_BITE.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const events: EventBody[] = [];
      const mine = obj.targets[0];
      const theirs = obj.targets[1];
      if (mine && mine.kind === 'card' && theirs && theirs.kind === 'card') {
        const source = ctx.state.cards[mine.id];
        if (
          source?.zone.kind === 'battlefield' &&
          ctx.state.cards[theirs.id]?.zone.kind === 'battlefield'
        ) {
          const d = ctx.derive(mine.id);
          const power = d.power ?? 0;
          if (power > 0) {
            events.push({
              t: 'DamageDealt',
              damages: [
                {
                  source: mine.id,
                  target: { kind: 'card', id: theirs.id },
                  amount: power,
                  deathtouch: d.keywords.has('deathtouch'),
                  lifelinkTo: d.keywords.has('lifelink') ? source.controller : null,
                  isCommanderDamage: false,
                  viaTrample: 0,
                  toxic: d.toxicAmount,
                  applyAs:
                    d.keywords.has('infect') || d.keywords.has('wither') ? 'wither' : 'normal',
                },
              ],
            });
          }
        }
      }
      for (const pid of ctx.state.seating) {
        if (pid === obj.controller) continue;
        const p = ctx.state.players[pid];
        if (!p || p.hasLost) continue;
        events.push({ t: 'PoisonChanged', player: pid, delta: 1, to: p.poison + 1 });
      }
      return events;
    },
  },
};
