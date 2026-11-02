"""Render del reel a MP4, cuadro por cuadro, con Chrome y ffmpeg.

    ../pleno/.venv/bin/python promo/render.py                  → promo/procedencia-reel.mp4 (1080×1920, 30 fps, con audio)
    ../pleno/.venv/bin/python promo/render.py --fotos 2,19,23  → PNG de esos segundos en promo/fotos, para revisar una escena
    ../pleno/.venv/bin/python promo/render.py --pagina reel-v1.html --salida promo/procedencia-reel-v1.mp4   → la primera versión

El audio (promo/audio.mp3) no se publica: tiene derechos de autor y está en .gitignore.
"""

import argparse
import array
import math
import random
import subprocess
import wave
from pathlib import Path

from playwright.sync_api import sync_playwright

HERE = Path(__file__).resolve().parent
SR = 48000


def sonido(tipo, rnd):
    """Una muestra corta de cada efecto, sintetizada: nada de archivos de terceros."""
    n = {"tecla": 0.03, "golpe": 0.12, "sello": 0.32, "corte": 0.09, "impacto": 1.1}[tipo]
    out = []
    fase = 0.0
    for i in range(int(n * SR)):
        x = i / SR
        if tipo == "tecla":  # clic seco de máquina de escribir
            v = (rnd.random() * 2 - 1) * math.exp(-x * 260) * 0.9
        elif tipo == "golpe":  # tic grave y corto
            fase += 2 * math.pi * (180 - 90 * min(1, x / 0.05)) / SR
            v = math.sin(fase) * math.exp(-x * 38) + (rnd.random() * 2 - 1) * math.exp(-x * 400) * 0.4
        elif tipo == "sello":  # sello de goma sobre papel: golpe sordo y chasquido
            fase += 2 * math.pi * (95 - 45 * min(1, x / 0.12)) / SR
            v = math.sin(fase) * math.exp(-x * 16) * 0.9 + (rnd.random() * 2 - 1) * math.exp(-x * 120) * 0.5
        elif tipo == "corte":  # roce de página
            v = (rnd.random() * 2 - 1) * math.sin(math.pi * x / n) * 0.35
        else:  # impacto: sub que cae y ruido
            fase += 2 * math.pi * (62 - 30 * min(1, x / 0.5)) / SR
            v = math.sin(fase) * math.exp(-x * 3.2) + (rnd.random() * 2 - 1) * math.exp(-x * 22) * 0.45
        out.append(v)
    return out


def efectos(cues, duracion, ruta):
    rnd = random.Random(7)
    pista = array.array("f", [0.0]) * int((duracion + 2) * SR)
    for t, tipo, g in cues:
        i0 = int(t * SR)
        for j, v in enumerate(sonido(tipo, rnd)):
            if i0 + j < len(pista):
                pista[i0 + j] += v * g
    pico = max(1e-9, max(abs(v) for v in pista))
    escala = min(1.0, 0.95 / pico)
    datos = array.array("h", (int(max(-1, min(1, v * escala)) * 32767) for v in pista))
    with wave.open(str(ruta), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(datos.tobytes())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--fps", type=int, default=30)
    ap.add_argument("--fotos", help="segundos separados por coma")
    ap.add_argument("--audio", default=str(HERE / "audio.mp3"))
    ap.add_argument("--salida", default=str(HERE / "procedencia-reel.mp4"))
    ap.add_argument("--pagina", default="reel.html")
    args = ap.parse_args()

    with sync_playwright() as pw:
        browser = pw.chromium.launch(channel="chrome")
        page = browser.new_page(viewport={"width": 1080, "height": 1920}, device_scale_factor=1)
        page.on("pageerror", lambda e: print("error en la página:", e))
        page.goto((HERE / args.pagina).as_uri())
        page.evaluate("window.ready")
        page.wait_for_timeout(300)
        if args.fotos:
            out = HERE / "fotos"
            out.mkdir(exist_ok=True)
            for s in args.fotos.split(","):
                page.evaluate(f"window.render({float(s)})")
                page.screenshot(path=str(out / f"t{float(s):05.2f}.png"))
            print(f"fotos en {out}")
            return
        duration = page.evaluate("window.DURATION")
        cues = page.evaluate("window.CUES")
        frames = int(duration * args.fps)
        mudo = HERE / "reel-mudo.mp4"
        ffmpeg = subprocess.Popen(
            ["ffmpeg", "-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", str(args.fps), "-i", "-",
             "-c:v", "libx264", "-pix_fmt", "yuv420p", "-profile:v", "high", "-crf", "16", "-preset", "slow", str(mudo)],
            stdin=subprocess.PIPE)
        for i in range(frames):
            page.evaluate(f"window.render({i / args.fps})")
            ffmpeg.stdin.write(page.screenshot(type="png"))
            if i % 150 == 0:
                print(f"{i}/{frames}", flush=True)
        ffmpeg.stdin.close()
        ffmpeg.wait()
        browser.close()

    # audio: la canción desde 0, recortada a la duración, más los efectos, con fundido final
    sfx = HERE / "reel-efectos.wav"
    efectos(cues, duration, sfx)
    fin = duration - 2.0
    subprocess.run(
        ["ffmpeg", "-y", "-loglevel", "error", "-i", str(mudo), "-i", args.audio, "-i", str(sfx),
         "-filter_complex",
         f"[1:a]atrim=0:{duration},aresample=48000,volume=0.85[m];"
         f"[2:a]atrim=0:{duration},aresample=48000,volume=0.55,pan=stereo|c0=c0|c1=c0[s];"
         f"[m][s]amix=inputs=2:normalize=0,alimiter=limit=0.95,afade=t=out:st={fin}:d=2.0[a]",
         "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest",
         "-movflags", "+faststart", args.salida], check=True)
    mudo.unlink()
    sfx.unlink()
    print(f"listo: {args.salida}")


if __name__ == "__main__":
    main()
