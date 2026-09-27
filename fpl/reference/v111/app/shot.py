import asyncio, glob, os, sys
from playwright.async_api import async_playwright

# A sandbox often ships browsers under PLAYWRIGHT_BROWSERS_PATH whose build number does not match the
# installed playwright package, and the default launch then asks for a download that is not allowed.
# Fall back to whatever chromium is actually on disk rather than skipping the render.
async def launch(p):
    try:
        return await p.chromium.launch()
    except Exception as e:
        root = os.environ.get("PLAYWRIGHT_BROWSERS_PATH") or "/opt/pw-browsers"
        cands = [os.path.join(root, "chromium")] + sorted(glob.glob(os.path.join(root, "chromium-*", "chrome-linux", "chrome")), reverse=True)
        for c in cands:
            if os.path.exists(c):
                print("chromium from " + c)
                return await p.chromium.launch(executable_path=c)
        raise e
TARGET = sys.argv[1] if len(sys.argv) > 1 else "file:///mnt/user-data/outputs/fpl-mission-control.html"
async def main():
    async with async_playwright() as p:
        b = await launch(p); errors=[]
        for scheme in ("light","dark"):
            ctx = await b.new_context(viewport={"width":390,"height":844}, device_scale_factor=3, color_scheme=scheme)
            pg = await ctx.new_page(); pg.on("pageerror", lambda e: errors.append("pageerror:"+str(e))); pg.on("console", lambda m: errors.append("console:"+m.text) if m.type=="error" and "ERR_FAILED" not in m.text else None)
            await pg.route("**/fonts.googleapis.com/**", lambda r: r.abort()); await pg.route("**/fonts.gstatic.com/**", lambda r: r.abort())
            await pg.goto(TARGET); await pg.wait_for_selector("main .board", timeout=10000)
            boot = await pg.evaluate("performance.now()")
            if boot > 2500: errors.append(f"slow start in {scheme}: {boot:.0f} ms")
            print(f"{scheme}: interactive in {boot:.0f} ms")
            if scheme == "light":
                todo = await pg.query_selector('button.todo')
                if todo:
                    await todo.click(); await pg.wait_for_timeout(150)
                    on = await pg.evaluate("document.querySelector('button.todo') && document.querySelector('button.todo').getAttribute('aria-pressed')")
                    if on != "true": errors.append("checklist tick did not register")
                    await pg.click('button.todo'); await pg.wait_for_timeout(100)
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
