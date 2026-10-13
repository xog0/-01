# فيديو: 3 حاجات تغيّر يومك (30 ثانية · عمودي 9:16 · تعليق صوتي بالمصري)

- `scenes.json`: نص التعليق الصوتي والنص الظاهر على الشاشة لكل مشهد.
- `render_scenes.js`: يرسم المشاهد كصور 1080x1920 (خط Cairo).
- `build.py`: يولّد الصوت (صوت رجل مصري `ar-EG-ShakirNeural`) ويركّب الفيديو.

## التشغيل
```bash
pip install edge-tts            # ومعاه ffmpeg و node و playwright
python3 build.py                # -> output/video.mp4 (بالصوت)
python3 build.py --no-voice     # -> output/preview_no_voice.mp4 (معاينة بدون صوت)
```
