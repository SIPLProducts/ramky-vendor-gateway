export function rotateClockwise(rotation: number) {
  return (rotation + 90) % 360;
}

export function fitRotatedImage(imageWidth: number, imageHeight: number, viewportWidth: number, viewportHeight: number, rotation: number) {
  if (imageWidth <= 0 || imageHeight <= 0 || viewportWidth <= 0 || viewportHeight <= 0) return null;
  const sideways = rotation % 180 !== 0;
  const boundsWidth = sideways ? imageHeight : imageWidth;
  const boundsHeight = sideways ? imageWidth : imageHeight;
  const scale = Math.min(1, viewportWidth / boundsWidth, viewportHeight / boundsHeight);
  return { width: imageWidth * scale, height: imageHeight * scale };
}