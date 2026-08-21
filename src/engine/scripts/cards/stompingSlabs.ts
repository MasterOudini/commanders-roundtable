// `Stomping Slabs` — reveal seven, bill 7 if a namesake was among them,
// then order the lot to the BOTTOM. The self-name census reads the ORACLE
// name of each revealed card; the ordering ask is emitted LAST (D195) —
// the damage does not depend on the order, so the printed sequence and
// this one reach the same state. D253.

import { STOMPING_SLABS } from '../../../data/fixtures/engineCards';
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
  STOMPING_SLABS,
  'Reveal the top seven cards of your library, then put those cards on the bottom of your library in any order. ' +
    'If a card named Stomping Slabs was revealed this way, Stomping Slabs deals 7 damage to any target.',
);

export const STOMPING_SLABS_SCRIPT: CardScript = {
  oracleId: STOMPING_SLABS.oracleId,
  name: STOMPING_SLABS.name,
  spell: {
    text: TEXT,
    resolve: (ctx, self, obj): readonly EventBody[] => {
      const library = ctx.state.zones.library[obj.controller] ?? [];
      const n = Math.min(7, library.length);
      if (n === 0) return [];
      const top = library.slice(library.length - n);
      const events: EventBody[] = [{ t: 'CardsRevealed', cards: top, to: ctx.state.seating }];
      let sawNamesake = false;
      for (const id of top) {
        const inst = ctx.state.cards[id];
        if (!inst) continue;
        const oc = ctx.oracle.byPrinting(inst.printingId);
        if (oc?.name === STOMPING_SLABS.name) sawNamesake = true;
      }
      const target = obj.targets[0];
      if (
        sawNamesake &&
        target &&
        (target.kind === 'player' ||
          (target.kind === 'card' && ctx.state.cards[target.id]?.zone.kind === 'battlefield'))
      ) {
        events.push({
          t: 'DamageDealt',
          damages: [
            {
              source: self,
              target:
                target.kind === 'player'
                  ? { kind: 'player', id: target.id }
                  : { kind: 'card', id: target.id },
              amount: 7,
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
      if (n > 1) {
        events.push({
          t: 'AwaitingSet',
          awaiting: {
            kind: 'orderCards',
            player: obj.controller,
            zone: 'library',
            destination: 'bottom',
            count: n,
            label: 'Stomping Slabs — put the revealed cards on the bottom',
          },
        });
      } else {
        events.push({ t: 'CardsRevealed', cards: top, to: [] });
      }
      return events;
    },
  },
};
