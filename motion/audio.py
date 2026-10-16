#!/usr/bin/env python3
"""Synthesize the soundtrack: music bed + sound effects timed to events.json,
plus the Egyptian-Arabic voiceover when --voice is given and edge-tts can reach its service.

    python3 audio.py <buildDir> [--voice]   ->  <buildDir>/audio.wav
"""
import asyncio, json, os, subprocess, sys, wave
import numpy as np

SR = 44100
HERE = os.path.dirname(os.path.abspath(__file__))
rng = np.random.default_rng(7)


def tt(d):
    return np.arange(int(d * SR)) / SR


def sine(f, d, decay=None, phase_f=None):
    t = tt(d)
    ph = 2 * np.pi * (np.cumsum(phase_f(t)) / SR if phase_f else f * t)
    y = np.sin(ph)
    return y * np.exp(-t / decay) if decay else y


def noise(d, decay=None):
    t = tt(d)
    y = rng.uniform(-1, 1, len(t))
    return y * np.exp(-t / decay) if decay else y


def lowpass(y, a):  # one-pole, a in (0,1], a may be an array
    out = np.empty_like(y)
    acc = 0.0
    a = np.broadcast_to(a, y.shape)
    for i in range(len(y)):
        acc += a[i] * (y[i] - acc)
        out[i] = acc
    return out


def env_ad(n, attack=0.005):
    e = np.ones(n)
    k = min(n, int(attack * SR))
    e[:k] = np.linspace(0, 1, k)
    return e


SFX = {
    "tick": lambda: 0.35 * (noise(0.03, 0.006) * 0.6 + sine(3200, 0.03, 0.008)),
    "click": lambda: 0.35 * (noise(0.02, 0.004) + sine(2200, 0.02, 0.005)),
    "ping": lambda: 0.22 * np.concatenate([sine(1320, 0.09, 0.05), sine(1760, 0.35, 0.12)]),
    "ping_soft": lambda: 0.07 * sine(rng.choice([1320, 1480, 1760]), 0.2, 0.06),
    "swish": lambda: 0.25 * lowpass(noise(0.28), np.linspace(0.9, 0.2, int(0.28 * SR))) * np.hanning(int(0.28 * SR)),
    "hit": lambda: 0.6 * (sine(0, 0.6, 0.18, lambda t: 40 + 120 * np.exp(-t / 0.04)) + 0.25 * noise(0.6, 0.03)),
    "pop": lambda: 0.22 * sine(0, 0.12, 0.05, lambda t: 380 + 700 * t / 0.12),
    "low": lambda: 0.16 * np.sign(np.concatenate([sine(440, 0.14), sine(330, 0.2)])) * np.concatenate(
        [np.exp(-tt(0.14) / 0.1), np.exp(-tt(0.2) / 0.1)]),
    "chime": lambda: 0.12 * sum(sine(f, 1.6, 0.6) for f in (784, 988, 1175, 1568)),
    "whoosh": lambda: 0.28 * lowpass(noise(0.55), np.linspace(0.02, 0.5, int(0.55 * SR)) ** 1.5)
    * np.hanning(int(0.55 * SR)) * 3,
}
for i, f in enumerate((523, 659, 784, 1047)):
    SFX[f"blip{i}"] = (lambda f=f: 0.2 * (sine(f, 0.4, 0.15) + 0.3 * sine(2 * f, 0.4, 0.08)))


def alarm(d):
    t = tt(d)
    gate = (np.sin(2 * np.pi * 9 * t) > 0).astype(float)
    tone = np.where((t * 4).astype(int) % 2 == 0, np.sin(2 * np.pi * 880 * t), np.sin(2 * np.pi * 1175 * t))
    return 0.13 * lowpass(gate * np.sign(tone) * 0.6 + gate * tone * 0.4, 0.35)


def music(dur):
    """Am F C G pad + soft kick/hat at 100 bpm."""
    n = int(dur * SR)
    out = np.zeros(n)
    beat = 0.6
    chords = [(220, 261.6, 329.6), (174.6, 220, 261.6), (261.6, 329.6, 392), (196, 246.9, 293.7)]  # Am F C G
    bar = beat * 4
    t_all = tt(dur)
    for k in range(int(dur / bar) + 1):
        s = int(k * bar * SR)
        if s >= n:
            break
        seg = min(int(bar * SR) + int(0.4 * SR), n - s)
        t = t_all[:seg]
        ch = chords[k % 4]
        y = sum(np.sin(2 * np.pi * f * t) + 0.5 * np.sin(2 * np.pi * f * 1.004 * t) + 0.25 * np.sin(2 * np.pi * f / 2 * t)
                for f in ch)
        e = np.minimum(1, t / 0.4) * np.minimum(1, (seg / SR - t) / 0.5)
        out[s:s + seg] += 0.035 * y * e
    for b in range(int(dur / beat)):
        s = int(b * beat * SR)
        k = 0.35 * sine(0, 0.35, 0.12, lambda t: 45 + 90 * np.exp(-t / 0.03))
        out[s:s + len(k)] += k[: n - s]
        s2 = int((b + 0.5) * beat * SR)
        h = 0.04 * noise(0.05, 0.01)
        out[s2:s2 + len(h)] += h[: max(0, n - s2)]
    fade = np.minimum(1, t_all / 0.6) * np.minimum(1, (dur - t_all) / 1.5)
    return out * fade


def place(buf, clip, at):
    s = int(at * SR)
    if s >= len(buf):
        return
    e = min(len(buf), s + len(clip))
    buf[s:e] += clip[: e - s]


def load_audio(path):
    raw = subprocess.check_output(["ffmpeg", "-v", "error", "-i", path, "-f", "s16le", "-ac", "1", "-ar", str(SR), "-"])
    return np.frombuffer(raw, dtype=np.int16).astype(np.float64) / 32768


async def tts_lines(cfg, build):
    import edge_tts
    paths = []
    for i, ln in enumerate(cfg["lines"]):
        p = os.path.join(build, f"vo_{i}.mp3")
        await edge_tts.Communicate(ln["text"], cfg["voice"], rate=cfg["rate"]).save(p)
        paths.append(p)
    return paths


def voiceover(dur, build):
    cfg = json.load(open(os.path.join(HERE, "voiceover.json"), encoding="utf-8"))
    paths = asyncio.run(tts_lines(cfg, build))
    vo = np.zeros(int(dur * SR))
    for ln, p in zip(cfg["lines"], paths):
        y = load_audio(p)
        room = ln["end"] - ln["start"]
        if len(y) / SR > room:  # speed up to fit the scene
            fast = p.replace(".mp3", "_fit.wav")
            subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", p, "-filter:a",
                            f"atempo={min(2.0, len(y) / SR / room):.3f}", fast], check=True)
            y = load_audio(fast)
        place(vo, y, ln["start"])
    return vo


def main():
    build = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 and not sys.argv[1].startswith("-") else os.path.join(HERE, "build"))
    data = json.load(open(os.path.join(build, "events.json")))
    dur = data["duration"]
    n = int(dur * SR)
    fx = np.zeros(n)
    evs = data["events"]
    a0 = next(e["t"] for e in evs if e["type"] == "alarm_start")
    a1 = next(e["t"] for e in evs if e["type"] == "alarm_stop")
    place(fx, alarm(a1 - a0), a0)
    for e in evs:
        if e["type"] in SFX:
            place(fx, SFX[e["type"]](), e["t"])

    mus = music(dur)
    vo = np.zeros(n)
    if "--voice" in sys.argv:
        try:
            vo = voiceover(dur, build)
        except Exception as ex:  # network blocked etc.
            print(f"voiceover skipped: {ex.__class__.__name__}: {ex}", file=sys.stderr)
    if np.any(vo):
        env = lowpass((np.abs(vo) > 0.02).astype(float), 0.0005)
        mus *= 1 - 0.6 * np.clip(env * 3, 0, 1)  # duck music under speech
        fx *= 0.7
    mix = mus + fx + vo * 1.1
    mix = mix / max(1e-9, np.max(np.abs(mix))) * 0.9
    out = os.path.join(build, "audio.wav")
    with wave.open(out, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((mix * 32767).astype(np.int16).tobytes())
    print(out, "(with voice)" if np.any(vo) else "(music + sfx)")


if __name__ == "__main__":
    main()
