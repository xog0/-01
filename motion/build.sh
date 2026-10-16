#!/usr/bin/env bash
# Build the motion-graphics video.  ./build.sh            -> output/motion.mp4 (music + sfx)
#                                   ./build.sh --voice    -> adds the Egyptian voiceover (needs edge-tts + internet)
#                                   ./build.sh --voice --elevenlabs  -> voiceover from ElevenLabs (needs ELEVENLABS_API_KEY)
set -euo pipefail
cd "$(dirname "$0")"
export NODE_PATH="${NODE_PATH:-$(npm root -g)}"
rm -rf build/frames
node render.js build 30
python3 audio.py build "$@"
mkdir -p output
ffmpeg -y -v error -framerate 30 -i build/frames/f_%05d.jpg -i build/audio.wav \
  -c:v libx264 -preset slow -crf 19 -pix_fmt yuv420p -c:a aac -b:a 192k \
  -shortest -movflags +faststart output/motion.mp4
echo "done: $(pwd)/output/motion.mp4"
