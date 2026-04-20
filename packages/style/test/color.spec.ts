import { describe, expect, it } from 'vitest'
import { createColorLerp, lerpColor, parseHexColor, toHexColor } from '../src/color'

describe('parseHexColor', () => {
  it('#000000 を [0, 0, 0] に分解する', () => {
    expect(parseHexColor('#000000')).toEqual([0, 0, 0])
  })

  it('#ffffff を [255, 255, 255] に分解する', () => {
    expect(parseHexColor('#ffffff')).toEqual([255, 255, 255])
  })

  it('#ea5532 を正しく分解する', () => {
    expect(parseHexColor('#ea5532')).toEqual([0xea, 0x55, 0x32])
  })

  it('大文字の 16 進も受け付ける', () => {
    expect(parseHexColor('#EA5532')).toEqual([0xea, 0x55, 0x32])
  })

  it('#rgb(3 桁)は未対応で throw', () => {
    expect(() => parseHexColor('#abc')).toThrow()
  })

  it('#rrggbbaa(8 桁)は未対応で throw', () => {
    expect(() => parseHexColor('#aabbccdd')).toThrow()
  })

  it('# のない文字列は throw', () => {
    expect(() => parseHexColor('ffffff')).toThrow()
  })

  it('非 16 進文字を含むと throw', () => {
    expect(() => parseHexColor('#ggghhh')).toThrow()
  })
})

describe('toHexColor', () => {
  it('0, 0, 0 を #000000 に変換する', () => {
    expect(toHexColor(0, 0, 0)).toBe('#000000')
  })

  it('255, 255, 255 を #ffffff に変換する', () => {
    expect(toHexColor(255, 255, 255)).toBe('#ffffff')
  })

  it('範囲外の値を clamp する', () => {
    expect(toHexColor(-10, 300, 128)).toBe('#00ff80')
  })
})

describe('lerpColor', () => {
  it('t=0 で元の色を返す', () => {
    expect(lerpColor('#000000', '#ffffff', 0)).toBe('#000000')
  })

  it('t=1 で先の色を返す', () => {
    expect(lerpColor('#000000', '#ffffff', 1)).toBe('#ffffff')
  })

  it('t=0.5 で中間色を返す', () => {
    expect(lerpColor('#000000', '#ffffff', 0.5)).toBe('#808080')
  })

  it('t > 1 でも壊れない(channel clamp)', () => {
    expect(lerpColor('#000000', '#ffffff', 1.5)).toBe('#ffffff')
  })

  it('t < 0 でも壊れない(channel clamp)', () => {
    expect(lerpColor('#000000', '#ffffff', -0.5)).toBe('#000000')
  })
})

describe('createColorLerp', () => {
  it('lerpColor と同じ結果を返す', () => {
    const interp = createColorLerp('#ea5532', '#009fe8')
    expect(interp(0)).toBe(lerpColor('#ea5532', '#009fe8', 0))
    expect(interp(0.5)).toBe(lerpColor('#ea5532', '#009fe8', 0.5))
    expect(interp(1)).toBe(lerpColor('#ea5532', '#009fe8', 1))
  })

  it('不正な入力は構築時に throw', () => {
    expect(() => createColorLerp('#abc', '#000000')).toThrow()
  })
})
