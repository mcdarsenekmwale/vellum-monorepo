from playwright.sync_api import sync_playwright
import re, os, json
OUT='apps/mobile-app/tests/test-output/dbg'
os.makedirs(OUT, exist_ok=True)

APP = 'http://localhost:19006'
API = 'http://localhost:3001'
USER = 'user1@example.com'
PSWD = 'user1@example.com'

with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    ctx = b.new_context(viewport={'width':400,'height':820}, device_scale_factor=2, locale='en-US', color_scheme='light')
    page = ctx.new_page()
    page.goto(f'{APP}/', wait_until='domcontentloaded')
    page.wait_for_timeout(2500)

    AUTH_SCRIPT = """async (payload) => {
      try {
        const r = await fetch('%s/api/auth/login', {
          method: 'POST',
          headers: {'Content-Type': 'application/json', 'accept': 'application/json'},
          body: JSON.stringify(payload),
          credentials: 'include',
        });
        const d = await r.json().catch(() => ({}));
        window.__authResult = { status: r.status, body: d };
        if (d.accessToken) {
          localStorage.setItem('accessToken', d.accessToken);
          localStorage.setItem('refreshToken', d.refreshToken || '');
          localStorage.setItem('vellum.auth.user', JSON.stringify(d.user || {}));
        }
      } catch (e) {
        window.__authResult = { err: String(e) };
      }
    }""" % API
    page.evaluate(AUTH_SCRIPT, {'email': USER, 'password': PSWD})
    page.wait_for_timeout(1000)

    try:
        page.fill('input[type="text"], input[placeholder*="email" i], input[name="email" i]', USER)
        page.fill('input[type="password"], input[placeholder*="password" i]', PSWD)
        try:
            page.locator('text=/Sign In/').first.click(timeout=4000)
        except Exception:
            page.get_by_role('button').filter(has_text=re.compile('Sign|Continue|Log')).first.click(timeout=5000)
    except Exception as e:
        print('ui fill fail:', e)
    page.wait_for_timeout(3000)
    page.evaluate("async () => { const r = (window).__router; if(r){ try{ await r.replace('/settings');}catch(e){} } }")
    page.wait_for_timeout(2500)

    texts = page.evaluate("""() => {
        const out = [];
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, { acceptNode: (n) => {
            if (!n.nodeValue || !n.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
            const parent = n.parentElement;
            if (!parent) return NodeFilter.FILTER_REJECT;
            const r = parent.getBoundingClientRect();
            if (r.width === 0 || r.height === 0 || r.top < -10 || r.bottom > window.innerHeight+10) return NodeFilter.FILTER_REJECT;
            return NodeFilter.FILTER_ACCEPT;
        }});
        let n; let i = 0;
        while ((n = walker.nextNode()) && i < 200) { out.push(n.nodeValue.trim()); i++; }
        return out;
    }""")
    print('-- /settings visible texts (viewport) --')
    for t in texts: print('  *', repr(t))

    bg_info = page.evaluate("""() => {
        const out = [];
        const els = [
          ['html', document.documentElement],
          ['body', document.body],
          ['#root', document.getElementById('root')],
        ];
        for (const [name, el] of els) {
            if (!el) { out.push([name, null, null]); continue; }
            const cs = getComputedStyle(el);
            out.push([name, cs.backgroundColor, cs.color]);
        }
        const nodes = document.body.querySelectorAll('div');
        for (const el of Array.from(nodes)) {
            const r = el.getBoundingClientRect();
            if (r.width < window.innerWidth*0.9 || r.height < window.innerHeight*0.7) continue;
            const cs = getComputedStyle(el);
            const bg = cs.backgroundColor || '';
            if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') {
                out.push(['DEEP('+el.tagName+')', bg, cs.color]);
                break;
            }
        }
        return out;
    }""")
    print('-- colors default --')
    for row in bg_info: print(' ', row)

    try:
        ar = page.locator('text=/Appearance|Apparence/i').first
        box = ar.bounding_box()
        page.mouse.click(box['x']+box['width']/2, box['y']+box['height']/2)
        page.wait_for_timeout(1700)
    except Exception as e:
        print('open appearance fail', e)

    sheet_texts = page.evaluate("""() => {
        const matches = [];
        function walk(el, depth=0) {
            if (depth > 20) return;
            const txt = ((el.innerText || '') + '').replace(/\\s+/g,' ').trim();
            if (txt && txt.length < 200) {
                if (/Light|Dark|System/.test(txt)) {
                    matches.push([el.tagName, typeof el.className==='string' ? el.className.slice(0,50) : '', txt]);
                }
            }
            for (const c of el.children || []) walk(c, depth+1);
        }
        walk(document.body);
        return matches.slice(0,30);
    }""")
    print('-- appearance sheet texts --')
    for s in sheet_texts[:15]: print(' ', s)

    try:
        page.locator('text=/^Light$/').first.click(timeout=2000)
        page.wait_for_timeout(1700)
    except Exception as e:
        print('light click fail', e)
    print('-- colors after Light --')
    for row in page.evaluate("""() => {
        const out = [];
        const els = [['html',document.documentElement],['body',document.body],['#root',document.getElementById('root')]];
        for (const [name, el] of els) {
            if (!el) { out.push([name,null,null]); continue; }
            const cs = getComputedStyle(el);
            out.push([name, cs.backgroundColor, cs.color]);
        }
        return out;
    }"""): print(' ', row)

    try:
        ar2 = page.locator('text=/Appearance|Apparence/i').first
        bx2 = ar2.bounding_box()
        page.mouse.click(bx2['x']+bx2['width']/2, bx2['y']+bx2['height']/2)
        page.wait_for_timeout(1700)
        page.locator('text=/^Dark$/').first.click(timeout=2000)
        page.wait_for_timeout(2200)
    except Exception as e:
        print('dark set fail', e)

    print('-- colors after Dark --')
    for row in page.evaluate("""() => {
        const out = [];
        const els = [['html',document.documentElement],['body',document.body],['#root',document.getElementById('root')]];
        for (const [name, el] of els) {
            if (!el) { out.push([name,null,null]); continue; }
            const cs = getComputedStyle(el);
            out.push([name, cs.backgroundColor, cs.color]);
        }
        const nodes = Array.from(document.body.querySelectorAll('div,section,article,main,aside'));
        let added = 0;
        for (const el of nodes) {
            const r = el.getBoundingClientRect();
            if (r.width < window.innerWidth*0.85 || r.height < window.innerHeight*0.6) continue;
            const cs = getComputedStyle(el);
            const bg = cs.backgroundColor || '';
            if (!bg || bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent') continue;
            const m = bg.match(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)/);
            if (!m) continue;
            const lum = (0.299*parseInt(m[1])+0.587*parseInt(m[2])+0.114*parseInt(m[3]))/255;
            out.push(['DEEP-CANDIDATE L='+lum.toFixed(2), bg, cs.color]);
            added += 1;
            if (added >= 5) break;
        }
        out.push(['html.dataset.theme', document.documentElement.getAttribute('data-theme'), '-'])
        out.push(['body.dataset.theme', document.body.getAttribute('data-theme'), '-'])
        out.push(['html.class', document.documentElement.className, '-'])
        return out;
    }"""): print(' ', row)

    # 6) Return to /settings, scroll and gather all rendered texts
    page.evaluate("async () => { const r = (window).__router; if(r){ try{ await r.replace('/settings');}catch(e){} } }")
    page.wait_for_timeout(2500)

    def collect_texts():
        return page.evaluate("""() => {
            const set = new Set();
            const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, { acceptNode: (n) => {
                if (!n.nodeValue || !n.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
                const parent = n.parentElement;
                if (!parent) return NodeFilter.FILTER_REJECT;
                const r = parent.getBoundingClientRect();
                if (r.width === 0 || r.height === 0) return NodeFilter.FILTER_REJECT;
                return NodeFilter.FILTER_ACCEPT;
            }});
            let n; let i = 0;
            while ((n = walker.nextNode()) && i < 500) {
                const s = (n.nodeValue || '').trim();
                if (s && s.length <= 120) set.add(s);
                i++;
            }
            return Array.from(set);
        }""")

    all_seen = set()
    for i_scroll in range(4):
        for t in collect_texts(): all_seen.add(t)
        page.mouse.wheel(0, 700)
        page.wait_for_timeout(500)

    print('-- /settings ALL texts (rendered, after scrolling) --')
    for t in sorted(all_seen, key=lambda x: (len(x), x.lower())): print('  -', repr(t))

    page.screenshot(path=f'{OUT}/settings_full.png', full_page=True)
    print('saved', f'{OUT}/settings_full.png')
    b.close()
