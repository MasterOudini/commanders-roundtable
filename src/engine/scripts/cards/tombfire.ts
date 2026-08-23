// `Tombfire` — the first def to read a MECHANIC KEYWORD the engine does not
// enforce, and the idiom is worth naming.
//
// ⚠️ `OracleFace.keywords` is the narrowed TIER-2 union (AGENTS.md's scope
// boundary) and does NOT hold 'Flashback'. But `OracleCard.data` is the
// original `CardData`, carried through the ingest untouched, so the RAW
// Scryfall keyword list is reachable at `oracle.byPrinting(id).data.keywords`.
// That is the clean read. A regex over the printed text would have been the
// obvious alternative and is WRONG: Tombfire's own text says "cards with
// flashback", so a Tombfire sitting in the graveyard would exile itself.
//
// ⚠️ Reading a keyword is not claiming to ENFORCE it. The engine has no
// graveyard-cast path, so flashback does nothing here (D178's class) and the
// cards that print it carry their own Tier-3 note. Tombfire is still fully
// executed: it exiles exactly the cards the card names. D261.

import { TOMBFIRE } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(TOMBFIRE, 'Target player exiles all cards with flashback from their graveyard.');

export const TOMBFIRE_SCRIPT: CardScript = {
  oracleId: TOMBFIRE.oracleId,
  name: TOMBFIRE.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'player') return [];
      const victim = target.id;
      const graveyard = ctx.state.zones.graveyard[victim] ?? [];
      const moves: {
        card: InstanceId;
        from: { kind: 'graveyard'; player: string };
        to: { kind: 'exile'; player: string };
      }[] = [];
      for (const id of graveyard) {
        const inst = ctx.state.cards[id];
        if (!inst) continue;
        const oc = ctx.oracle.byPrinting(inst.printingId);
        if (!oc) continue;
        if (!oc.data.keywords.includes('Flashback')) continue;
        moves.push({
          card: id,
          from: { kind: 'graveyard', player: victim },
          to: { kind: 'exile', player: inst.owner },
        });
      }
      if (moves.length === 0) return [];
      return [{ t: 'CardsMoved', moves }];
    },
  },
};
