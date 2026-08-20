// `Destroy the Evidence` — "Destroy target land. Its controller reveals
// cards from the top of their library until they reveal a land card, then
// puts those cards into their graveyard." The reveal loop is DETERMINISTIC:
// walk the controller's library from the top until the first land (typed
// off the ORACLE face — a library card has no derivation), reveal the run
// to EVERYONE, and mill it whole. No land in the library mills all of it.
// D208.

import { DESTROY_THE_EVIDENCE } from '../../../data/fixtures/engineCards';
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
  DESTROY_THE_EVIDENCE,
  'Destroy target land. Its controller reveals cards from the top of their library until they reveal a land card, then puts those cards into their graveyard.',
);

export const DESTROY_THE_EVIDENCE_SCRIPT: CardScript = {
  oracleId: DESTROY_THE_EVIDENCE.oracleId,
  name: DESTROY_THE_EVIDENCE.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      const land = ctx.state.cards[target.id];
      if (!land || land.zone.kind !== 'battlefield') return [];
      const controller = land.controller;
      const events: EventBody[] = [];
      if (!ctx.derive(target.id).keywords.has('indestructible')) {
        events.push({
          t: 'CardsMoved',
          moves: [
            {
              card: target.id,
              from: { kind: 'battlefield', player: land.controller },
              to: { kind: 'graveyard', player: land.owner },
            },
          ],
        });
      }
      const library = ctx.state.zones.library[controller] ?? [];
      const run: typeof library[number][] = [];
      for (let i = library.length - 1; i >= 0; i--) {
        const id = library[i]!;
        run.push(id);
        const card = ctx.state.cards[id];
        const oc = card && ctx.oracle.byPrinting(card.printingId);
        if (oc && faceOf(oc, card.faceIndex ?? 0).typeLine.types.includes('Land')) break;
      }
      if (run.length > 0) {
        const living = ctx.state.seating.filter((p) => !ctx.state.players[p]?.hasLost);
        events.push({ t: 'CardsRevealed', cards: run, to: living });
        events.push({
          t: 'CardsMoved',
          moves: run.map((id) => ({
            card: id,
            from: { kind: 'library' as const, player: controller },
            to: { kind: 'graveyard' as const, player: ctx.state.cards[id]?.owner ?? controller },
          })),
        });
      }
      return events;
    },
  },
};
