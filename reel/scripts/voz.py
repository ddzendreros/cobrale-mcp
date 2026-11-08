"""Genera la locución por escena con edge-tts (voces neuronales es-MX, sin API key).

Uso:  npm run voz              -> todas las escenas
      npm run voz -- gancho    -> solo esa escena
Escribe public/voz/NN-id.mp3 (+ .json con los tiempos de cada palabra, para los subtítulos).
Después corre `npm run medir`.

¿Prefieres tu propia voz? Graba cada escena y guárdala como public/voz/NN-id.mp3
(mismo nombre) y corre solo `npm run medir`.
"""
import asyncio, json, subprocess, sys
from pathlib import Path
import edge_tts

RAIZ = Path(__file__).resolve().parent.parent
guion = json.loads((RAIZ / "guion.json").read_text(encoding="utf-8"))
OUT = RAIZ / "public" / "voz"
TMP = RAIZ / ".tmp"
OUT.mkdir(parents=True, exist_ok=True)
TMP.mkdir(exist_ok=True)

# Cadena de mezcla para que no suene "plana de estudio": quita rumbo grave, da presencia,
# comprime suave, mete un cuarto muy corto y normaliza el volumen entre escenas.
FILTRO = (
    "highpass=f=75,"
    "equalizer=f=220:t=q:w=1.2:g=1.5,"
    "equalizer=f=3200:t=q:w=1.0:g=2.5,"
    "acompressor=threshold=-20dB:ratio=2.6:attack=8:release=140:makeup=3,"
    "aecho=0.88:0.9:38|71:0.10|0.05,"
    "loudnorm=I=-16:TP=-1.5:LRA=7"
)


async def una(i, esc, voz):
    nombre = f"{i + 1:02d}-{esc['id']}"
    crudo = TMP / f"{nombre}.mp3"
    # El servicio a veces rechaza textos que empiezan con "¿": se quita del hablado (los subtítulos lo conservan).
    texto = esc["habla"].replace("¿", "")
    for intento in range(1, 5):
        palabras = []
        try:
            com = edge_tts.Communicate(texto, voz["nombre"], rate=voz["rate"], pitch=voz["pitch"], boundary="WordBoundary")
            with open(crudo, "wb") as f:
                async for ev in com.stream():
                    if ev["type"] == "audio":
                        f.write(ev["data"])
                    elif ev["type"] == "WordBoundary":
                        palabras.append({"t": ev["offset"] / 1e7, "d": ev["duration"] / 1e7, "w": ev["text"]})
            break
        except edge_tts.exceptions.NoAudioReceived:
            if intento == 4:
                raise
            await asyncio.sleep(1.5 * intento)
    final = OUT / f"{nombre}.mp3"
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(crudo), "-af", FILTRO, "-ar", "44100", "-b:a", "192k", str(final)], check=True)
    (OUT / f"{nombre}.json").write_text(json.dumps(palabras, ensure_ascii=False), encoding="utf-8")
    print(f"ok {nombre}  ({len(palabras)} palabras)")


async def main():
    solo = set(sys.argv[1:])
    for i, esc in enumerate(guion["escenas"]):
        if solo and esc["id"] not in solo:
            continue
        await una(i, esc, guion["voz"])


asyncio.run(main())
