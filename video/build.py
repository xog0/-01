#!/usr/bin/env python3
"""Build the vertical (1080x1920) video with Egyptian-Arabic voiceover.

    pip install edge-tts          # needs ffmpeg, node and playwright too
    python3 build.py              # -> output/video.mp4
    python3 build.py --no-voice   # silent preview using estimated timings
"""
import argparse, asyncio, json, os, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
BUILD = os.path.join(HERE, "build")
OUT = os.path.join(HERE, "output")
FPS = 30
PAD = 0.35  # silence after each spoken line
FADE = 0.25


def run(cmd):
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)


def duration(path):
    out = subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                                   "-of", "csv=p=0", path])
    return float(out)


async def tts(cfg):
    import edge_tts
    files = []
    for i, s in enumerate(cfg["scenes"], 1):
        f = os.path.join(BUILD, f"voice_{i:02d}.mp3")
        await edge_tts.Communicate(s["voice"], cfg["voice"], rate=cfg["rate"]).save(f)
        files.append(f)
    return files


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--no-voice", action="store_true")
    args = ap.parse_args()

    cfg = json.load(open(os.path.join(HERE, "scenes.json"), encoding="utf-8"))
    os.makedirs(BUILD, exist_ok=True)
    os.makedirs(OUT, exist_ok=True)

    subprocess.run(["node", os.path.join(HERE, "render_scenes.js"), BUILD], check=True)

    if args.no_voice:
        voices = None
        durs = [s["est"] for s in cfg["scenes"]]
    else:
        voices = asyncio.run(tts(cfg))
        durs = [duration(v) + PAD for v in voices]
    print("scene durations:", [round(d, 2) for d in durs], "total:", round(sum(durs), 2))

    clips = []
    for i, d in enumerate(durs, 1):
        img = os.path.join(BUILD, f"scene_{i:02d}.png")
        clip = os.path.join(BUILD, f"clip_{i:02d}.mp4")
        frames = int(round(d * FPS))
        # slow push-in zoom + quick fade in/out
        vf = (f"scale=2160:3840,zoompan=z='1+0.06*on/{frames}':x='iw/2-iw/zoom/2':"
              f"y='ih/2-ih/zoom/2':d={frames}:s=1080x1920:fps={FPS},"
              f"fade=t=in:st=0:d={FADE},fade=t=out:st={d - FADE:.3f}:d={FADE},format=yuv420p")
        run(["ffmpeg", "-y", "-loop", "1", "-i", img, "-vf", vf, "-frames:v", str(frames),
             "-c:v", "libx264", "-preset", "medium", "-crf", "20", clip])
        clips.append(clip)

    lst = os.path.join(BUILD, "clips.txt")
    with open(lst, "w") as f:
        f.writelines(f"file '{c}'\n" for c in clips)
    silent = os.path.join(BUILD, "silent.mp4")
    run(["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", lst, "-c", "copy", silent])

    if voices is None:
        dst = os.path.join(OUT, "preview_no_voice.mp4")
        os.replace(silent, dst)
    else:
        # pad each voice line to its scene length, then join
        inputs, filt = [], []
        for i, (v, d) in enumerate(zip(voices, durs)):
            inputs += ["-i", v]
            filt.append(f"[{i + 1}:a]aresample=44100,apad=whole_dur={d:.3f}[a{i}]")
        filt.append("".join(f"[a{i}]" for i in range(len(voices)))
                    + f"concat=n={len(voices)}:v=0:a=1,loudnorm=I=-14:TP=-1.5[aout]")
        dst = os.path.join(OUT, "video.mp4")
        run(["ffmpeg", "-y", "-i", silent, *inputs, "-filter_complex", ";".join(filt),
             "-map", "0:v", "-map", "[aout]", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
             "-shortest", "-movflags", "+faststart", dst])
    print("done:", dst)


if __name__ == "__main__":
    try:
        main()
    except subprocess.CalledProcessError as e:
        sys.stderr.write((e.stderr or b"").decode(errors="replace")[-2000:])
        raise
