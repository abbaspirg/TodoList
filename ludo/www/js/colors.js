// Seat colours. Eight of them, chosen to stay distinguishable from each
// other on a small screen and against both the light and dark board — and
// picked so that red/green, the pair most often confused by colour-blind
// players, differ in lightness as well as hue. Seats are also always
// labelled with a number on the board, so colour is never the only cue.
export const SEAT_COLORS = [
  { name: "Red", hex: "#e0393e", ink: "#ffffff" },
  { name: "Blue", hex: "#2f6fed", ink: "#ffffff" },
  { name: "Green", hex: "#12996b", ink: "#ffffff" },
  { name: "Yellow", hex: "#e8b422", ink: "#3a2c00" },
  { name: "Purple", hex: "#8e44ad", ink: "#ffffff" },
  { name: "Orange", hex: "#e6772e", ink: "#ffffff" },
  { name: "Teal", hex: "#0f9bb0", ink: "#ffffff" },
  { name: "Pink", hex: "#d84f92", ink: "#ffffff" },
];

export function seatColor(seat) {
  return SEAT_COLORS[seat % SEAT_COLORS.length];
}

/** The four corner colours of a real Ludo board, in corner order:
 * top-left, top-right, bottom-right, bottom-left. */
export const CLASSIC_COLORS = [
  { name: "Red", hex: "#e0393e", ink: "#ffffff" },
  { name: "Green", hex: "#12996b", ink: "#ffffff" },
  { name: "Yellow", hex: "#e8b422", ink: "#3a2c00" },
  { name: "Blue", hex: "#2f6fed", ink: "#ffffff" },
];

/** A seat's colour. On the classic cross board it comes from the corner the
 * seat sits in, so the colours are the ones printed on a real board; on the
 * generated ring it is just the seat's own colour from the palette. */
export function colorForSeat(config, seat) {
  if (config?.classic) return CLASSIC_COLORS[config.starts[seat] / 13];
  return seatColor(seat);
}
