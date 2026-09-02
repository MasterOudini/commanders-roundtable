// `Zenith Flare` — X damage to any target AND X life, where X counts the cards
// in MY graveyard with a CYCLING ability.
//
// ⚠️ "With a cycling ability" is read off the printing's RAW keyword list
// (D261's Tombfire idiom for Flashback): a text regex would miss printings
// whose reminder text is absent and match cards that merely mention cycling.
// X=0 deals nothing and gains nothing, rather than emitting zero-amount
// events. D271.

import { ZENITH_FLARE } from '../../../data/fixtures/engineCards';
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
  ZENITH_FLARE,
  'Zenith Flare deals X damage to any target and you gain X life, where X is the number of cards with a cycling ability in your graveyard.',
);

export const ZENITH_FLARE_SCRIPT: CardScript = {
  oracleId: ZENITH_FLARE.oracleId,
  name: ZENITH_FLARE.name,
  spell: {
    text: TEXT,
    resolve: (ctx, self, obj): readonly EventBody[] => {
      let x = 0;
      for (const id of ctx.state.zones.graveyard[obj.controller] ?? []) {
        const card = ctx.state.cards[id];
        if (!card) continue;
        const oc = ctx.oracle.byPrinting(card.printingId);
        if (oc?.data.keywords.includes('Cycling')) x += 1;
      }
      if (x === 0) return [];

      const target = obj.targets[0];
      if (!target || target.kind === 'stack') return [];
      if (target.kind === 'card' && ctx.state.cards[target.id]?.zone.kind !== 'battlefield') {
        return [];
      }

      const events: EventBody[] = [
        {
          t: 'DamageDealt',
          damages: [
            {
              source: self,
              target:
                target.kind === 'player'
                  ? { kind: 'player', id: target.id }
                  : { kind: 'card', id: target.id },
              amount: x,
              deathtouch: false,
              lifelinkTo: null,
              isCommanderDamage: false,
              viaTrample: 0,
              toxic: 0,
              applyAs: 'normal',
            },
          ],
        },
      ];
      const me = ctx.state.players[obj.controller];
      if (me && !me.hasLost) {
        events.push({ t: 'LifeChanged', player: obj.controller, delta: x, to: me.life + x });
      }
      return events;
    },
  },
};
