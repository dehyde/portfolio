const sample = (seed, channel) => {
  let value = (Math.trunc(Number.isFinite(seed) ? seed : 0) + Math.imul(channel, 0x9e3779b9)) >>> 0;
  value ^= value >>> 16;
  value = Math.imul(value, 0x7feb352d);
  value ^= value >>> 15;
  value = Math.imul(value, 0x846ca68b);
  value ^= value >>> 16;
  return (value >>> 0) / 0x100000000;
};

const round = (value) => Math.round(value * 10) / 10;

export function getOutlineTilt(seed = 0) {
  const direction = Math.trunc(Number.isFinite(seed) ? seed : 0) % 2 === 0 ? 1 : -1;
  return round(direction * (.45 + sample(seed, 11) * 1.35));
}

export function getRoundedOutlinePath(width, height, seed = 0) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 32 || height < 24) return '';

  const left = round(5 + (sample(seed, 1) - .5) * 3);
  const top = round(5 + (sample(seed, 2) - .5) * 3);
  const right = round(width - 5 + (sample(seed, 3) - .5) * 3);
  const bottom = round(height - 5 + (sample(seed, 4) - .5) * 3);
  const baseRadius = Math.min(34, (bottom - top) * .46, (right - left) * .16);
  const radius = (channel) => round(Math.min((bottom - top) * .48, baseRadius * (.65 + sample(seed, channel) * .67)));
  const topLeft = radius(5);
  const topRight = radius(6);
  const bottomRight = radius(7);
  const bottomLeft = radius(8);
  const wobble = (channel) => round((sample(seed, channel) - .5) * 12);

  return [
    `M ${round(left + topLeft)} ${top}`,
    `C ${round(width * .38)} ${round(top + wobble(12))}, ${round(right - topRight - 20)} ${round(top + wobble(13))}, ${round(right - topRight)} ${top}`,
    `Q ${round(right + wobble(14) * .4)} ${round(top + wobble(15))}, ${right} ${round(top + topRight)}`,
    `C ${round(right + wobble(16))} ${round(height * .44)}, ${round(right + wobble(17))} ${round(bottom - bottomRight - 14)}, ${right} ${round(bottom - bottomRight)}`,
    `Q ${round(right + wobble(18) * .4)} ${round(bottom + wobble(19) * .3)}, ${round(right - bottomRight)} ${bottom}`,
    `C ${round(width * .61)} ${round(bottom + wobble(20))}, ${round(left + bottomLeft + 20)} ${round(bottom + wobble(21))}, ${round(left + bottomLeft)} ${bottom}`,
    `Q ${round(left + wobble(22) * .4)} ${round(bottom + wobble(23) * .3)}, ${left} ${round(bottom - bottomLeft)}`,
    `C ${round(left + wobble(24))} ${round(height * .57)}, ${left} ${round(top + topLeft + 14)}, ${left} ${round(top + topLeft)}`,
    `C ${left} ${round(top + topLeft * .45)}, ${round(left + topLeft * .45)} ${top}, ${round(left + topLeft)} ${top}`,
    'Z',
  ].join(' ');
}
