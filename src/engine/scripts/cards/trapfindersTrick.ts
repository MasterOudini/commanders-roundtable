// `Trapfinder's Trick` — the public hand reveal (Amnesia D197, Gitaxian Probe
// D196) plus a CHOICELESS discard of every Trap card.
//
// ⚠️ "all Trap cards" means no prompt however many there are (CR 701.8a,
// D230's One with Nothing) — a chooser here would be asking the player to
// make a decision the card does not give them.
// ⚠️ The subtype is read off the ORACLE face: a card in hand has no
// battlefield derivation, so `ctx.derive` is not the tool. D262.

import { TRAPFINDER_S_TRICK } from '../../../data/fixtures/engineCards';
import { faceOf } from '../../oracle';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript } from '../api';
import type { EventBody } from '../../types/events';
import type { InstanceId } from '../../types/ids';

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
  TRAPFINDER_S_TRICK,
  'Target player reveals their hand and discards all Trap cards.',
);

export const TRAPFINDERS_TRICK_SCRIPT: CardScript = {
  oracleId: TRAPFINDER_S_TRICK.oracleId,
  name: TRAPFINDER_S_TRICK.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'player') return [];
      const victim = target.id;
      const hand = ctx.state.zones.hand[victim] ?? [];
      if (hand.length === 0) return [];

      const living = ctx.state.seating.filter((p) => !ctx.state.players[p]?.hasLost);
      const events: EventBody[] = [{ t: 'CardsRevealed', cards: hand, to: living }];

      const traps: InstanceId[] = [];
      for (const id of hand) {
        const card = ctx.state.cards[id];
        const oc = card && ctx.oracle.byPrinting(card.printingId);
        if (!oc) continue;
        if (faceOf(oc, card.faceIndex ?? 0).typeLine.subtypes.includes('Trap')) traps.push(id);
      }
      if (traps.length > 0) {
        events.push({
          t: 'CardsMoved',
          moves: traps.map((id) => ({
            card: id,
            from: { kind: 'hand' as const, player: victim },
            to: { kind: 'graveyard' as const, player: ctx.state.cards[id]?.owner ?? victim },
          })),
        });
      }
      return events;
    },
  },
};
