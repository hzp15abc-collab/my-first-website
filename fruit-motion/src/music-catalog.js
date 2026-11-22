// V1.5: licensed, finished recordings (no algorithmic BGM). Source originals
// are checksum-pinned by prepare-music; the browser requests local MP3s only.
// Retain V1.3 IDs to preserve saved preferences across versions.
export const DEFAULT_MUSIC = 'groove';
export const MUSIC_SAMPLE_RATE = 44100;
export const MUSIC_LOOP_CROSSFADE = .2;
export const MUSIC_LICENSES = Object.freeze({
  cc0: Object.freeze({ name: 'CC0 1.0', url: 'https://creativecommons.org/publicdomain/zero/1.0/' }),
  by4: Object.freeze({ name: 'CC BY 4.0', url: 'https://creativecommons.org/licenses/by/4.0/' }),
});
// Legacy UI exports: per-track credit and license are always authoritative.
export const MUSIC_LICENSE = 'CC0 1.0 / CC BY 4.0';
export const MUSIC_LICENSE_URL = 'https://creativecommons.org/';

function track({ id, label, title, author, licenseKey, sourceUrl, downloadUrl, sourceFilename, sourceSha256, sourceBytes, sourceOffset, pcmFrames, bpm }) {
  const license = MUSIC_LICENSES[licenseKey];
  const durationSeconds = pcmFrames / MUSIC_SAMPLE_RATE;
  return Object.freeze({
    id, label, title, author, license: license.name, licenseUrl: license.url,
    source: sourceUrl, sourceUrl, downloadUrl, sourceFilename, sourceSha256, sourceBytes, sourceOffset,
    pcmFrames, durationSeconds, bpm, loopStart: MUSIC_LOOP_CROSSFADE, loopEnd: durationSeconds,
    src: new URL(`../assets/music/${id}.mp3`, import.meta.url).href,
    modifications: 'Excerpt edited to a rhythmic boundary; 0.2 s loop seam blend, loudness normalization, stereo MP3 encoding.',
  });
}

export const MUSIC_TRACKS = Object.freeze({
  groove: track({
    id: 'groove', label: '🪩 水果迪斯科', title: 'Funky Disco Beats to Boogie/Woogie to', author: 'Fupi', licenseKey: 'cc0',
    sourceUrl: 'https://opengameart.org/content/funky-disco-beats-to-boogiewoogie-to',
    downloadUrl: 'https://opengameart.org/sites/default/files/funkydiscobeatstoboogieslashwoogieto.flac',
    sourceFilename: 'disco.flac', sourceSha256: 'c279ed958fbe2022f80d01c5dbdad2e4a19786b764cf149730ab72773e209d38', sourceBytes: 14544578,
    sourceOffset: 0, pcmFrames: 3078982, bpm: 110,
  }),
  action: track({
    id: 'action', label: '⚡ 律动派对', title: 'Funky Pop', author: 'HoliznaCC0', licenseKey: 'cc0',
    sourceUrl: 'https://freemusicarchive.org/music/holiznacc0/power-pop/funky-pop/',
    downloadUrl: 'https://files.freemusicarchive.org/storage-freemusicarchive-org/tracks/c3qtEJjVKXI87BexJ5Ra4Sxy2iY9DAphxzqyrhg6.mp3',
    sourceFilename: 'holfunk.mp3', sourceSha256: 'f4ece98b361ba68fdfa5c94c8856e639c64459f10b10c5294e523e3c00d9bbcf', sourceBytes: 5712163,
    sourceOffset: 0, pcmFrames: 3175200, bpm: 120,
  }),
  retro: track({
    id: 'retro', label: '🕹️ 像素电音', title: 'Sippy Pop', author: 'congusbongus', licenseKey: 'by4',
    sourceUrl: 'https://opengameart.org/content/sippy-pop',
    downloadUrl: 'https://opengameart.org/sites/default/files/sippypop_0.ogg',
    sourceFilename: 'sippy.ogg', sourceSha256: '3afa5c0825103d2fc6e5bb4807634f52baeae37da131e8603d24139037f67558', sourceBytes: 5639634,
    sourceOffset: .405, pcmFrames: 3386880, bpm: 150,
  }),
  space: track({
    id: 'space', label: '🚀 电音冲刺', title: 'Virtual Rush', author: 'Vitalezzz', licenseKey: 'cc0',
    sourceUrl: 'https://opengameart.org/content/virtual-rush',
    downloadUrl: 'https://opengameart.org/sites/default/files/virtual_rush_loop_0.mp3',
    sourceFilename: 'rush.mp3', sourceSha256: 'be1bef582464c164f11869291662ed04fa9844af1921b558853be7e9b7b0d5e5', sourceBytes: 6441852,
    sourceOffset: 16, pcmFrames: 3175200, bpm: 120,
  }),
  forest: track({
    id: 'forest', label: '🌴 轻松摇摆', title: 'Funked Up', author: 'Joth', licenseKey: 'cc0',
    sourceUrl: 'https://opengameart.org/content/funked-up',
    downloadUrl: 'https://opengameart.org/sites/default/files/Funked%20Up.mp3',
    sourceFilename: 'funked.mp3', sourceSha256: '57cd81254a0f4e068535c5421f93b586514332ad2377f81aea190dd91659fff3', sourceBytes: 1329549,
    sourceOffset: 0, pcmFrames: 2910600, bpm: 88,
  }),
});

const RETIRED_MUSIC_IDS = Object.freeze({ adventure: 'action', sunny: 'action', dream: 'forest' });

export function normalizeMusicStyle(value) {
  if (typeof value !== 'string') return DEFAULT_MUSIC;
  if (value === 'off' || Object.hasOwn(MUSIC_TRACKS, value)) return value;
  return Object.hasOwn(RETIRED_MUSIC_IDS, value) ? RETIRED_MUSIC_IDS[value] : DEFAULT_MUSIC;
}
