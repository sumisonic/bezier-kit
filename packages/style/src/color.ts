import { clamp, lerp } from '@sumisonic/bezier-kit-core'

const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/i

/**
 * `#rrggbb` 形式の色文字列を `[r, g, b]` の数値タプル(0〜255)に分解する。
 *
 * `#rgb` / `#rrggbbaa` などの他の形式は v1 では未対応で、不正な文字列は
 * すぐに `Error` を投げる(`Q4-A: fail-fast 方針`)。
 *
 * @param hex - `#rrggbb` 形式の色文字列
 * @throws 形式が `#rrggbb` でない場合
 */
export const parseHexColor = (hex: string): readonly [number, number, number] => {
  if (!HEX_COLOR_PATTERN.test(hex)) {
    throw new Error(`parseHexColor: expected '#rrggbb', got ${JSON.stringify(hex)}`)
  }
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff]
}

/**
 * RGB 各チャンネル(0〜255、範囲外は clamp)を `#rrggbb` 形式の色文字列に変換する。
 *
 * Back / Elastic 系 easing で補間中に各チャンネルが 0〜255 を超えても
 * 安全に文字列化できるよう clamp する。
 *
 * @param r - 赤 (0〜255、範囲外は clamp)
 * @param g - 緑 (0〜255、範囲外は clamp)
 * @param b - 青 (0〜255、範囲外は clamp)
 */
export const toHexColor = (r: number, g: number, b: number): string =>
  '#' +
  [r, g, b]
    .map((c) =>
      Math.round(clamp(c, 0, 255))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')

/**
 * 2 つの `#rrggbb` 色を RGB 線形補間する。
 *
 * `t` は範囲外も可。`toHexColor` 側で clamp されるため安全。
 * HSL / OKLCh 補間は v1 未対応(将来の拡張)。
 *
 * @param a - 補間元の色
 * @param b - 補間先の色
 * @param t - 補間係数
 */
export const lerpColor = (a: string, b: string, t: number): string => {
  const [ar, ag, ab] = parseHexColor(a)
  const [br, bg, bb] = parseHexColor(b)
  return toHexColor(lerp(ar, br, t), lerp(ag, bg, t), lerp(ab, bb, t))
}

/**
 * 2 つの色の補間関数を事前構築する。
 *
 * 構築時に `parseHexColor` を 1 回だけ実行し、返り値の関数では数値 `lerp` と
 * `toHexColor` のみを行うため、毎フレーム呼び出しでも高速。
 *
 * @param a - 補間元の色(`#rrggbb`)
 * @param b - 補間先の色(`#rrggbb`)
 * @throws どちらかが `#rrggbb` 形式でない場合
 */
export const createColorLerp = (a: string, b: string): ((t: number) => string) => {
  const [ar, ag, ab] = parseHexColor(a)
  const [br, bg, bb] = parseHexColor(b)
  return (t: number): string => toHexColor(lerp(ar, br, t), lerp(ag, bg, t), lerp(ab, bb, t))
}
