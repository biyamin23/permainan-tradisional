import * as Art from './tutorialArt'

/**
 * Step-by-step "cara main" for each game, shown before the first game and
 * from the Cara main button. Keep each step to one thing to do.
 * Keyed by game id (Teng-Teng is still 'ting-ting').
 */
export const TUTORIALS = {
  congkak: [
    {
      art: Art.CongkakGoal,
      title: 'Kumpul guli dalam rumah kamu',
      body: 'Kamu lawan Aisyah. Rumah kamu ialah lubang besar di sebelah kiri. Guli paling banyak dalam rumah di akhir permainan menang.',
      tip: 'Tak perlu osom: setiap pusingan, kamu dan Aisyah mula serentak.',
    },
    {
      art: Art.CongkakPick,
      title: 'Tekan satu kampung di barisan kamu',
      body: 'Kampung (lubang kecil) di barisan bawah akan bercahaya. Tekan satu untuk ambil semua gulinya. Di permulaan setiap pusingan, Aisyah pun mula pada masa yang sama.',
    },
    {
      art: Art.CongkakSow,
      title: 'Guli diagih satu demi satu',
      body: 'Guli bergerak ke kiri sepanjang barisan kamu, masuk rumah kamu, kemudian ke barisan Aisyah. Ini berlaku sendiri, kamu cuma tengok.',
      tip: 'Tahan butang ⏩ untuk laju 2×.',
    },
    {
      art: Art.CongkakLast,
      title: 'Guli terakhir paling penting',
      body: 'Jatuh dalam rumah kamu: teruskan dengan kampung lain. Jatuh dalam kampung yang ada guli: kaut semua dan terus agih. Jatuh dalam kampung kosong: mati, giliran tamat.',
    },
    {
      art: Art.CongkakShoot,
      title: 'Tembak!',
      body: 'Guli terakhir jatuh dalam kampung kosong di barisan kamu (selepas melalui barisan Aisyah)? Kaut semua guli di kampung Aisyah yang setentang masuk rumah kamu.',
      tip: 'Masa giliran Aisyah, tekan papan untuk langkau.',
    },
    {
      art: Art.CongkakGoal,
      title: 'Pusingan dan kampung terbakar',
      body: 'Bila semua kampung kosong, pusingan tamat. Isi semula kampung, 7 guli setiap satu, dari guli dalam rumah. Kampung yang tak cukup guli terbakar 🔥 dan tak boleh dimain lagi.',
      tip: 'Kalau guli sama banyak di akhir permainan, yang lebih banyak kampung terbakar kalah.',
    },
  ],

  dam: [
    {
      art: Art.DamGoal,
      title: 'Habiskan buah Pak Tam',
      body: 'Kamu main buah biru (bawah), Pak Tam buah merah (atas). Menang bila semua buah Pak Tam habis atau dia tak boleh bergerak.',
      tip: 'Mula-mula osom untuk tentukan siapa main dulu.',
    },
    {
      art: Art.DamMove,
      title: 'Tekan buah, kemudian tekan bulatan kuning',
      body: 'Buah yang boleh bergerak akan bercahaya. Tekan satu, kemudian tekan bulatan kuning. Buah bergerak satu petak serong ke depan.',
      tip: 'Nak tukar buah? Tekan saja buah lain.',
    },
    {
      art: Art.DamCapture,
      title: 'Makan: lompat atas buah lawan',
      body: 'Kalau buah merah di sebelah serong dan petak di belakangnya kosong, lompat atasnya untuk makan. Makan itu wajib, dan kalau boleh makan lagi, teruskan.',
    },
    {
      art: Art.DamKing,
      title: 'Sampai hujung: naik haji',
      body: 'Buah yang sampai ke barisan paling atas jadi haji 👑. Haji boleh gerak dan makan ke depan dan ke belakang.',
    },
  ],

  'sepak-raga': [
    {
      art: Art.RagaGoal,
      title: 'Jangan biar bola jatuh',
      body: 'Pasukan kamu (5 orang dalam bulatan) lawan Geng Pak-pak. Sepak bola raga antara satu sama lain. Setiap hantaran yang disambut = 1 mata.',
      tip: 'Osom dahulu: yang menang, pasukannya main dulu.',
    },
    {
      art: Art.RagaServe,
      title: 'Mula: lambung bola',
      body: 'Kamu pemain 1. Setiap lambungan bermula dengan kamu: tekan butang muka pemain 3, 4 atau 5 untuk lambung bola kepadanya.',
    },
    {
      art: Art.RagaRing,
      title: 'Bola datang: tekan bila hijau',
      body: 'Gelang kuning mengecil ke arah gelang putih. Tekan butang tepat bila gelang jadi hijau. Lebih tepat, lebih cantik sepakan. Terlepas, bola jatuh.',
      tip: 'Boleh juga tekan terus di padang.',
    },
    {
      art: Art.RagaChoose,
      title: 'Timang atau hantar',
      body: '⬆ Timang untuk kawal bola sendiri. Hantar ↖ ↗ kepada kawan di seberang bulatan kecil. Seorang boleh sentuh 3 kali sahaja, sentuhan ke-3 mesti hantar.',
    },
    {
      art: Art.RagaEnd,
      title: 'Bola mati, kemudian giliran lawan',
      body: 'Bola mati bila jatuh ke tanah. Setiap pasukan ada 3 lambungan dalam 90 saat, 3 pusingan semuanya. Mata paling banyak menang.',
      tip: 'Masa Geng Pak-pak main, tekan Langkau ⏩ kalau tak mahu tengok.',
    },
  ],

  'ting-ting': [
    {
      art: Art.TengGoal,
      title: 'Kumpul rumah lebih banyak dari Rukiah',
      body: 'Lompat petak 1 hingga 9 dan balik. Habis semua petak, kamu boleh dapat satu rumah. Rumah paling banyak menang.',
      tip: 'Osom dahulu: yang menang main dulu.',
    },
    {
      art: Art.TengThrow,
      title: 'Baling gundu: tahan, kemudian lepas',
      body: 'Tekan dan tahan butang baling. Anak panah naik dari petak 1 ke 9, kemudian turun balik. Lepaskan jari bila anak panah tepat di petak sasaran.',
      tip: 'Sasaran bermula petak 1, kemudian 2, 3… hingga 9.',
    },
    {
      art: Art.TengRing,
      title: 'Tekan Lompat bila gelang jadi hijau',
      body: 'Setiap lompatan, gelang mengecil dan mengembang 3 kali. Tekan butang Lompat bila gelang jadi hijau. Kaki dipilih sendiri: sebelah kaki, dua kaki atau langkau petak bergundu. Tak sempat tekan: mati.',
    },
    {
      art: Art.TengBack,
      title: 'Balik dan ambil gundu',
      body: 'Masa balik, kamu berhenti sendiri sebelum petak gundu. Butang bertukar jadi 🤲 Ambil: tekan bila gelang jadi hijau, kemudian lompat keluar.',
    },
    {
      art: Art.TengTimbang,
      title: 'Timbang',
      body: 'Habis 9 petak, gundu diletak atas kepala. Tekan ◀ Kiri atau Kanan ▶ untuk jaga imbangan (condong ke arah sebaliknya). Akhir sekali tekan 🙌 Sambut.',
    },
    {
      art: Art.TengHouse,
      title: 'Baling tanpa lihat, dapat rumah',
      body: 'Lulus timbang? Baling gundu tanpa lihat. Petak kosong yang kena jadi rumah kamu. Rukiah mesti langkau rumah kamu.',
      tip: 'Masa giliran Rukiah, tekan Langkau ⏩ untuk cepat.',
    },
  ],
  'lumba-basikal': [
    {
      art: Art.BasikalKeys,
      title: 'Kayuh, belok, brek',
      body: 'Tahan W atau ↑ untuk kayuh. Lepas, basikal perlahan sendiri. A D atau ← → untuk belok, S atau ↓ untuk brek.',
      tip: 'Laju sangat masa selekoh? Lepas kayuh atau brek sikit.',
    },
    {
      art: Art.BasikalTouch,
      title: 'Main di telefon',
      body: 'Tolak joystick kiri: ke depan untuk kayuh, ke tepi untuk belok, ke belakang untuk brek. Butang PECUT dan BREK di kanan.',
    },
    {
      art: Art.BasikalBoost,
      title: 'Pecut bila perlu',
      body: 'Tahan SPACE (atau PECUT) untuk laju sekejap. Meter pecut habis bila digunakan, dan penuh semula perlahan-lahan.',
      tip: 'Simpan pecut untuk jalan lurus terakhir!',
    },
    {
      art: Art.BasikalCheckpoint,
      title: 'Sampai garisan dulu',
      body: 'Lalu checkpoint 1, 2 dan 3, kemudian pecut ke garisan TAMAT. Langgar ayam, batu atau motosikal? Basikal goyang dan perlahan.',
      tip: 'Jalan pintas ada di litar Biasa dan Jaguh. Kamarul pun tahu!',
    },
  ],
}

const KEY = 'pt.tutorial.'

export function tutorialSeen(id) {
  try {
    return localStorage.getItem(KEY + id) === '1'
  } catch {
    return false
  }
}

export function markTutorialSeen(id) {
  try {
    localStorage.setItem(KEY + id, '1')
  } catch {
    /* private mode: it just shows again next time */
  }
}
