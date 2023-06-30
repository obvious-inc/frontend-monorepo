export const fitInsideBounds = (dimensions, bounds) => {
  const { width, height } = dimensions;
  const { width: maybeMaxWidth, height: maybeMaxHeight } = bounds;

  const aspectRatio = width / height;

  if (maybeMaxWidth == null) {
    if (maybeMaxHeight == null) throw new Error();
    const fittedWidth =
      maybeMaxHeight > height ? width : maybeMaxHeight * aspectRatio;
    return { width: fittedWidth, height: fittedWidth / aspectRatio };
  }

  const widthAfterHeightAdjustment =
    Math.min(height, maybeMaxHeight ?? Infinity) * aspectRatio;
  const fittedWidth = Math.min(widthAfterHeightAdjustment, maybeMaxWidth);
  return { width: fittedWidth, height: fittedWidth / aspectRatio };
};
