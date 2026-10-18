export function formatRefreshRate(rate: number): string {
  return String(Number(rate.toFixed(2)))
}

export function formatPixelSize(width: number, height: number): string {
  return `${width} × ${height}`
}
