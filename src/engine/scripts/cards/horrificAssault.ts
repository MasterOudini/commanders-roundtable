// `Horrific Assault` — the one-way bite with the Eldrazi rider: the gain
// only behind an Eldrazi on my board. D218.

import { HORRIFIC_ASSAULT } from '../../../data/fixtures/engineCards';
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
  HORRIFIC_ASSAULT,
  "Target creature you control deals damage equal to its power to target creature or planeswalker you don't control. If you control an Eldrazi, you gain 3 life.",
);

export const HORRIFIC_ASSAULT_SCRIPT: CardScript = {
  oracleId: HORRIFIC_ASSAULT.oracleId,
  name: HORRIFIC_ASSAULT.name,
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
      let eldrazi = false;
      for (const id of ctx.state.zones.battlefield) {
        const card = ctx.state.cards[id];
        if (!card || card.controller !== obj.controller) continue;
        if (ctx.derive(id).typeLine.subtypes.includes('Eldrazi')) {
          eldrazi = true;
          break;
        }
      }
      if (eldrazi) {
        const me = ctx.state.players[obj.controller];
        if (me && !me.hasLost) {
          events.push({ t: 'LifeChanged', player: obj.controller, delta: 3, to: me.life + 3 });
        }
      }
      return events;
    },
  },
};
