"""Golpes de la canción: los bombos (los «latidos») y las tarolas, para sincronizar el reel.

    uv run --with librosa --with numpy python promo/ritmo.py promo/audio.mp3 promo/golpes.json

La canción va a 104.8 BPM. Sus bombos llegan en pares, uno tras otro a un octavo, en frases de 4.58 s.
Por eso el reel usa los bombos detectados, no la rejilla de beats de librosa: así cada sacudida cae
donde suena.
"""

import json
import sys

import librosa
import numpy as np

HOP = 128


def main():
    y, sr = librosa.load(sys.argv[1], sr=22050, mono=True, duration=100)
    S = np.abs(librosa.stft(y, n_fft=2048, hop_length=HOP))
    f = librosa.fft_frequencies(sr=sr, n_fft=2048)
    tiempos = librosa.frames_to_time(np.arange(S.shape[1]), sr=sr, hop_length=HOP)

    def envolvente(lo, hi):
        e = np.log1p(S[(f > lo) & (f < hi)].sum(0))
        flujo = np.maximum(0, np.diff(e, prepend=e[0]))
        return flujo / np.percentile(flujo, 99.5)

    def picos(e, umbral, separacion):
        pk = librosa.util.peak_pick(e, pre_max=6, post_max=6, pre_avg=20, post_avg=20, delta=umbral,
                                    wait=int(separacion * sr / HOP))
        return [(round(float(tiempos[p]), 3), round(float(e[p]), 2)) for p in pk]

    golpes = {"kicks": picos(envolvente(30, 140), 0.25, 0.16), "snares": picos(envolvente(1500, 6000), 0.25, 0.16)}
    with open(sys.argv[2], "w") as fh:
        json.dump(golpes, fh)
    print(len(golpes["kicks"]), "bombos,", len(golpes["snares"]), "tarolas")


if __name__ == "__main__":
    main()
