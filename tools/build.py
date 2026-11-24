#!/usr/bin/env python3
"""
HR System — بيبني index.html بتاع تطبيق الموبايل من ملفات Apps Script.

  python3 tools/build.py

بياخد apps-script/HTML/WebApp.html ويحط جواه Shared/Panes/HomeCards، ويحط ثابت K من 00_Config.gs،
ويضيف api.js (بديل google.script.run) + الـ manifest + الأيقونات.
أي تعديل في الواجهة: عدّل ملفات apps-script/HTML وبعدين شغّل السكريبت ده وارفع index.html.
"""
import re, json, pathlib, sys
ROOT = pathlib.Path(__file__).resolve().parent.parent
HTML = ROOT / 'apps-script' / 'HTML'
CODE = ROOT / 'apps-script' / 'Code'

def read(p): return p.read_text(encoding='utf-8')

def k_constant():
    src = read(CODE / '00_Config.gs')
    m = re.search(r'const K = Object\.freeze\(\{(.*?)\}\);', src, re.S)
    if not m: sys.exit('❌ مش لاقي const K في 00_Config.gs')
    return dict(re.findall(r"(\w+):\s*'([^']*)'", m.group(1)))

def build():
    page = read(HTML / 'WebApp.html')
    head = ('<link rel="manifest" href="manifest.webmanifest">\n'
            '<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">\n'
            '<link rel="icon" type="image/png" href="icons/favicon-32.png">\n'
            '<meta name="mobile-web-app-capable" content="yes">\n'
            '<meta name="apple-mobile-web-app-title" content="HR System">\n'
            '<script>var K = ' + json.dumps(k_constant(), ensure_ascii=False) + ';</script>\n'
            '<script src="api.js"></script>')
    k_line = "<script>var K = <?!= JSON.stringify(K) ?>;</script>"
    if k_line not in page: sys.exit('❌ سطر K مش موجود في WebApp.html')
    page = page.replace(k_line, head)
    page = re.sub(r'<link rel="icon" href="data:[^"]*">\n?', '', page)
    for name in ('Shared', 'Panes', 'HomeCards'):
        tag = "<?!= include('%s'); ?>" % name
        if tag not in page: sys.exit('❌ مش لاقي ' + tag)
        page = page.replace(tag, read(HTML / (name + '.html')))
    if '<?' in page: sys.exit('❌ فيه scriptlet لسه موجود في الصفحة')
    page = page.replace('<!DOCTYPE html>', '<!DOCTYPE html>\n<!-- ⚠️ ملف متولّد — ماتعدّلوش هنا. عدّل apps-script/HTML وشغّل: python3 tools/build.py -->', 1)
    (ROOT / 'index.html').write_text(page, encoding='utf-8')
    print('✅ index.html (%d KB)' % (len(page.encode('utf-8')) // 1024))

if __name__ == '__main__':
    build()
