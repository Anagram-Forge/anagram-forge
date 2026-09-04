/** Steward-only. Do not import from client routes. */
export type DoorNote = {
  id: string;
  title: string;
  rack: string;
  phrase: string;
};

export const DOOR_LEDGER: DoorNote[] = [
  { id: "way", title: "The Way", rack: "narrow gate", phrase: "arrange two" },
];
