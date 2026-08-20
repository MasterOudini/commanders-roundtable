// `Contraband Kingpin` — "Whenever an artifact you control enters, scry 1."
// TWO defs, because a token enters via TokenCreated and a card via
// CardsMoved (Soul Warden's rule, D158) — one printed line, both arms
// raising the D195 ask. The Lifelink line is tier-2. D204.

import { CONTRABAND_KINGPIN } from '../../../data/fixtures/engineCards';
import { faceOf } from '../../oracle';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript } from '../api';
import type { EventBody } from '../../types/events';
import type { InstanceId } from '../../types/ids';
import type { ScriptCtx } from '../api';

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
  CONTRABAND_KINGPIN,
  'Lifelink\nWhenever an artifact you control enters, scry 1.',
);
const TEXT = PRINTED.split('\n')[1] as string;

function scryOne(ctx: ScriptCtx, controller: string, label: string): readonly EventBody[] {
  const library = ctx.state.zones.library[controller] ?? [];
  const n = Math.min(1, library.length);
  if (n === 0) return [];
  const top = library.slice(library.length - n);
  return [
    { t: 'CardsRevealed', cards: top, to: [controller] },
    {
      t: 'AwaitingSet',
      awaiting: {
        kind: 'scryChoice',
        player: controller,
        count: n,
        toGraveyard: false,
        thenDraw: 0,
        label,
      },
    },
  ] as readonly EventBody[];
}

function isMyArtifactEntering(ctx: ScriptCtx, self: InstanceId, id: InstanceId): boolean {
  const card = ctx.state.cards[id];
  if (!card) return false;
  if (card.controller !== ctx.query.controllerOf(self)) return false;
  const oc = ctx.oracle.byPrinting(card.printingId);
  if (!oc) return false;
  return faceOf(oc, card.faceIndex).typeLine.types.includes('Artifact');
}

export const CONTRABAND_KINGPIN_SCRIPT: CardScript = {
  oracleId: CONTRABAND_KINGPIN.oracleId,
  name: CONTRABAND_KINGPIN.name,
  triggers: [
    {
      abilityId: 'artifact-enters-card',
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
            isMyArtifactEntering(ctx, self, m.card),
        ),
      label: () => 'Contraband Kingpin — scry 1',
      resolve: (ctx, _self, obj): readonly EventBody[] => scryOne(ctx, obj.controller, obj.label),
    },
    {
      abilityId: 'artifact-enters-token',
      text: TEXT,
      event: 'TokenCreated',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'TokenCreated' && isMyArtifactEntering(ctx, self, ev.card),
      label: () => 'Contraband Kingpin — scry 1',
      resolve: (ctx, _self, obj): readonly EventBody[] => scryOne(ctx, obj.controller, obj.label),
    },
  ],
};
