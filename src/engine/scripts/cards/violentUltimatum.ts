// `Violent Ultimatum` — the counted THREE (min 3 / max 3, PROBED). The
// counted-list machinery is now proven at 2 (Dust to Dust D209), 3 (here) and
// 6 (Hex D217).
//
// ⚠️ One spec carrying three targets, so the resolve walks `obj.targets`
// rather than reading an index, and each is re-checked on resolution
// independently: one having left the battlefield does not spare the others
// (CR 608.2b's per-target rule). D266.

import { VIOLENT_ULTIMATUM } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(VIOLENT_ULTIMATUM, 'Destroy three target permanents.');

export const VIOLENT_ULTIMATUM_SCRIPT: CardScript = {
  oracleId: VIOLENT_ULTIMATUM.oracleId,
  name: VIOLENT_ULTIMATUM.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const moves: {
        card: InstanceId;
        from: { kind: 'battlefield'; player: string };
        to: { kind: 'graveyard'; player: string };
      }[] = [];
      for (const target of obj.targets) {
        if (target.kind !== 'card') continue;
        const card = ctx.state.cards[target.id];
        if (card?.zone.kind !== 'battlefield') continue;
        if (ctx.derive(target.id).keywords.has('indestructible')) continue;
        moves.push({
          card: target.id,
          from: { kind: 'battlefield', player: card.controller },
          to: { kind: 'graveyard', player: card.owner },
        });
      }
      if (moves.length === 0) return [];
      return [{ t: 'CardsMoved', moves }];
    },
  },
};
