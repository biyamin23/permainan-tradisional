import { createRandom, pick } from '../kit'

const SKINS = ['#c98c5f', '#b97a4f', '#d79b6c', '#a86c45', '#c48558']
const BOY_SHIRTS = ['#3a6ea5', '#e0a03a', '#5a9a4a', '#d9573b', '#7a5aa8', '#2f8a8a', '#f2f2ea']
const GIRL_SHIRTS = ['#e9779a', '#f2c14e', '#9b6ad0', '#5bb5a8', '#f08a5a', '#d84a6a']
const BOTTOMS = ['#4b3a2c', '#2f3f5a', '#5a4a3a', '#3a5a4a', '#6a2f2f']
const KAIN = ['#c2527a', '#3f6a8a', '#7a3f8a', '#a8452f', '#2f7a5a']
const SLIPPERS = ['#2f6fd1', '#d9473b', '#3cb371', '#f2c14e', '#1e1e1e']

/** Deterministic kampung kid outfits so every visit looks the same. */
export function kidLook(seed, girl = false) {
  const random = createRandom(seed * 97 + (girl ? 13 : 7))
  const tudung = girl && random() > 0.55
  return {
    skin: pick(random, SKINS),
    shirt: pick(random, girl ? GIRL_SHIRTS : BOY_SHIRTS),
    bottom: girl ? pick(random, KAIN) : pick(random, BOTTOMS),
    bottomType: girl ? 'kain' : 'shorts',
    hair: '#21140d',
    hairStyle: girl && !tudung ? 'pigtails' : 'short',
    headwear: tudung ? 'tudung' : null,
    headwearColor: tudung ? pick(random, ['#f5f2ea', '#f2c14e', '#9fd0e0', '#f3b0c3']) : null,
    slipper: pick(random, SLIPPERS),
    accent: pick(random, ['#f2c14e', '#ffffff', '#ffd54f']),
  }
}
