// `Vibrant Outburst` — THE FIRST UP-TO-N CARD THE ARC HAS LANDED.
//
// ⚠️ Its second clause, "Tap up to one target creature", PROBED as
// **min 0 / max 1** — correctly. D262 found `up-to-N targeting` is a set of
// PARSE FAILURES rather than one missing feature; this is the other half of
// that finding, and it means the forms that DO parse are landable today. The
// chooser is owed only for the forms that do not.
// ⚠️ TWO specs, so the resolve identifies them BY POSITION only because the
// spec KINDS differ ('any target' then 'creature') — where the specs are
// controller-distinguished, read them by CONTROLLER instead (D255). Here the
// tap clause is optional, so `obj.targets[1]` may simply be absent. D266.

import { VIBRANT_OUTBURST } from '../../../data/fixtures/engineCards';
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
  VIBRANT_OUTBURST,
  'Vibrant Outburst deals 3 damage to any target. Tap up to one target creature.',
);

export const VIBRANT_OUTBURST_SCRIPT: CardScript = {
  oracleId: VIBRANT_OUTBURST.oracleId,
  name: VIBRANT_OUTBURST.name,
  spell: {
    text: TEXT,
    resolve: (ctx, self, obj): readonly EventBody[] => {
      const events: EventBody[] = [];

      const hit = obj.targets[0];
      if (
        hit &&
        hit.kind !== 'stack' &&
        (hit.kind !== 'card' || ctx.state.cards[hit.id]?.zone.kind === 'battlefield')
      ) {
        events.push({
          t: 'DamageDealt',
          damages: [
            {
              source: self,
              target:
                hit.kind === 'player'
                  ? { kind: 'player', id: hit.id }
                  : { kind: 'card', id: hit.id },
              amount: 3,
              deathtouch: false,
              lifelinkTo: null,
              isCommanderDamage: false,
              viaTrample: 0,
              toxic: 0,
              applyAs: 'normal',
            },
          ],
        });
      }

      // "up to one" — this may genuinely be absent, and that is a legal answer.
      const tap = obj.targets[1];
      if (tap && tap.kind === 'card') {
        const card = ctx.state.cards[tap.id];
        if (card?.zone.kind === 'battlefield' && !card.tapped) {
          events.push({ t: 'PermanentsTapped', cards: [tap.id] });
        }
      }
      return events;
    },
  },
};
