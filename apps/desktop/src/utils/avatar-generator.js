// Simpfied version of https://github.com/ethereum/blockies

const createRandomGenerator = (seed_) => {
  // JS implementation of the Xorshift PRNG
  const seed = new Array(4); // Xorshift: [x, y, z, w] 32 bit values

  for (let i = 0; i < seed.length; i++) seed[i] = 0;

  for (let i = 0; i < seed_.length; i++)
    seed[i % 4] = (seed[i % 4] << 5) - seed[i % 4] + seed_.charCodeAt(i);

  return () => {
    // Based on Java's String.hashCode(), expanded to 4 32bit values
    const t = seed[0] ^ (seed[0] << 11);

    seed[0] = seed[1];
    seed[1] = seed[2];
    seed[2] = seed[3];
    seed[3] = seed[3] ^ (seed[3] >> 19) ^ t ^ (t >> 8);

    return (seed[3] >>> 0) / ((1 << 31) >>> 0);
  };
};

const createColor = ({ random: r }) => {
  // Hue is the whole color spectrum
  const hue = Math.floor(r() * 360);

  // Saturation goes from 40 to 100, it avoids greyish colors
  const saturation = r() * 60 + 40 + "%";

  // Lightness can be anything from 0 to 100, but probabilities are a bell curve around 50%
  const lightness = (r() + r() + r() + r()) * 25 + "%";

  return `hsl(${hue}, ${saturation}, ${lightness})`;
};

const generate = ({ seed, size, scale = 1 }) => {
  const random = createRandomGenerator(seed);

  const color = createColor({ random });
  const backgroundColor = createColor({ random });
  const spotColor = createColor({ random });

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  canvas.width = canvas.height = size * scale;

  let imageData = [];

  for (let y = 0; y < size; y++) {
    const rowFirstHalf = [];

    for (let x = 0; x < size / 2; x++)
      // Foreground/background ratio 43% (1/2.3), spot color 13%
      rowFirstHalf[x] = Math.floor(random() * 2.3);

    const rowSecondHalf = [...rowFirstHalf].reverse();

    imageData = [...imageData, ...rowFirstHalf, ...rowSecondHalf];
  }

  const blockCount = Math.sqrt(imageData.length);

  context.fillStyle = backgroundColor;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = color;

  for (let i = 0; i < imageData.length; i++) {
    // If data is 0, leave the background
    if (imageData[i] === 0) continue;

    const row = Math.floor(i / blockCount);
    const col = i % blockCount;

    // if data is 2, choose spot color, if 1 choose foreground
    context.fillStyle = imageData[i] == 1 ? color : spotColor;
    context.fillRect(col * scale, row * scale, scale, scale);
  }

  return canvas.toDataURL();
};

export default generate;
