// `Perilous Voyage` - a scripted spell: the target clause is the parser's and the validator's
// (D294's adjectives), the rider is this script's. Generated from one table row (D295).

import { PERILOUS_VOYAGE } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript } from '../api';
import type { EventBody } from '../../types/events';
import type { InstanceId } from '../../types/ids';
import type { CardInstance } from '../../types/state';

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

const TEXT = printed(PERILOUS_VOYAGE, "Return target nonland permanent you don't control to its owner's hand. If its mana value was 2 or less, scry 2.");

export const PERILOUS_VOYAGE_SCRIPT: CardScript = {
  oracleId: PERILOUS_VOYAGE.oracleId,
  name: PERILOUS_VOYAGE.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const events: EventBody[] = [];
      const perm = (i: number): { id: InstanceId; card: CardInstance } | null => {
        const t = obj.targets[i];
        if (!t || t.kind !== 'card') return null;
        const card = ctx.state.cards[t.id];
        return card && card.zone.kind === 'battlefield' ? { id: t.id, card } : null;
      };
      // A script-raised scry/surveil (appendageAmalgam's shape): reveal the top n, then ask.
      const scryEvents = (n: number, toGraveyard: boolean): EventBody[] => {
        const library = ctx.state.zones.library[obj.controller] ?? [];
        const count = Math.min(n, library.length);
        if (count === 0) return [];
        const top = library.slice(library.length - count);
        return [
          { t: 'CardsRevealed', cards: top, to: [obj.controller] },
          { t: 'AwaitingSet', awaiting: { kind: 'scryChoice', player: obj.controller, count, toGraveyard, thenDraw: 0, label: "Perilous Voyage" } },
        ];
      };
        { const p = perm(0); if (p && (ctx.derive(p.id).manaValue ?? 0) <= 2) events.push(...scryEvents(2, false)); }
        { const p = perm(0); if (p) events.push({ t: 'CardsMoved', moves: [{ card: p.id, from: { kind: 'battlefield', player: p.card.controller }, to: { kind: 'hand', player: p.card.owner } }] }); }
      return events;
    },
  },
};
