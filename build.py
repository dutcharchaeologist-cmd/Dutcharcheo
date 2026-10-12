#!/usr/bin/env python3
"""Bouwt dist/history-content-engine-v5-3.html: één zelfstandig bestand.
Voegt src/perf.js en het TDA-logo (base64) in src/app.html in."""
import base64, pathlib
root = pathlib.Path(__file__).parent
html = (root / 'src/app.html').read_text(encoding='utf-8')
perf = (root / 'src/perf.js').read_text(encoding='utf-8')
logo = base64.b64encode((root / 'src/tda-logo.png').read_bytes()).decode()
assert html.count('/*__PERF_JS__*/') == 1 and html.count('__TDA_LOGO__') == 1
html = html.replace('/*__PERF_JS__*/', perf).replace('__TDA_LOGO__', 'data:image/png;base64,' + logo)
out = root / 'dist/history-content-engine-v5-3.html'
out.parent.mkdir(exist_ok=True)
out.write_text(html, encoding='utf-8')
print(out, len(html.encode()) // 1024, 'KB')
