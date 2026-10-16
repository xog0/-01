#!/usr/bin/env python3
"""Makes output/compare.mp3: every voiceover line in each of its spelling variants, announced
("الجملة الأولى، النسخة التانية") so you can pick the best pronunciation by ear."""
import asyncio, json, os, subprocess
import edge_tts

HERE = os.path.dirname(os.path.abspath(__file__))
B = os.path.join(HERE, "build", "compare")
ORD = ["الأولى", "التانية", "التالتة", "الرابعة", "الخامسة", "السادسة"]


async def main():
    cfg = json.load(open(os.path.join(HERE, "voiceover.json"), encoding="utf-8"))
    proxy = os.environ.get("HTTPS_PROXY")
    os.makedirs(B, exist_ok=True)
    parts = []

    async def say(text, name, rate=cfg["rate"], voice=cfg["voice"]):
        p = os.path.join(B, name + ".mp3")
        await edge_tts.Communicate(text, voice, rate=rate, proxy=proxy).save(p)
        parts.append(p)

    for i, ln in enumerate(cfg["lines"]):
        for j, v in enumerate(ln["variants"]):
            await say(f"الجملة {ORD[i]}، النسخة {ORD[j]}.", f"l{i}v{j}_label", voice="ar-EG-SalmaNeural")
            await say(v, f"l{i}v{j}")
    lst = os.path.join(B, "list.txt")
    with open(lst, "w") as f:
        f.writelines(f"file '{p}'\n" for p in parts)
    out = os.path.join(HERE, "output", "compare.mp3")
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", lst,
                    "-af", "apad=pad_dur=0", "-c:a", "libmp3lame", "-q:a", "3", out], check=True)
    print(out)


asyncio.run(main())
