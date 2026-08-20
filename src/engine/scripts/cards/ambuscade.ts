// `Ambuscade` — "Target creature you control gets +1/+0 until end of turn.
// It deals damage equal to its power to target creature an opponent
// controls." The pump lands FIRST and the bite reads the power AFTER it —
// and because the pump is a KNOWN +1, the post-pump power is plain
// arithmetic over the derived value: a 2/2 bites for 3, which is the whole
// point of the card. The riders are read from the pre-pump derivation (a
// pump changes no keywords). D197.

import { AMBUSCADE } from '../../../data/fixtures/engineCards';
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
  AMBUSCADE,
  'Target creature you control gets +1/+0 until end of turn. It deals damage equal to its power to target creature an opponent controls.',
);

export const AMBUSCADE_SCRIPT: CardScript = {
  oracleId: AMBUSCADE.oracleId,
  name: AMBUSCADE.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const mine = obj.targets[0];
      const theirs = obj.targets[1];
      if (!mine || mine.kind !== 'card') return [];
      const source = ctx.state.cards[mine.id];
      if (source?.zone.kind !== 'battlefield') return [];
      const pump: EventBody = { t: 'PtModifiedUntilEndOfTurn', card: mine.id, power: 1, toughness: 0 };
      const events: EventBody[] = [pump];
      if (theirs && theirs.kind === 'card' && ctx.state.cards[theirs.id]?.zone.kind === 'battlefield') {
        const d = ctx.derive(mine.id);
        const power = (d.power ?? 0) + 1;
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
      return events;
    },
  },
};
