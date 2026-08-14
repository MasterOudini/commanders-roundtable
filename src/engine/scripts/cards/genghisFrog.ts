// `Genghis Frog` — "Whenever Genghis Frog or another Mutant you control
// enters, create a Mutagen token." Court Street Denizen's two-def entering
// watcher (a token enters via `TokenCreated`, never `CardsMoved`) made
// SELF-INCLUSIVE, with the subtype asked of the DERIVED entrant. The Mutagen
// is an Artifact, not a Mutant, so the trigger cannot feed itself. M6.4t,
// D176.

import { GENGHIS_FROG } from '../../../data/fixtures/engineCards';
import { TOKEN_TABLE, type TokenRef } from '../../../data/tokenTable';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript, ScriptCtx } from '../api';
import type { EventBody } from '../../types/events';
import type { InstanceId, PlayerId } from '../../types/ids';

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

const PRINTED = printed(
  GENGHIS_FROG,
  'Trample\nWhenever Genghis Frog or another Mutant you control enters, create a Mutagen token. (It\'s an artifact with "{1}, {T}, Sacrifice this token: Put a +1/+1 counter on target creature. Activate only as a sorcery.")',
);
const TEXT = PRINTED.split('\n')[1] as string;

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" — re-check before re-registering (D90).`);
  return ref;
}

const MUTAGEN = tokenRef('Mutagen|/||Artifact|');

/** "Genghis Frog or another Mutant you control" — asked of the DERIVED entrant. */
function qualifies(ctx: ScriptCtx, self: InstanceId, entrant: InstanceId): boolean {
  const inst = ctx.state.cards[entrant];
  if (!inst || inst.controller !== ctx.query.controllerOf(self)) return false;
  if (entrant === self) return true;
  return ctx.derive(entrant).typeLine.subtypes.includes('Mutant');
}

function makeMutagen(ctx: ScriptCtx, controller: PlayerId): readonly EventBody[] {
  return [
    {
      t: 'TokenCreated',
      card: ctx.ids.nextInstance(),
      oracleId: MUTAGEN.oracleId,
      printingId: MUTAGEN.printingId,
      controller,
      owner: controller,
      turnNumber: ctx.state.turn.turnNumber,
    },
  ];
}

export const GENGHIS_FROG_SCRIPT: CardScript = {
  oracleId: GENGHIS_FROG.oracleId,
  name: GENGHIS_FROG.name,
  triggers: [
    {
      abilityId: 'etb-card',
      text: TEXT,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) =>
            m.to.kind === 'battlefield' &&
            m.from.kind !== 'battlefield' &&
            qualifies(ctx, self, m.card),
        ),
      label: () => 'Genghis Frog — create a Mutagen',
      resolve: (ctx, _self, obj): readonly EventBody[] => makeMutagen(ctx, obj.controller),
    },
    {
      abilityId: 'etb-token',
      text: TEXT,
      event: 'TokenCreated',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'TokenCreated' && qualifies(ctx, self, ev.card),
      label: () => 'Genghis Frog — create a Mutagen',
      resolve: (ctx, _self, obj): readonly EventBody[] => makeMutagen(ctx, obj.controller),
    },
  ],
};
