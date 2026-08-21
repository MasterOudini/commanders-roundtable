// `Spite of Mogis` — damage equal to my graveyard's instant-and-sorcery
// count (typed off the ORACLE face), then the scry ask LAST. D251.

import { SPITE_OF_MOGIS } from '../../../data/fixtures/engineCards';
import { faceOf } from '../../oracle';
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
  SPITE_OF_MOGIS,
  'Spite of Mogis deals damage to target creature equal to the number of instant and sorcery cards in your graveyard. ' +
    'Scry 1. (Look at the top card of your library. You may put that card on the bottom.)',
);

export const SPITE_OF_MOGIS_SCRIPT: CardScript = {
  oracleId: SPITE_OF_MOGIS.oracleId,
  name: SPITE_OF_MOGIS.name,
  spell: {
    text: TEXT,
    resolve: (ctx, self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      if (ctx.state.cards[target.id]?.zone.kind !== 'battlefield') return [];
      let amount = 0;
      for (const id of ctx.state.zones.graveyard[obj.controller] ?? []) {
        const inst = ctx.state.cards[id];
        if (!inst) continue;
        const oc = ctx.oracle.byPrinting(inst.printingId);
        if (!oc) continue;
        const types = faceOf(oc, inst.faceIndex).typeLine.types;
        if (types.includes('Instant') || types.includes('Sorcery')) amount += 1;
      }
      const events: EventBody[] = [];
      if (amount > 0) {
        events.push({
          t: 'DamageDealt',
          damages: [
            {
              source: self,
              target: { kind: 'card', id: target.id },
              amount,
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
      const library = ctx.state.zones.library[obj.controller] ?? [];
      const n = Math.min(1, library.length);
      if (n > 0) {
        const top = library.slice(library.length - n);
        events.push({ t: 'CardsRevealed', cards: top, to: [obj.controller] });
        events.push({
          t: 'AwaitingSet',
          awaiting: {
            kind: 'scryChoice',
            player: obj.controller,
            count: n,
            toGraveyard: false,
            thenDraw: 0,
            label: 'Spite of Mogis — scry 1',
          },
        });
      }
      return events;
    },
  },
};
