export interface WatermarkDimensions {
  width: number;
  height: number;
}

const clampPercent = (value: number) => Math.max(0, Math.min(100, value));

/**
 * Fits the image inside the configured percentage of the entire report page.
 * The percentage therefore has the same meaning in the configuration preview
 * and in the generated A4 PDF: 100% reaches the available page edge on the
 * image's longest orientation, without distorting its aspect ratio.
 */
export const resolveWatermarkDimensions = (
  pageWidth: number,
  pageHeight: number,
  aspectRatio: number,
  sizePercent: number,
): WatermarkDimensions => {
  const scale = clampPercent(sizePercent) / 100;
  const maxWidth = pageWidth * scale;
  const maxHeight = pageHeight * scale;
  const aspect = aspectRatio > 0 ? aspectRatio : 1;

  if ((maxWidth / maxHeight) >= aspect) {
    return { width: maxHeight * aspect, height: maxHeight };
  }

  return { width: maxWidth, height: maxWidth / aspect };
};
