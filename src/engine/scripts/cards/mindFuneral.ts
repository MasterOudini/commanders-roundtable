// `Mind Funeral` — "Target opponent reveals cards from the top of their
// library until four land cards are revealed. That player puts all cards
// revealed this way into their graveyard." Destroy the Evidence's
// deterministic reveal run, stopping at the FOURTH land (or the library's
// end), typed off the ORACLE face. D225.

import { MIND_FUNERAL } from '../../../data/fixtures/engineCards';
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
  MIND_FUNERAL,
  'Target opponent reveals cards from the top of their library until four land cards are revealed. That player puts all cards revealed this way into their graveyard.',
);

export const MIND_FUNERAL_SCRIPT: CardScript = {
  oracleId: MIND_FUNERAL.oracleId,
  name: MIND_FUNERAL.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'player') return [];
      const p = ctx.state.players[target.id];
      if (!p || p.hasLost) return [];
      const library = ctx.state.zones.library[target.id] ?? [];
      const run: typeof library[number][] = [];
      let lands = 0;
      for (let i = library.length - 1; i >= 0; i--) {
        const id = library[i]!;
        run.push(id);
        const card = ctx.state.cards[id];
        const oc = card && ctx.oracle.byPrinting(card.printingId);
        if (oc && faceOf(oc, card.faceIndex ?? 0).typeLine.types.includes('Land')) {
          lands++;
          if (lands >= 4) break;
        }
      }
      if (run.length === 0) return [];
      const living = ctx.state.seating.filter((s) => !ctx.state.players[s]?.hasLost);
      return [
        { t: 'CardsRevealed', cards: run, to: living },
        {
          t: 'CardsMoved',
          moves: run.map((id) => ({
            card: id,
            from: { kind: 'library' as const, player: target.id },
            to: { kind: 'graveyard' as const, player: ctx.state.cards[id]?.owner ?? target.id },
          })),
        },
      ];
    },
  },
};
