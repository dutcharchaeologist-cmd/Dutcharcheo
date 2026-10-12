#!/usr/bin/env python3
"""Synthetische RepostHQ-achtige exports (het echte bestand was niet beschikbaar).
Onderwerpen krijgen bewust verschillende view-niveaus, zodat de analyse iets te vinden heeft."""
import random, datetime, csv, pathlib
from openpyxl import Workbook
random.seed(7)
OUT = pathlib.Path(__file__).parent / 'fixtures'
TOPICS = [  # (hook-sjabloon, gemiddelde views, RPM in $)
 ("The Afsluitdijk was closed in {y}, turning the Zuiderzee into a lake behind a 32 km dam.", 90000, 0.30),
 ("Dutch engineers built the Delta Works after the flood of {y}, the largest storm surge barrier system.", 85000, 0.28),
 ("Why the Dutch never close their curtains: a tradition older than {y}.", 80000, 0.25),
 ("In {y}, the Dutch owned more bicycles than people, a cycling culture unlike anywhere else.", 75000, 0.22),
 ("The murder of the De Witt brothers in {y} shocked the Republic.", 60000, 0.35),
 ("During the Hunger Winter of {y}, the Nazi occupation left millions without food.", 55000, 0.40),
 ("The resistance hid thousands of Jewish children during the occupation in {y}.", 52000, 0.38),
 ("William of Orange was assassinated in Delft in {y}, the first head of state killed by a handgun.", 50000, 0.30),
 ("Roman soldiers built the Limes along the Rhine around {y} AD.", 45000, 0.26),
 ("Medieval castle toilets in {y} were simply holes in the outer wall.", 47000, 0.27),
 ("Stroopwafels were first made in Gouda around {y} from bakery leftovers.", 40000, 0.20),
 ("The VOC ship Batavia was wrecked in {y}, followed by a mutiny and massacre.", 35000, 0.24),
 ("Antonie van Leeuwenhoek saw bacteria through his microscope in {y}.", 30000, 0.18),
 ("Dutch slavery in Suriname was only abolished in {y}.", 25000, 0.15),
 ("Archaeologists excavated a Roman coin hoard near Nijmegen in {y}.", 58000, 0.33),
 ("Rembrandt painted The Night Watch in {y}.", 42000, 0.21),
]
FILL = ("Most people have never heard the full story. Historians still debate the details, but the records "
        "tell a remarkable tale of ordinary people facing extraordinary times. ")
def rows(n=1250):
    start = datetime.datetime(2024, 1, 1, 8, 0)
    out = []
    for i in range(n):
        hook, mu, rpm = random.choice(TOPICS)
        y = random.randint(1100, 1960) if '{y} AD' not in hook else random.randint(40, 300)
        text = hook.format(y=y) + "\n\n" + FILL * random.randint(2, 6) + "\n#history #netherlands"
        views = int(max(300, random.lognormvariate(0, 0.8) * mu))
        rev = round(views / 1000 * rpm * random.uniform(.6, 1.4), 2) if random.random() > .08 else None
        reac = int(views * random.uniform(.01, .03)); com = int(views * random.uniform(.001, .004))
        sh = int(views * random.uniform(.001, .006) * (2 if 'Hunger' in hook or 'curtains' in hook else 1))
        d = start + datetime.timedelta(hours=i * 7)
        out.append(dict(id=f"1000{i:05d}", date=d, text=text, type=random.choice(['Photo', 'Photo', 'Photo', 'Link', 'Video']),
                        views=views, reac=reac, com=com, sh=sh, rep=int(sh * .2), rev=rev,
                        link=f"https://www.facebook.com/thedutcharchaeologist/posts/{1000+i}"))
    return out
R = rows()
# A: RepostHQ-achtig, samenvattingsblad eerst
wb = Workbook(); ws = wb.active; ws.title = 'Summary'
ws.append(['RepostHQ export']); ws.append(['Total posts', len(R)]); ws.append(['Total earnings', sum(r['rev'] or 0 for r in R)])
ws2 = wb.create_sheet('Posts')
ws2.append(['Post ID', 'Date', 'Message', 'Type', 'Views', 'Reactions', 'Comments', 'Shares', 'Reposts', 'Earnings (USD)', 'Permalink'])
for r in R: ws2.append([r['id'], r['date'], r['text'], r['type'], r['views'], r['reac'], r['com'], r['sh'], r['rep'], r['rev'], r['link']])
wb.save(OUT / 'A_reposthq_style.xlsx')
# B: Meta-stijl, kopregel op rij 3, Title + Description, gecombineerde kolom
wb = Workbook(); ws = wb.active; ws.title = 'Export'
ws.append(['TDA_RepostHQ_alle_posts']); ws.append(['Gegenereerd 2026-10-07'])
ws.append(['Post ID', 'Page name', 'Title', 'Description', 'Publish time', 'Post type', 'Permalink', 'Reach',
           'Reactions, Comments and Shares', 'Views', 'Reactions', 'Comments', 'Shares', 'Approximate content monetization earnings'])
for r in R: ws.append([r['id'], 'The Dutch Archaeologist', '', r['text'], r['date'], r['type'], r['link'], int(r['views'] * .7),
                       r['reac'] + r['com'] + r['sh'], r['views'], r['reac'], r['com'], r['sh'], r['rev']])
wb.save(OUT / 'B_meta_style_header_row3.xlsx')
# C: Nederlandse CSV met puntkomma, euro, 1,2K-notatie
def nlnum(n): return f"{n:,}".replace(',', '.')
with open(OUT / 'C_nederlands_puntkomma.csv', 'w', encoding='utf-8-sig', newline='') as f:
    w = csv.writer(f, delimiter=';')
    w.writerow(['Datum', 'Berichttekst', 'Weergaven', 'Vind-ik-leuks', 'Reacties', 'Keer gedeeld', 'Inkomsten'])
    for i, r in enumerate(R):
        v = r['views']; vs = (f"{v/1000:.1f}K".replace('.', ',') if i % 5 == 0 and v > 10000 else nlnum(v))
        w.writerow([r['date'].strftime('%d-%m-%Y %H:%M'), r['text'], vs, r['reac'], r['com'], r['sh'],
                    '' if r['rev'] is None else ('€ ' + f"{r['rev']:,.2f}".replace(',', 'X').replace('.', ',').replace('X', '.'))])
# D: onherkenbare kolomnamen -> handmatige koppeling
with open(OUT / 'D_onbekende_kolommen.csv', 'w', encoding='utf-8', newline='') as f:
    w = csv.writer(f)
    w.writerow(['Kol1', 'Kol2', 'Kol3', 'Kol4'])
    for r in R[:300]: w.writerow([r['id'], r['text'], r['views'], r['rev'] or ''])
print('ok', len(R))
