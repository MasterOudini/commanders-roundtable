// `Telemin Performance` — Mind Funeral's reveal-until (D225) composed with
// Reanimate's THEFT (D238): the noncreatures go to their owner's graveyard
// and the creature card arrives on MY battlefield, so the `to.player` of the
// battlefield move is the CASTER rather than the owner.
//
// ⚠️ A library card has no battlefield derivation, so its type is read off
// the ORACLE face (Desecrated Tomb's rule, D171).

import { TELEMIN_PERFORMANCE } from '../../../data/fixtures/engineCards';
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
  TELEMIN_PERFORMANCE,
  'Target opponent reveals cards from the top of their library until they reveal a creature card. That player puts all noncreature cards revealed this way into their graveyard, then you put the creature card onto the battlefield under your control.',
);

export const TELEMIN_PERFORMANCE_SCRIPT: CardScript = {
  oracleId: TELEMIN_PERFORMANCE.oracleId,
  name: TELEMIN_PERFORMANCE.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'player') return [];
      const victim = ctx.state.players[target.id];
      if (!victim || victim.hasLost) return [];
      const library = ctx.state.zones.library[target.id] ?? [];
      const run: InstanceId[] = [];
      let creature: InstanceId | null = null;
      for (let i = library.length - 1; i >= 0; i--) {
        const id = library[i] as InstanceId;
        run.push(id);
        const card = ctx.state.cards[id];
        const oc = card && ctx.oracle.byPrinting(card.printingId);
        if (oc && faceOf(oc, card.faceIndex ?? 0).typeLine.types.includes('Creature')) {
          creature = id;
          break;
        }
      }
      if (run.length === 0) return [];
      const living = ctx.state.seating.filter((s) => !ctx.state.players[s]?.hasLost);
      return [
        { t: 'CardsRevealed', cards: run, to: living },
        {
          t: 'CardsMoved',
          moves: run.map((id) =>
            id === creature
              ? {
                  card: id,
                  from: { kind: 'library' as const, player: target.id },
                  to: { kind: 'battlefield' as const, player: obj.controller },
                }
              : {
                  card: id,
                  from: { kind: 'library' as const, player: target.id },
                  to: {
                    kind: 'graveyard' as const,
                    player: ctx.state.cards[id]?.owner ?? target.id,
                  },
                },
          ),
        },
      ];
    },
  },
};
