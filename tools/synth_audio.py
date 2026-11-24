#!/usr/bin/env python3
"""One Pan - all audio synthesized locally with numpy. No AI audio,
no downloads. 44.1kHz 16-bit mono WAVs. Music loops are exactly periodic.
"""
import os
import wave

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(os.path.dirname(HERE), "audio", "wav")
os.makedirs(OUT, exist_ok=True)

SR = 44100
rng = np.random.default_rng(20261123)


def write(name, data, peak_db=-3.0):
    data = np.asarray(data, dtype=np.float64)
    peak = np.max(np.abs(data)) + 1e-12
    target = 10 ** (peak_db / 20.0)
    data = np.clip(data * (target / peak), -1.0, 1.0)
    path = os.path.join(OUT, name)
    with wave.open(path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((data * 32767).astype(np.int16).tobytes())
    print("wrote", path, f"{len(data)/SR:.2f}s")


def env(n, attack=0.005, decay=None):
    t = np.arange(n) / SR
    a = np.minimum(1.0, t / attack)
    if decay is None:
        decay = n / SR
    d = np.exp(-t / max(decay, 1e-4))
    return a * d


def sine(freq, dur, amp=0.5, decay=0.15):
    n = int(dur * SR)
    t = np.arange(n) / SR
    return amp * np.sin(2 * np.pi * freq * t) * env(n, decay=decay)


def tri(freq, dur, amp=0.4, decay=0.2):
    n = int(dur * SR)
    t = np.arange(n) / SR
    ph = (freq * t) % 1.0
    wave_ = 4 * np.abs(ph - 0.5) - 1.0
    return amp * wave_ * env(n, decay=decay)


def noise_burst(dur, amp=0.5, cutoff=3000):
    n = int(dur * SR)
    x = rng.standard_normal(n)
    alpha = cutoff / (cutoff + SR)
    y = np.zeros(n)
    acc = 0.0
    for i in range(n):
        acc += alpha * (x[i] - acc)
        y[i] = acc
    return amp * y * env(n, attack=0.001, decay=dur / 4)


def sweep(f0, f1, dur, amp=0.4, decay=None):
    n = int(dur * SR)
    t = np.arange(n) / SR
    phase = 2 * np.pi * (f0 * t + (f1 - f0) * t * t / (2 * dur))
    return amp * np.sin(phase) * env(n, decay=decay or dur / 2)


def mix_at(base, sig, start_s):
    i = int(start_s * SR)
    end = min(len(base), i + len(sig))
    base[i:end] += sig[: end - i]
    return base


def mix(*sigs):
    n = max(len(s) for s in sigs)
    out = np.zeros(n)
    for s in sigs:
        out[:len(s)] += s
    return out


# ------------------------------------------------------------------ SFX --
write("sfx_click.wav", sine(880, 0.06, 0.4, decay=0.025))
# serve: bright two-note chime + pop snap
write("sfx_serve.wav", mix(
    sweep(700, 180, 0.12, 0.4, decay=0.05),
    mix_at(np.zeros(int(0.35 * SR)), tri(1046, 0.2, 0.4, 0.1), 0.0),
    mix_at(np.zeros(int(0.35 * SR)), tri(1318, 0.25, 0.4, 0.12), 0.08)))
# perfect: three-note rising chime
p = np.zeros(int(0.6 * SR))
for i, f in enumerate([880, 1174, 1568]):
    p = mix_at(p, tri(f, 0.25, 0.45, 0.12), i * 0.09)
write("sfx_perfect.wav", p)
# underdone: dull low thud
write("sfx_under.wav", mix(sine(150, 0.18, 0.5, decay=0.08),
                           sine(110, 0.18, 0.4, decay=0.08)))
# burnt: harsh buzz
write("sfx_burnt.wav", mix(sine(110, 0.35, 0.4, decay=0.15),
                           sine(165, 0.35, 0.3, decay=0.15),
                           noise_burst(0.3, 0.25, 1200)))
# season: shimmer sweep up
write("sfx_season.wav", mix(sweep(400, 1600, 0.4, 0.35, decay=0.2),
                            sine(2093, 0.2, 0.2, decay=0.1)))
# sizzle: short grill hiss when food lands
write("sfx_sizzle.wav", noise_burst(0.3, 0.3, 5000))
write("sfx_combo.wav", mix(tri(880, 0.15, 0.4, 0.08),
                           mix_at(np.zeros(int(0.3 * SR)), tri(1174, 0.18, 0.4, 0.09), 0.07)))
m = np.zeros(int(0.7 * SR))
m = mix_at(m, tri(880, 0.25, 0.45, 0.12), 0.0)
m = mix_at(m, tri(1318, 0.4, 0.45, 0.2), 0.12)
write("sfx_mission.wav", m)
w = np.zeros(int(1.6 * SR))
for i, f in enumerate([523, 659, 784, 1046]):
    w = mix_at(w, tri(f, 0.4, 0.45, 0.18), i * 0.18)
write("sfx_win.wav", w)
l = np.zeros(int(1.0 * SR))
for i, f in enumerate([392, 330, 262]):
    l = mix_at(l, tri(f, 0.35, 0.4, 0.16), i * 0.2)
write("sfx_lose.wav", l)


# ---------------------------------------------------------------- music --
def note(freq, start, dur, amp=0.22):
    n = int(dur * SR)
    t = np.arange(n) / SR
    sig = amp * np.sin(2 * np.pi * freq * t) * np.exp(-t / (dur * 0.6))
    sig += 0.4 * amp * np.sin(2 * np.pi * freq * 2 * t) * np.exp(-t / (dur * 0.4))
    return start, sig


def loop_melody(events, total_s, name):
    out = np.zeros(int(total_s * SR))
    for freq, start, dur, amp in events:
        _, sig = note(freq, start, dur, amp)
        i = int(start * SR)
        out[i:i + len(sig)] += sig[:len(out) - i]
    write(name, out, peak_db=-6.0)


# Menu loop: gentle D-major, 8s, swaying 3/4 feel
D, E, FSH, G, A, B = 293.66, 329.63, 369.99, 392.0, 440.0, 493.88
D5, FSH5, A5 = 587.33, 739.99, 880.0
menu = []
mel = [D5, FSH5, A5, FSH5, E, FSH5, D5, B, A, B, D5, A, G, FSH, E, D]
for i, f in enumerate(mel):
    menu.append((f, i * 0.5, 0.45, 0.2))
    menu.append((f / 2, i * 0.5, 0.48, 0.12))
loop_melody(menu, 8.0, "bgm_menu.wav")

# Game loop: bouncy D-major pentatonic, 8s, 0.4s steps
game = []
mel2 = [D5, A5, FSH5, A5, D5, FSH5, G, A, B, A, FSH5, D5,
        E, FSH5, A, D5]
mel2 = [587.33, 880.0, 739.99, 880.0, 587.33, 739.99, 783.99, 880.0,
        987.77, 880.0, 739.99, 587.33, 659.25, 739.99, 880.0, 587.33]
for i, f in enumerate(mel2):
    game.append((f, i * 0.4, 0.38, 0.18))
    game.append((f / 2, i * 0.4, 0.4, 0.1))
loop_melody(game, 8.0, "bgm_game.wav")
print("audio done")
