// Adapted from https://github.com/feross/buffer

function checkInt(buf: Uint8Array, value: number, offset: number, ext: number, max: number, min: number): void {
  if (value > max || value < min) throw new RangeError('"value" argument is out of bounds');
  if (offset + ext > buf.length) throw new RangeError("Index out of range");
}

export function writeUIntLE(
  buf: Uint8Array,
  value: number,
  offset: number,
  byteLength: number,
  noAssert?: boolean
): Uint8Array {
  value = +value;
  offset = offset >>> 0;
  byteLength = byteLength >>> 0;
  if (!noAssert) {
    const maxBytes = Math.pow(2, 8 * byteLength) - 1;
    checkInt(buf, value, offset, byteLength, maxBytes, 0);
  }

  let mul = 1;
  let i = 0;
  buf[offset] = value & 0xff;
  while (++i < byteLength && (mul *= 0x100)) {
    buf[offset + i] = (value / mul) & 0xff;
  }

  return buf;
}

function checkOffset(offset: number, ext: number, length: number): void {
  if (offset % 1 !== 0 || offset < 0) throw new RangeError("offset is not uint");
  if (offset + ext > length) throw new RangeError("Trying to access beyond buffer length");
}

export function readUIntLE(buf: Uint8Array, offset: number, byteLength: number, noAssert?: boolean): number {
  offset = offset >>> 0;
  byteLength = byteLength >>> 0;
  if (!noAssert) checkOffset(offset, byteLength, buf.length);

  let val = buf[offset];
  let mul = 1;
  let i = 0;
  while (++i < byteLength && (mul *= 0x100)) {
    val += buf[offset + i] * mul;
  }

  return val;
}
