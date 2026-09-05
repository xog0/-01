#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""يبني نسخة من الموقع في ملف HTML واحد، بالصور مدمجة بداخله.

الفائدة: ملف واحد يُفتح بالنقر المزدوج في أي جهاز دون الحاجة إلى مجلد assets.
للنشر على الإنترنت استعمل index.html مع مجلد assets — أسرع وأفضل لمحركات البحث.

    python3 tools/build-single-file.py
"""
import base64, mimetypes, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "index.html")
OUT = os.path.join(ROOT, "jamana-website.html")

def main():
    with open(SRC, encoding="utf-8") as f:
        html = f.read()

    missing = []
    def embed(m):
        rel = m.group(1)
        path = os.path.join(ROOT, rel)
        if not os.path.exists(path):
            missing.append(rel)
            return m.group(0)
        mime = mimetypes.guess_type(path)[0] or "application/octet-stream"
        with open(path, "rb") as fh:
            data = base64.b64encode(fh.read()).decode()
        return 'src="data:%s;base64,%s"' % (mime, data)

    html, n = re.subn(r'src="(assets/[^"]+)"', embed, html)

    with open(OUT, "w", encoding="utf-8") as f:
        f.write(html)

    print("صور مدمجة: %d" % n)
    print("الحجم: %d كيلوبايت" % (os.path.getsize(OUT) // 1024))
    print("الملف: %s" % OUT)
    if missing:
        print("تحذير — ملفات مفقودة: %s" % ", ".join(missing), file=sys.stderr)
        return 1
    return 0

if __name__ == "__main__":
    sys.exit(main())
