import QRCodeUtil from "qrcode";
import React from "react";

const generateMatrix = (text) => {
  const arr = Array.prototype.slice.call(
    QRCodeUtil.create(text, { errorCorrectionLevel: "H" }).modules.data,
    0,
  );
  const sqrt = Math.sqrt(arr.length);
  return arr.reduce(
    (rows, key, index) =>
      (index % sqrt === 0
        ? rows.push([key])
        : rows[rows.length - 1].push(key)) && rows,
    [],
  );
};

const QRCode = ({ image, uri, color = "black" }) => {
  const size = 100; // sizeProp - padding * 2;
  const logoSize = 40;
  const logoElementSize = `${(logoSize / size) * 100 * 0.8}%`;

  const dots = React.useMemo(() => {
    const dots = [];
    const matrix = generateMatrix(uri);
    const cellSize = size / matrix.length;
    let qrList = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: 1 },
    ];

    qrList.forEach(({ x, y }) => {
      const x1 = (matrix.length - 7) * cellSize * x;
      const y1 = (matrix.length - 7) * cellSize * y;
      for (let i = 0; i < 3; i++) {
        dots.push(
          <rect
            key={`${i}-${x}-${y}`}
            fill={i % 2 !== 0 ? "white" : color}
            height={cellSize * (7 - i * 2)}
            rx={i === 0 ? cellSize * 2 : i === 1 ? cellSize : cellSize / 2}
            width={cellSize * (7 - i * 2)}
            x={x1 + cellSize * i}
            y={y1 + cellSize * i}
          />,
        );
      }
    });

    const clearArenaSize = Math.ceil(logoSize / cellSize);
    const matrixMiddleStart = matrix.length / 2 - clearArenaSize / 2;
    const matrixMiddleEnd = matrix.length / 2 + clearArenaSize / 2 - 1;

    matrix.forEach((row, i) => {
      row.forEach((_, j) => {
        if (matrix[i][j]) {
          if (
            !(
              (i < 7 && j < 7) ||
              (i > matrix.length - 8 && j < 7) ||
              (i < 7 && j > matrix.length - 8)
            )
          ) {
            if (
              !(
                i > matrixMiddleStart &&
                i < matrixMiddleEnd &&
                j > matrixMiddleStart &&
                j < matrixMiddleEnd
              )
            ) {
              dots.push(
                <circle
                  cx={i * cellSize + cellSize / 2}
                  cy={j * cellSize + cellSize / 2}
                  fill={color}
                  key={`circle-${i}-${j}`}
                  r={cellSize / 2} // calculate size of single dots
                />,
              );
            }
          }
        }
      });
    });

    return dots;
  }, [logoSize, size, color, uri]);

  return (
    <div style={{ width: "100%", height: "auto", position: "relative" }}>
      <div
        style={{
          width: logoElementSize,
          height: logoElementSize,
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translateX(-50%) translateY(-50%)",
        }}
      >
        {image}
      </div>
      <svg
        height={size}
        width={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{ width: "100%", height: "auto" }}
      >
        {/* <defs> */}
        {/*   <clipPath id="clip-wrapper"> */}
        {/*     <rect height={logoWrapperSize} width={logoWrapperSize} /> */}
        {/*   </clipPath> */}
        {/*   <clipPath id="clip-logo"> */}
        {/*     <rect height={logoSize} width={logoSize} /> */}
        {/*   </clipPath> */}
        {/* </defs> */}
        <rect fill="transparent" height={size} width={size} />
        {dots}
      </svg>
    </div>
  );
};

export default QRCode;
