#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
يبني نسخة الملف الواحد من ملفات المشروع.
شغّله بعد أي تعديل حتى تبقى النسختان متطابقتين:

    python3 build-single-file.py
"""
import io, os

CSS = 'assets/css/style.css'
JS = ['assets/js/config.js', 'assets/js/menu-data.js',
      'assets/js/i18n.js', 'assets/js/app.js']
OUT = '3asyakh-single-file.html'

BANNER = """<!--
  ============================================================
  موقع ٣ أسياخ — ملف واحد مستقل
  افتح هذا الملف بأي متصفح مباشرة، أو ارفعه لأي استضافة كما هو.

  أين تعدّل؟ اضغط Ctrl+F وابحث عن:
    SITE_CONFIG   → اسم المطعم، الهاتف، الواتساب، العنوان، الدوام، السوشيال
    MENU_DATA     → الأصناف والأسعار
    TESTIMONIALS  → آراء العملاء (فارغة الآن)
    :root         → الألوان

  هذا الملف مُولَّد — لا تعدّله إن كنت تعدّل ملفات المشروع،
  بل شغّل: python3 build-single-file.py
  ============================================================
-->
"""


def read(path):
    return io.open(path, encoding='utf-8').read()


def main():
    html = read('index.html')
    css = read(CSS)
    js = "\n\n".join(read(f) for f in JS)

    # وسم إغلاق داخل المحتوى المضمّن يكسر الصفحة
    if '</style>' in css.lower() or '</script>' in js.lower():
        raise SystemExit('closing tag found inside inlined asset')

    link = '<link rel="stylesheet" href="%s">' % CSS
    scripts = "\n".join('<script src="%s"></script>' % f for f in JS)
    for needle in (link, scripts):
        if needle not in html:
            raise SystemExit('not found in index.html: %s' % needle[:60])

    html = html.replace(link, '<style>\n' + css + '\n</style>')
    html = html.replace(scripts, '<script>\n' + js + '\n</script>')
    html = html.replace('<!DOCTYPE html>', '<!DOCTYPE html>\n' + BANNER, 1)

    io.open(OUT, 'w', encoding='utf-8').write(html)
    print('%s  (%.1f KB)' % (OUT, os.path.getsize(OUT) / 1024.0))


if __name__ == '__main__':
    main()
