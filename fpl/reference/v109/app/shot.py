import asyncio, sys
from playwright.async_api import async_playwright
TARGET = sys.argv[1] if len(sys.argv) > 1 else "file:///mnt/user-data/outputs/fpl-mission-control.html"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); errors=[]
        for scheme in ("light","dark"):
            ctx = await b.new_context(viewport={"width":390,"height":844}, device_scale_factor=2, color_scheme=scheme)
            pg = await ctx.new_page(); pg.on("pageerror", lambda e: errors.append("pageerror:"+str(e))); pg.on("console", lambda m: errors.append("console:"+m.text) if m.type=="error" and "ERR_FAILED" not in m.text else None)
            await pg.route("**/fonts.googleapis.com/**", lambda r: r.abort()); await pg.route("**/fonts.gstatic.com/**", lambda r: r.abort())
            await pg.goto(TARGET); await pg.wait_for_timeout(700)
            for t in (["today","classic","draft","leagues","fixtures","players","odds","review","lab"] if scheme=="light" else ["today","classic"]):
                await pg.click(f'button.tab[data-v="{t}"]'); await pg.wait_for_timeout(200)
                w = await pg.evaluate("document.documentElement.scrollWidth")
                if w>392: errors.append(f"horizontal overflow on {t}: {w}px")
                if t in ("today","classic","draft"): await pg.screenshot(path=f"/home/claude/app/shot_{scheme}_{t}.png")
            if scheme=="light":
                await pg.click('button.tab[data-v="classic"]'); await pg.wait_for_timeout(200)
                el = await pg.query_selector("text=Points-maximising plan")
                if el: await el.scroll_into_view_if_needed(); await pg.wait_for_timeout(150); await pg.screenshot(path="/home/claude/app/shot_light_plan.png")
                await pg.click('button.tab[data-v="draft"]'); await pg.wait_for_timeout(200)
                el = await pg.query_selector("text=Claims to lodge")
                if el: await el.scroll_into_view_if_needed(); await pg.wait_for_timeout(150); await pg.screenshot(path="/home/claude/app/shot_light_claims.png")
                # press the on-device buttons and make sure nothing throws
                await pg.click('button.tab[data-v="lab"]'); await pg.wait_for_timeout(200)
                btn = await pg.query_selector('button[data-act="run"][data-v="tests"]')
                if btn: await btn.click(); await pg.wait_for_timeout(4000); txt = await pg.inner_text("main"); errors += [] if "of 217 checks pass" in txt or "checks pass" in txt else ["self-test text missing"]
            await ctx.close()
        await b.close(); print("errors:", errors if errors else "none")
asyncio.run(main())
