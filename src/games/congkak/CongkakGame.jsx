import { GamePlaceholder } from '../../components/game/GamePlaceholder'

/**
 * Congkak. Gameplay arrives in the next phase; for now the player lands on
 * the game's own screen with its rules, straight from the wakaf.
 */
const RULES = [
  'Setiap rumah kecil diisi 7 biji.',
  'Ambil semua biji dari satu rumah, agihkan satu demi satu ke arah kiri.',
  'Biji terakhir jatuh di rumah berisi? Ambil semua dan teruskan.',
  'Siapa kumpul biji paling banyak dalam rumah besar, dia menang!',
]

export function CongkakGame({ game, mode, onExit }) {
  return <GamePlaceholder game={game} mode={mode} onExit={onExit} rules={RULES} />
}
