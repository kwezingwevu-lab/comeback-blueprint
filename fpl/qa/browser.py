#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
qa/browser.py — E5, the phone-render suite.

WHAT IT MEASURES
    dist/index.html, served over http from a local server, in Playwright Chromium at
    390x844 with device_scale_factor 3 — 1170x2532 real pixels, which is what an iPhone
    renders — in prefers-color-scheme dark AND light, on every tab the tab strip offers,
    with every section and reveal expanded. Per tab per theme it proves:

      1. the root mounted and carries visible text (not an empty shell), no error boundary
      2. zero pageerror and zero console.error while that tab was on screen
      3. no element's box escapes the viewport unreachably, at 390 AND at 320
      4. the rendered pixels still match a committed perceptual signature
      5. the screenshot is exactly 1170x2532 real pixels
      6. first paint, before anything on the tab is pressed: under 500 visible words, with
         exactly the tab's PRIMARY section open (Part G)
      7. D7: no decorative chalk line crosses a text box, at 390 and again at 320 — and on
         Today once more on the long clock (see D7 below)

    Before the first tab, in each scheme, it measures the landing card in simple mode (under
    110 visible words, at most 4 panels, Part G) and proves the strip it is about to walk is
    the source's TABS, entry for entry. TABS and PRIMARY are read out of the assembled
    app/FPL_Mission_Control.jsx at runtime, so neither a tab count nor a section id is
    written down here. On the Today tab it proves D7's fixture-row rule (below).

    It also presses the app's own check report and asserts what it says, and it proves the
    dark and light renders are identical — the viewport grid AND the full-page histogram, and
    the landing card's words — which is the assertion the graphics audit asked for (light mode
    is not implemented; this is the tripwire that stops one landing silently).

D7, THE TWO PHONE RULES, AND HOW EACH IS MEASURED (v110 §5 D7)
    Fixture rows stay on one line and show a weekday and a time. A row is `.fxrow`, the class
    the kit's Today board uses (the kit's ui.js vToday). For every visible row on Today:
      (a) its content height — the border box less vertical padding and borders, because
          padding is not a line — is under 1.7 x the tallest line-height of the row and of its
          text-bearing descendants;
      (b) its text boxes, grouped by vertical overlap, form exactly one line. (a) alone can be
          fooled: when a larger team label sets the row's line-height, a list of player dots
          wrapped onto two short lines still measures under 1.7. (b) cannot be;
      (c) its text carries a weekday and an HH:MM time;
      (d) that weekday and time are the kick-off in SAST (UTC+2), matched by home v away
          against data/mc_data.json's fixtures, which are read at runtime.
    The gate is at 390; the 320 numbers are printed as a measurement. When no `.fxrow`
    renders, the check is SKIPPED with a printed reason — but only when no fixture-like list
    renders either (three or more siblings whose text starts "ABC v XYZ"). A list under any
    other class is a FAIL that names the class, never a silent skip.

    Decorative chalk lines never cross text. They are found two ways: by class
    (DECOR_CLASS_SEL), and as every ::before/::after inside .mc-root whose content is the empty
    string and which paints a border or a background. The kit draws its chalk that way (its
    styles.css .board:before/:after, the deadline board's two circles, and .pitch:before/:after),
    and a pseudo-element cannot be selected by a class. Its box is computed from its containing
    block's padding box and its resolved left/top/width/height, content-box unless it says
    otherwise (a `*` rule does not match a pseudo-element), then clipped by every overflow
    ancestor from the containing block up. The gate is that box: it may intersect no text
    node's client rect (Range.getClientRects, so a wrapped paragraph is its lines, not its
    bounding box). For a circle the detail also says whether the stroke itself crosses the text,
    so a red reads without a screenshot. A decorative pseudo-element that is not absolutely
    positioned has no measurable box and is a FAIL, not a skip. With no decorative line on a
    tab there is nothing to assert there; with none on any tab, the check is SKIPPED with a
    printed reason.

    The long clock. The widest text beside the kit's circle is the deadline countdown, and the
    suite's pinned clock (26 h out) shows it at its SHORTEST. So Today is rendered once more,
    both schemes, at 390 and 320, with the clock pinned one minute after the previous deadline
    (long_clock(), derived from data/live.json), where the countdown is at its longest.
    Measured on a kit-faithful page, not in the app: at 390 the kit's big circle clears
    "1d 2h 0m" (text right edge 219.4 against a circle box starting at 252) and crosses every
    reading with a two-digit hour and a two-digit minute ("1d 23h 59m", "3d 12h 30m": 267.9)
    — roughly half the hours of any gameweek, which the pinned clock alone would never show
    (ERRORS.md E-120).

    Both rules are proven able to fail, and able to pass, on the kit's own board transplanted
    into this app from the kit's stylesheet with the snapshot's own fixtures. Measured 27 Sep
    2026 on the GW6 snapshot, Chromium, both schemes identical:
      --mutate kit-board        the faithful board. At 390 both rules RUN and hold: 10 rows,
                                content 0.999 x line-height, one line each, 10 of 10 kick-offs in
                                SAST; the chalk clear of text on all nine tabs. At 320 the big
                                circle's stroke crosses the countdown "1d 2h 0m" (red on every
                                tab), and on the long clock "21d 16h 29m" crosses it at 390 too.
                                Porting the kit's board verbatim therefore fails D7; the countdown
                                needs the circle's width kept clear (or the circle moved).
      --mutate fixture-wrap     one row squeezed: red, 2.085 x line-height, text on 2 lines.
      --mutate fixture-utc      kick-offs in UTC: red on all 10 rows, "the time shown is UTC".
      --mutate chalk-cross      kicker set right: red at 390, the stroke crosses "Gameweek 6
                                locks in".
      --mutate fixture-renamed  rows under .fxline: red, "fixture-like list: div.fxline x10",
                                never a skip.

    The Odds tab (D4) lists fixtures too, and they are held to the same rule where they are:
    its fixture line — kick-off, match and expected goals, three cells keyed by data-fx — is
    one line per cell and one line across the three, and the kick-off reads as the SAST weekday
    and time of that home v away. The row's second line (.mini: prices, clean sheets, source) is
    a declared secondary line and is not held to it. --mutate odds-wrap squeezes the match cells
    and must turn it red.

WHY THE OVERFLOW WALK IS AN ELEMENT WALK
    document.scrollWidth is a gate that cannot fail on this app. `.section{overflow:hidden}`
    (src/ui.jsx:70) clips its children, so the document's scrollWidth stays pinned at the
    viewport width while a child overflows. Measured on the Lab tab at 320x568: eleven
    `span.rt` cells reach x=339 against a 320px viewport, and
    document.documentElement.scrollWidth reads 320 — the same number it reads when nothing
    overflows at all. So this suite walks every element, takes each client rect, and compares
    its edges against the viewport.

    An element past the viewport edge is only a defect when the reader cannot get to it.
    `.tbl{overflow-x:auto}` (src/ui.jsx:117) is a declared horizontal scroller: at 320px the
    Lab model-tournament table measures clientWidth 274, scrollWidth 316, so those eleven
    cells are reachable by scrolling the table. The walk therefore subtracts the remaining
    horizontal scroll reach of every ANCESTOR scroll container from the overshoot, and only
    reports what is left. The document's own scrolling element is deliberately not counted
    as reach: a page that has to pan sideways on a phone is the defect, not the excuse.
    Every excused element is still printed, with its numbers, so an exemption cannot hide.

THE VISUAL REGRESSION GUARD, AND WHAT IT CANNOT DO
    PNGs cannot be committed here (the repository root ignores *.png; qa/shots/*.png is
    ignored on purpose), so the baseline is TEXT, inside this file, between the BASELINE
    markers. Two signatures per tab per theme, both computed from the real screenshot
    pixels by drawing the PNG into a canvas in a scratch page:

      G — a 6x12 grid of mean luminance (Rec.709 on sRGB bytes, one decimal) over the fixed
          1170x2532 viewport screenshot. 72 numbers.
      H — a 16-bin luminance histogram of the FULL-PAGE screenshot, as percentage of pixel
          area to two decimals. 16 numbers. Reflow-invariant by construction: it does not
          care where a pixel is, so it sees below the fold without being moved by a reflow.

    TOLERANCES, AND THE MEASUREMENTS THAT SET THEM. Every figure below was measured on this
    container (Chromium 141.0.7390.37 at /opt/pw-browsers/chromium) by running this suite
    against dist/index.html with one built-in mutation applied (--mutate, see MUTATIONS).
    G is reported as max / mean over the 72 cells; H as the largest single-bin difference in
    percentage points. The two columns are the worst value any tab produced.

                                                              G max / mean      H max
      nothing (two separate browser launches, same page)        0.0 / 0.00       0.00
      --mutate reflow   40 text nodes lengthened by ~14 chars  29.4 / 7.02       1.97
                        (the page grew 13%: 5874 -> 6663 px)
      --mutate drop-panel  the first card or section removed   38.0 / 8.31      21.89
      --mutate blank    the mounted root emptied               49.0 / 21.48     87.50
      --mutate invert   the palette tokens rewritten light    225.5 / 209.32    91.07

    G tolerance: mean |delta| <= 40.0 and max |delta| <= 90.0.
      mean 40.0 sits 5.7x above the worst legitimate content reflow measured (7.02) and 4.8x
      below the weakest theme inversion measured (191.51). max 90.0 sits 3.1x above the worst
      reflow (29.4) and 2.4x below the weakest inversion (220.3). Both thresholds fall inside
      an empty band between the two measured populations, which is why a text reflow cannot
      fire it and a theme inverting cannot escape it.

    H tolerance: max bin |delta| <= 4.5 percentage points.
      4.5 is the geometric midpoint of the empty band between the worst legitimate content
      reflow measured (1.97 pp) and the weakest real loss it has to catch (9.86 pp, the
      Command tab with its landing card removed): 2.3x above the one, 2.2x below the other,
      and 17x below the weakest theme inversion (77.48 pp). It is deliberately not tighter:
      at 3.0 pp the margin over a legitimate reflow was 1.5x, which is how a guard starts
      going red on the weekly snapshot instead of on a regression.

    WHAT THIS GUARD DOES NOT CATCH, stated plainly rather than implied: a single panel
    disappearing from BELOW THE FOLD on a long tab. Measured, --mutate drop-panel on the Lab
    tab moves G by 0.15 mean / 1.7 max and H by 0.60 pp — under every tolerance above, and
    under any tolerance that a legitimate reflow (1.97 pp, 7.02 mean) would also clear. It
    cannot be separated, and here is the second measurement that proves it rather than
    asserting it: a full-page spatial grid answers "three table rows added" with max 19.0 /
    mean 5.33 and "a whole panel removed" with max 19.0 / mean 7.50 — the populations
    overlap, so no threshold divides them. Rather than ship a tolerance inside that overlap
    and watch it go red every time a refreshed snapshot adds a row, this suite catches a
    panel disappearing where it is visible (G, above the fold: 8.31 mean against a 40.0
    allowance is under tolerance too, so it is H that fires there at 9.86-21.89 pp) and does
    not claim to catch one that is both small and far below the fold. The `mounts-with-visible-
    text` and error-boundary checks cover the case where a whole tab collapses.

    The baseline is NOT a frozen live-sourced value. It is a record of how the app paints,
    and the clock it paints against is pinned from the snapshot at runtime (below), not
    written down. A refreshed data/live.json changes the numbers on screen; measured, that
    moves G by at most 7.02 mean of a 40.0 allowance and H by at most 1.97 pp of a 4.5 pp
    allowance. A deliberate redesign is expected to move it, and `--write-baseline` re-records
    it in one step.

    ONE THING THE BASELINE IS NOT YET PROVEN TO BE: portable. It was recorded on this
    container, against its Chromium build and its installed fonts. A different machine with a
    different font stack changes glyph rasterisation and can change line heights, and nobody
    has measured how far that moves G and H. Every other check here is machine-independent —
    the mount, the error counts, the overflow walk, the screenshot dimensions, the self-check
    and the dark-versus-light comparison, which compares two renders from the same run and so
    needs no baseline at all. If the first run on another machine reds only the two
    "within-tolerance" checks, that is the calibration showing, not the app breaking: measure
    the delta, and either record a per-environment baseline or keep the two signature checks
    to the machine they were calibrated on. Do not widen the tolerance to make a strange
    machine pass; a tolerance wide enough to absorb a font change is wide enough to miss a
    theme inverting.

WHAT IS STUBBED, AND WHY. Nothing else is.
    1. navigator.serviceWorker.register — recorded on window.__SWCALLS__ and resolved locally.
       http://127.0.0.1 is a secure context, so the shipped page would really install sw.js,
       which would then cache the app and serve the NEXT run stale bytes, and a controlled
       page's requests bypass route interception. The recorded call is asserted, so the page
       still has to prove it tried.
    2. Every off-origin request is aborted by a route and counted. The suite presses nothing
       that should reach the network; the count is asserted to be zero, so the abort is the
       proof rather than a convenience.
    3. window.__NOW__ is pinned to 26 hours before the deadline of the snapshot's OWN is_next
       event, read out of data/live.json at runtime. Wall-clock time would move the countdown
       copy on every run and the signature baseline would become a clock — E-084's class. The
       one exception is D7's long-clock render of Today, pinned one minute after the previous
       deadline, also derived; it feeds the chalk check only, never a signature.

RUN
    python3 qa/browser.py                     the suite
    python3 qa/browser.py --write-baseline    re-record the baseline block in this file
    python3 qa/browser.py --mutate wide       inject a wide element (the overflow proof)
    python3 qa/browser.py --mutate invert     invert the palette (the signature proof)
    python3 qa/browser.py --mutate kit-board  the kit's Today board with its chalk (the D7 control)
    python3 qa/browser.py --list-mutations

    Output: PASS/FAIL per check with the measured value, then "SUITE browser <pass>/<total>".
    Exit 1 on any FAIL, and on a total of zero — a suite that asserted nothing is a failure,
    not a green line (E-052). A SKIP line names a D7 check that had nothing to measure and
    why; it is never counted as a pass, and the skips are listed again above the SUITE line.

REQUIREMENTS
    Python 3 with the playwright package, and Chromium at /opt/pw-browsers/chromium
    (PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers). It never shells out to an installer.
    dist/index.html must already be built; this suite never builds it.
"""

import argparse
import base64
import datetime
import functools
import http.server
import json
import os
import re
import socketserver
import subprocess
import sys
import threading

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
DIST = os.path.join(ROOT, "dist")
INDEX = os.path.join(DIST, "index.html")
SHOTS = os.path.join(HERE, "shots")
LIVE_JSON = os.path.join(ROOT, "data", "live.json")
MC_JSON = os.path.join(ROOT, "data", "mc_data.json")
APP_JSX = os.path.join(ROOT, "app", "FPL_Mission_Control.jsx")
CHROMIUM = "/opt/pw-browsers/chromium"

VIEW = {"width": 390, "height": 844}
NARROW = {"width": 320, "height": 568}
DSF = 3
GRID_COLS, GRID_ROWS = 6, 12
HIST_BINS = 16

# Tolerances. Every number here is justified by a measurement in the module docstring.
TOL_GRID_MEAN = 40.0
TOL_GRID_MAX = 90.0
TOL_HIST_MAX = 4.5
TOL_THEME_MAX = 1.0      # dark vs light, measured 0.0 on all nine tabs (27 Sep 2026)
TOL_THEME_HIST = 0.05    # dark vs light full-page histogram, pp; measured 0.00 on all nine tabs
EDGE_EPS = 0.5           # sub-pixel slack on a rect edge comparison
WORD_FLOOR = 40          # an empty shell is 0 words; the thinnest tab measured 322

# Part G gates. Rules of the interface, not observations of a snapshot (CLAUDE.md Part G).
LANDING_WORDS_GATE = 110     # visible words on the landing card, strictly under
LANDING_PANELS_GATE = 4      # panels on the landing card, at most
TAB_WORDS_GATE = 500         # visible words on a tab at first paint, strictly under

# D7 (v110 §5). The class the kit's Today board gives a fixture row, and the classes that mark
# a decorative line as a real element. Pseudo-element chalk is found without a class (see D7).
FIXTURE_ROW_SEL = ".fxrow"
DECOR_CLASS_SEL = '[class*="chalk"]'
FIXTURE_LINE_RATIO = 1.7     # a row's content height, in its own line-heights, strictly under
FIXTURE_TAB = "command"      # Today: the tab whose fixture list the rule names
ODDS_TAB = "odds"            # D4: the other tab that lists fixtures, by kick-off, one per line

# ---------------------------------------------------------------- BASELINE START
# Generated by `python3 qa/browser.py --write-baseline`. Text, because qa/shots/*.png is
# ignored by the repository root and a golden image cannot be committed here.
#   G <tab> <theme> <GRID_COLS*GRID_ROWS mean luminances, row-major, one decimal>
#   H <tab> <theme> <HIST_BINS area percentages of the full-page shot, two decimals>
BASELINE = r"""
G chips dark 40.7,40.7,41.7,35.7,38.9,39.7,27.4,33.4,23.7,23.7,23.7,27.8,28.7,32.7,33.7,33.7,33.5,30.0,31.5,32.4,32.7,32.7,32.6,26.7,21.4,23.6,20.7,20.7,20.7,18.8,24.7,24.4,23.7,28.7,30.7,27.6,22.7,23.7,23.7,23.7,27.7,24.4,24.4,25.4,25.4,24.4,24.4,25.7,37.9,43.5,42.5,42.8,43.5,31.6,30.6,36.6,33.5,28.8,29.7,24.7,29.7,36.5,37.5,35.7,30.7,25.6,32.4,39.5,40.5,40.5,39.5,26.6
H chips dark 14.68,67.92,12.27,0.43,0.31,0.25,0.46,0.30,0.36,0.57,1.60,0.11,0.05,0.06,0.62,0.00
G chips light 40.7,40.7,41.7,35.7,38.9,39.7,27.4,33.4,23.7,23.7,23.7,27.8,28.7,32.7,33.7,33.7,33.5,30.0,31.5,32.4,32.7,32.7,32.6,26.7,21.4,23.6,20.7,20.7,20.7,18.8,24.7,24.4,23.7,28.7,30.7,27.6,22.7,23.7,23.7,23.7,27.7,24.4,24.4,25.4,25.4,24.4,24.4,25.7,37.9,43.5,42.5,42.8,43.5,31.6,30.6,36.6,33.5,28.8,29.7,24.7,29.7,36.5,37.5,35.7,30.7,25.6,32.4,39.5,40.5,40.5,39.5,26.6
H chips light 14.68,67.92,12.27,0.43,0.31,0.25,0.46,0.30,0.36,0.57,1.60,0.11,0.05,0.06,0.62,0.00
G command dark 34.2,42.7,43.5,42.7,40.9,40.7,37.6,52.8,55.7,56.8,55.7,33.6,33.5,45.8,40.8,31.7,31.7,26.8,30.5,38.7,35.7,29.7,29.7,25.8,28.8,36.7,35.7,35.7,32.7,27.5,31.5,40.7,39.7,38.7,41.7,28.5,28.7,34.4,35.5,35.5,34.5,27.6,27.6,32.4,33.5,32.7,28.5,22.6,31.7,37.7,35.5,35.5,35.7,27.6,29.4,34.7,26.7,27.4,26.7,22.6,31.7,35.7,33.7,31.8,33.7,27.7,26.9,30.7,29.8,28.7,28.7,22.7
H command dark 10.67,67.56,14.95,0.51,0.35,0.42,0.39,0.29,0.41,0.43,0.93,0.27,0.19,0.33,2.31,0.00
G command light 34.2,42.7,43.5,42.7,40.9,40.7,37.6,52.8,55.7,56.8,55.7,33.6,33.5,45.8,40.8,31.7,31.7,26.8,30.5,38.7,35.7,29.7,29.7,25.8,28.8,36.7,35.7,35.7,32.7,27.5,31.5,40.7,39.7,38.7,41.7,28.5,28.7,34.4,35.5,35.5,34.5,27.6,27.6,32.4,33.5,32.7,28.5,22.6,31.7,37.7,35.5,35.5,35.7,27.6,29.4,34.7,26.7,27.4,26.7,22.6,31.7,35.7,33.7,31.8,33.7,27.7,26.9,30.7,29.8,28.7,28.7,22.7
H command light 10.67,67.56,14.95,0.51,0.35,0.42,0.39,0.29,0.41,0.43,0.93,0.27,0.19,0.33,2.31,0.00
G draft dark 40.7,41.7,37.7,37.5,39.9,39.9,25.6,35.4,24.7,25.4,31.5,23.6,24.6,31.7,26.3,24.7,30.5,23.6,25.5,34.7,25.7,25.4,29.4,23.3,26.6,36.4,26.7,25.7,33.4,24.3,26.7,38.7,31.4,29.7,32.7,25.6,22.7,28.5,26.7,23.7,26.2,23.6,24.7,35.5,28.4,23.7,28.5,25.4,25.4,35.5,26.7,23.7,27.7,24.7,23.7,31.4,25.7,23.7,26.7,23.7,23.6,30.4,25.7,24.4,26.7,23.7,24.6,32.5,25.7,23.7,27.5,24.6
H draft dark 9.62,76.57,8.78,0.40,0.30,0.25,0.35,0.34,0.52,0.53,1.51,0.18,0.05,0.06,0.53,0.00
G draft light 40.7,41.7,37.7,37.5,39.9,39.9,25.6,35.4,24.7,25.4,31.5,23.6,24.6,31.7,26.3,24.7,30.5,23.6,25.5,34.7,25.7,25.4,29.4,23.3,26.6,36.4,26.7,25.7,33.4,24.3,26.7,38.7,31.4,29.7,32.7,25.6,22.7,28.5,26.7,23.7,26.2,23.6,24.7,35.5,28.4,23.7,28.5,25.4,25.4,35.5,26.7,23.7,27.7,24.7,23.7,31.4,25.7,23.7,26.7,23.7,23.6,30.4,25.7,24.4,26.7,23.7,24.6,32.5,25.7,23.7,27.5,24.6
H draft light 9.62,76.57,8.78,0.40,0.30,0.25,0.35,0.34,0.52,0.53,1.51,0.18,0.05,0.06,0.53,0.00
G lab dark 41.7,42.7,41.6,40.7,41.4,34.9,26.6,24.4,24.4,26.4,35.7,30.6,27.4,33.4,26.4,23.7,23.7,27.6,28.7,34.5,26.4,32.4,34.7,24.7,31.6,36.7,23.7,34.7,38.7,28.1,26.6,29.7,23.7,27.7,29.7,24.9,24.6,23.7,25.7,23.7,23.7,23.7,27.7,27.4,29.4,24.7,23.7,24.7,28.7,27.7,28.7,25.4,23.7,25.7,27.4,30.4,28.7,25.7,24.4,24.7,26.6,27.7,24.7,26.7,27.4,24.7,26.7,23.7,23.7,23.7,29.5,23.7
H lab dark 11.18,74.64,8.69,0.36,0.29,0.24,0.34,0.31,0.43,0.51,1.42,0.89,0.06,0.06,0.58,0.00
G lab light 41.7,42.7,41.6,40.7,41.4,34.9,26.6,24.4,24.4,26.4,35.7,30.6,27.4,33.4,26.4,23.7,23.7,27.6,28.7,34.5,26.4,32.4,34.7,24.7,31.6,36.7,23.7,34.7,38.7,28.1,26.6,29.7,23.7,27.7,29.7,24.9,24.6,23.7,25.7,23.7,23.7,23.7,27.7,27.4,29.4,24.7,23.7,24.7,28.7,27.7,28.7,25.4,23.7,25.7,27.4,30.4,28.7,25.7,24.4,24.7,26.6,27.7,24.7,26.7,27.4,24.7,26.7,23.7,23.7,23.7,29.5,23.7
H lab light 11.18,74.64,8.69,0.36,0.29,0.24,0.34,0.31,0.43,0.51,1.42,0.89,0.06,0.06,0.58,0.00
G odds dark 41.7,42.7,42.7,40.6,28.2,39.7,28.7,37.7,33.7,32.4,31.7,25.6,26.7,34.5,32.4,27.7,27.4,24.7,27.4,34.5,32.7,25.7,25.7,23.6,28.6,37.5,35.5,25.4,25.7,21.6,26.7,33.7,31.7,25.7,24.7,24.8,30.1,39.4,37.7,27.7,27.7,24.6,28.7,33.4,27.7,24.7,24.7,22.6,29.4,33.7,26.7,23.7,23.7,21.6,28.4,32.7,26.7,23.7,23.7,21.6,26.7,30.7,25.7,23.7,23.7,21.6,27.6,35.7,31.4,24.6,24.7,21.8
H odds dark 12.74,78.63,3.32,0.40,0.30,0.27,0.40,0.31,0.53,0.63,1.66,0.04,0.07,0.07,0.63,0.00
G odds light 41.7,42.7,42.7,40.6,28.2,39.7,28.7,37.7,33.7,32.4,31.7,25.6,26.7,34.5,32.4,27.7,27.4,24.7,27.4,34.5,32.7,25.7,25.7,23.6,28.6,37.5,35.5,25.4,25.7,21.6,26.7,33.7,31.7,25.7,24.7,24.8,30.1,39.4,37.7,27.7,27.7,24.6,28.7,33.4,27.7,24.7,24.7,22.6,29.4,33.7,26.7,23.7,23.7,21.6,28.4,32.7,26.7,23.7,23.7,21.6,26.7,30.7,25.7,23.7,23.7,21.6,27.6,35.7,31.4,24.6,24.7,21.8
H odds light 12.74,78.63,3.32,0.40,0.30,0.27,0.40,0.31,0.53,0.63,1.66,0.04,0.07,0.07,0.63,0.00
G plan dark 38.7,41.4,41.6,43.7,43.7,42.7,29.7,34.6,31.5,31.7,31.4,24.9,29.6,35.7,23.6,22.6,22.6,21.6,28.7,32.7,29.7,23.7,23.7,29.9,25.7,24.7,23.7,23.7,23.7,28.7,22.7,25.4,24.4,23.7,23.7,23.9,23.6,23.7,24.4,24.4,23.7,22.6,24.7,25.2,26.7,27.5,23.7,24.8,23.7,25.9,26.7,29.9,24.4,24.9,24.9,29.2,30.2,31.7,28.4,25.1,30.9,39.5,39.5,32.7,33.5,24.6,27.6,32.7,30.7,29.7,28.7,24.6
H plan dark 8.99,71.33,14.63,0.39,0.32,0.25,0.33,0.32,0.42,0.52,1.47,0.22,0.07,0.07,0.67,0.00
G plan light 38.7,41.4,41.6,43.7,43.7,42.7,29.7,34.6,31.5,31.7,31.4,24.9,29.6,35.7,23.6,22.6,22.6,21.6,28.7,32.7,29.7,23.7,23.7,29.9,25.7,24.7,23.7,23.7,23.7,28.7,22.7,25.4,24.4,23.7,23.7,23.9,23.6,23.7,24.4,24.4,23.7,22.6,24.7,25.2,26.7,27.5,23.7,24.8,23.7,25.9,26.7,29.9,24.4,24.9,24.9,29.2,30.2,31.7,28.4,25.1,30.9,39.5,39.5,32.7,33.5,24.6,27.6,32.7,30.7,29.7,28.7,24.6
H plan light 8.99,71.33,14.63,0.39,0.32,0.25,0.33,0.32,0.42,0.52,1.47,0.22,0.07,0.07,0.67,0.00
G review dark 42.7,46.7,48.7,47.7,47.2,38.0,32.8,60.7,59.9,59.0,59.7,37.7,26.7,32.6,29.9,29.6,29.8,27.4,29.3,34.2,29.4,25.7,26.7,23.8,28.6,31.6,30.7,29.7,30.7,24.9,28.6,32.7,34.4,31.4,31.4,23.6,28.4,32.5,28.7,26.5,27.4,23.6,30.6,36.0,25.4,23.7,26.7,23.5,30.4,42.4,37.7,28.4,27.4,22.6,30.4,37.7,37.5,36.5,35.7,27.6,31.7,41.3,40.5,40.5,40.3,27.6,28.6,37.4,33.7,33.7,26.7,22.4
H review dark 11.82,61.89,19.78,0.46,0.36,0.31,0.49,0.36,0.52,0.54,1.24,0.16,0.15,0.20,1.74,0.00
G review light 42.7,46.7,48.7,47.7,47.2,38.0,32.8,60.7,59.9,59.0,59.7,37.7,26.7,32.6,29.9,29.6,29.8,27.4,29.3,34.2,29.4,25.7,26.7,23.8,28.6,31.6,30.7,29.7,30.7,24.9,28.6,32.7,34.4,31.4,31.4,23.6,28.4,32.5,28.7,26.5,27.4,23.6,30.6,36.0,25.4,23.7,26.7,23.5,30.4,42.4,37.7,28.4,27.4,22.6,30.4,37.7,37.5,36.5,35.7,27.6,31.7,41.3,40.5,40.5,40.3,27.6,28.6,37.4,33.7,33.7,26.7,22.4
H review light 11.82,61.89,19.78,0.46,0.36,0.31,0.49,0.36,0.52,0.54,1.24,0.16,0.15,0.20,1.74,0.00
G rivals dark 42.6,40.7,35.4,40.7,42.9,40.7,25.6,24.4,24.4,24.4,31.7,23.4,27.6,23.7,23.7,23.7,32.7,24.1,30.5,23.7,23.7,23.7,36.7,25.6,29.7,35.8,34.5,30.4,28.4,23.7,22.8,26.9,24.6,21.9,21.9,20.8,25.9,26.7,25.7,23.7,23.7,25.3,25.6,29.7,24.7,23.7,23.7,23.2,30.6,35.4,32.4,25.4,23.7,24.1,31.7,35.7,36.7,25.4,24.7,24.9,20.5,21.6,21.6,21.6,21.6,19.5,27.7,28.7,27.5,19.7,19.7,21.5
H rivals dark 14.76,75.78,5.91,0.23,0.17,0.16,0.35,0.17,0.27,0.26,0.58,0.14,0.10,0.11,1.01,0.00
G rivals light 42.6,40.7,35.4,40.7,42.9,40.7,25.6,24.4,24.4,24.4,31.7,23.4,27.6,23.7,23.7,23.7,32.7,24.1,30.5,23.7,23.7,23.7,36.7,25.6,29.7,35.8,34.5,30.4,28.4,23.7,22.8,26.9,24.6,21.9,21.9,20.8,25.9,26.7,25.7,23.7,23.7,25.3,25.6,29.7,24.7,23.7,23.7,23.2,30.6,35.4,32.4,25.4,23.7,24.1,31.7,35.7,36.7,25.4,24.7,24.9,20.5,21.6,21.6,21.6,21.6,19.5,27.7,28.7,27.5,19.7,19.7,21.5
H rivals light 14.76,75.78,5.91,0.23,0.17,0.16,0.35,0.17,0.27,0.26,0.58,0.14,0.10,0.11,1.01,0.00
G squad dark 41.7,31.9,42.3,42.6,39.6,39.7,27.9,28.5,23.7,23.7,23.4,25.6,32.4,34.5,27.7,26.2,23.7,27.6,26.7,28.7,26.7,26.2,24.1,23.1,31.6,37.7,27.4,23.7,23.7,27.7,27.7,33.5,32.7,32.5,29.4,23.9,24.9,27.7,22.6,22.6,22.6,21.5,28.4,32.7,31.4,23.7,23.7,21.9,26.9,24.7,24.7,23.7,23.7,23.3,29.7,32.7,31.4,25.4,24.7,22.8,20.5,23.6,21.8,21.6,21.6,19.5,28.6,30.7,23.7,23.7,29.9,25.6
H squad dark 15.67,75.42,4.92,0.31,0.21,0.18,0.46,0.20,0.32,0.38,1.01,0.12,0.06,0.07,0.69,0.00
G squad light 41.7,31.9,42.3,42.6,39.6,39.7,27.9,28.5,23.7,23.7,23.4,25.6,32.4,34.5,27.7,26.2,23.7,27.6,26.7,28.7,26.7,26.2,24.1,23.1,31.6,37.7,27.4,23.7,23.7,27.7,27.7,33.5,32.7,32.5,29.4,23.9,24.9,27.7,22.6,22.6,22.6,21.5,28.4,32.7,31.4,23.7,23.7,21.9,26.9,24.7,24.7,23.7,23.7,23.3,29.7,32.7,31.4,25.4,24.7,22.8,20.5,23.6,21.8,21.6,21.6,19.5,28.6,30.7,23.7,23.7,29.9,25.6
H squad light 15.67,75.42,4.92,0.31,0.21,0.18,0.46,0.20,0.32,0.38,1.01,0.12,0.06,0.07,0.69,0.00
"""
# ---------------------------------------------------------------- BASELINE END

# ---------------------------------------------------------------- counters


class Counters(object):
    def __init__(self):
        self.pas = 0
        self.fail = 0
        self.failures = []
        self.skips = []


C = Counters()


def assert_(name, cond, detail):
    """PASS/FAIL one check. The measured value is printed either way — a green line that
    does not say what it measured is not evidence."""
    label = str(name)
    d = "no detail given" if detail in (None, "") else str(detail)
    if cond:
        C.pas += 1
        print("PASS " + label + " — " + d, flush=True)
        return True
    C.fail += 1
    C.failures.append(label + " — " + d)
    print("FAIL " + label + " — " + d, flush=True)
    return False


def skip_(name, reason):
    """A check with nothing to measure. Printed with its reason and listed again at the end;
    never counted as a pass (a skip is not evidence) and never used when the thing IS there."""
    C.skips.append(str(name) + " — " + str(reason))
    print("SKIP " + str(name) + " — " + str(reason), flush=True)


def done(suite="browser"):
    total = C.pas + C.fail
    if total == 0:
        print("FAIL " + suite + " — the suite recorded no assertions at all (it threw or "
              "returned before its first check); 0/0 is not a pass", flush=True)
        print("SUITE " + suite + " 0/0", flush=True)
        sys.exit(1)
    if C.skips:
        print("", flush=True)
        for s in C.skips:
            print("  skipped: " + s, flush=True)
    if C.failures:
        print("", flush=True)
        for f in C.failures:
            print("  failed: " + f, flush=True)
    print("SUITE " + suite + " " + str(C.pas) + "/" + str(total), flush=True)
    sys.exit(1 if C.fail else 0)


# ---------------------------------------------------------------- the clock


def pinned_now():
    """26 hours before the deadline of the snapshot's own is_next event. Derived, never
    written down: a literal here would be E-084 again."""
    with open(LIVE_JSON, "r", encoding="utf-8") as fh:
        live = json.load(fh)
    events = live.get("events") or []
    if not events:
        raise RuntimeError("browser: data/live.json carries no events, so the clock cannot "
                           "be derived from the snapshot")
    nxt = [e for e in events if e.get("is_next")]
    ev = nxt[0] if nxt else events[-1]
    dl = datetime.datetime.fromisoformat(str(ev["deadline_time"]).replace("Z", "+00:00"))
    return (dl - datetime.timedelta(hours=26)).strftime("%Y-%m-%dT%H:%M:%SZ"), int(ev["id"])


# ---------------------------------------------------------------- the source's contract


def source_contract():
    """TABS ids and PRIMARY, read out of the assembled app that dist/index.html is built from.
    Returns (tabs, primary, problem); problem is None when both parsed."""
    try:
        with open(APP_JSX, "r", encoding="utf-8") as fh:
            src = fh.read()
    except OSError as e:
        return [], {}, "%s cannot be read (%s)" % (APP_JSX, e)
    m = re.search(r"\nconst TABS = \[(.*?)\n\];", src, re.S)
    p = re.search(r"\nconst PRIMARY = \{([^}]*)\};", src)
    if not m or not p:
        return [], {}, "no `const TABS = [` or `const PRIMARY = {` in %s" % os.path.relpath(APP_JSX, ROOT)
    tabs = re.findall(r'\{\s*id:\s*"([a-z0-9_-]+)"', m.group(1))
    primary = dict(re.findall(r'([a-z0-9_]+):\s*"([^"]+)"', p.group(1)))
    if not tabs or not primary:
        return tabs, primary, "TABS or PRIMARY parsed empty"
    return tabs, primary, None


def long_clock(event_id):
    """One minute after the deadline before the pinned event's: the moment the countdown to the
    next deadline is at its longest, so the countdown text is at its widest. The pinned clock
    (26h out) shows the shortest countdown of the cycle, which is how a chalk circle can clear
    the countdown in every test and cross it on most days of the week. None when the snapshot
    has no earlier deadline."""
    with open(LIVE_JSON, "r", encoding="utf-8") as fh:
        live = json.load(fh)
    evs = live.get("events") or []
    cur = [e for e in evs if int(e.get("id") or 0) == int(event_id)]
    if not cur:
        return None
    dl = datetime.datetime.fromisoformat(str(cur[0]["deadline_time"]).replace("Z", "+00:00"))
    prev = [datetime.datetime.fromisoformat(str(e["deadline_time"]).replace("Z", "+00:00"))
            for e in evs if e.get("deadline_time")]
    prev = [t for t in prev if t < dl]
    if not prev:
        return None
    return (max(prev) + datetime.timedelta(seconds=60)).strftime("%Y-%m-%dT%H:%M:%SZ")


def _sast(iso):
    """(weekday, HH:MM in SAST, HH:MM in UTC) for an ISO instant. SAST is UTC+2 all year."""
    t = datetime.datetime.fromisoformat(str(iso).replace("Z", "+00:00"))
    s = t + datetime.timedelta(hours=2)
    return s.strftime("%a"), s.strftime("%H:%M"), t.strftime("%H:%M")


def fixture_facts(event_id, now_iso):
    """Everything D7 needs from the snapshot, read at runtime: every fixture's SAST weekday and
    time keyed "HOME|AWAY" (a home v away pairing happens once a season), and the pinned event's
    own fixtures, deadline and countdown for the kit-board mutations. Nothing here is written
    down; a refreshed data/mc_data.json moves all of it."""
    with open(MC_JSON, "r", encoding="utf-8") as fh:
        mc = json.load(fh)
    with open(LIVE_JSON, "r", encoding="utf-8") as fh:
        live = json.load(fh)
    expect, rows = {}, []
    for f in mc.get("fixtures") or []:
        if not f.get("ko") or not f.get("h") or not f.get("a"):
            continue
        day, hm, utc = _sast(f["ko"])
        expect[f["h"] + "|" + f["a"]] = {"day": day, "time": hm, "utc": utc}
        if int(f.get("gw") or 0) == int(event_id):
            rows.append({"h": f["h"], "a": f["a"], "ko": f["ko"], "day": day, "time": hm, "utc": utc})
    rows.sort(key=lambda r: (r["ko"], r["h"]))
    ev = [e for e in (live.get("events") or []) if int(e.get("id") or 0) == int(event_id)]
    dl = ev[0]["deadline_time"] if ev else None
    left = ""
    if dl:
        ms = (datetime.datetime.fromisoformat(dl.replace("Z", "+00:00"))
              - datetime.datetime.fromisoformat(now_iso.replace("Z", "+00:00"))).total_seconds()
        m = max(0, int(ms // 60))
        d, h, mm = m // 1440, (m % 1440) // 60, m % 60
        left = (("%dd " % d) if d else "") + (("%dh " % h) if (d or h) else "") + ("%dm" % mm)
    dday, dhm, _u = _sast(dl) if dl else ("", "", "")
    return expect, {"gw": int(event_id), "rows": rows, "left": left,
                    "when": (dday + " " + dhm + " SAST") if dl else ""}


# ---------------------------------------------------------------- the server


class _Handler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


class _Server(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True


def serve(directory):
    """dist/index.html over http, not file://: the service-worker path needs an origin, and
    so does localStorage (an opaque origin throws and the app falls back silently)."""
    srv = _Server(("127.0.0.1", 0), functools.partial(_Handler, directory=directory))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv, "http://127.0.0.1:%d" % srv.server_address[1]


# ---------------------------------------------------------------- page-side scripts

INIT_JS = """
(function () {
  try { window.__NOW__ = %s; } catch (e) {}
  try {
    window.__SWCALLS__ = [];
    if (navigator.serviceWorker && typeof navigator.serviceWorker.register === 'function') {
      navigator.serviceWorker.register = function (u) {
        window.__SWCALLS__.push(String(u));
        return Promise.resolve({ scope: String(location.href) });
      };
    }
  } catch (e) { window.__SWSPY_ERR__ = String(e && e.message ? e.message : e); }
})();
"""

# Walk every element. Report an edge past the viewport only when no ANCESTOR scroll
# container still has the horizontal reach to bring it into view.
WALK_JS = r"""
(eps) => {
  const vw = document.documentElement.clientWidth;
  const offenders = [], excused = [], scrollers = [];
  const name = (el) => {
    let s = el.tagName.toLowerCase();
    if (el.id) s += '#' + el.id;
    const c = el.getAttribute && el.getAttribute('class');
    if (c && typeof c === 'string' && c.trim()) s += '.' + c.trim().split(/\s+/).join('.');
    const ds = el.getAttribute && el.getAttribute('data-section');
    if (ds) s += '[data-section="' + ds + '"]';
    const dt = el.getAttribute && el.getAttribute('data-testid');
    if (dt) s += '[data-testid="' + dt + '"]';
    return s;
  };
  for (const el of document.querySelectorAll('*')) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') continue;
    if (/(auto|scroll)/.test(cs.overflowX)) {
      scrollers.push({ sel: name(el), clientWidth: el.clientWidth, scrollWidth: el.scrollWidth,
                       scrollable: el.scrollWidth > el.clientWidth + 1 });
    }
    let worstRight = null, worstLeft = null;
    for (const r of el.getClientRects()) {
      if (r.width === 0 && r.height === 0) continue;
      if (worstRight === null || r.right > worstRight.right) worstRight = r;
      if (worstLeft === null || r.left < worstLeft.left) worstLeft = r;
    }
    const check = (rect, side) => {
      if (!rect) return;
      const over = side === 'right' ? rect.right - vw : -rect.left;
      if (over <= eps) return;
      // Reach: only INNER scroll containers count. The document's own scrolling element
      // panning sideways is the defect, not an excuse for it.
      let reach = 0; const via = [];
      for (let n = el.parentElement; n && n !== document.documentElement; n = n.parentElement) {
        const ncs = getComputedStyle(n);
        if (!/(auto|scroll)/.test(ncs.overflowX)) continue;
        const avail = side === 'right'
          ? (n.scrollWidth - n.clientWidth - n.scrollLeft)
          : n.scrollLeft;
        if (avail > 1) { reach += avail; via.push(name(n) + ' reach ' + avail.toFixed(1) + 'px'); }
      }
      const rec = { sel: name(el), side: side, viewport: vw,
                    left: +rect.left.toFixed(2), right: +rect.right.toFixed(2),
                    width: +rect.width.toFixed(2), over: +over.toFixed(2),
                    reach: +reach.toFixed(2), via: via,
                    text: (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 70) };
      if (over - reach <= eps) excused.push(rec); else offenders.push(rec);
    };
    check(worstRight, 'right');
    check(worstLeft, 'left');
  }
  offenders.sort((a, b) => b.over - a.over);
  return { viewport: vw, innerWidth: window.innerWidth,
           docScrollWidth: document.documentElement.scrollWidth,
           offenders: offenders, excused: excused, scrollers: scrollers };
}
"""

# Signature: draw the real screenshot PNG into a canvas in a scratch page and read it back.
# Chromium's own downscale, same build every run — measured bit-identical across two
# separate browser launches.
GRID_JS = r"""
async (a) => {
  const url = a[0], cols = a[1], rows = a[2];
  const img = new Image();
  await new Promise((res, rej) => { img.onload = res; img.onerror = () => rej(new Error('the screenshot did not decode')); img.src = url; });
  const c = document.createElement('canvas'); c.width = cols; c.height = rows;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
  g.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight, 0, 0, cols, rows);
  const d = g.getImageData(0, 0, cols, rows).data, out = [];
  for (let i = 0; i < cols * rows; i++) {
    out.push(Math.round((0.2126 * d[i * 4] + 0.7152 * d[i * 4 + 1] + 0.0722 * d[i * 4 + 2]) * 10) / 10);
  }
  return { sig: out, w: img.naturalWidth, h: img.naturalHeight };
}
"""

HIST_JS = r"""
async (a) => {
  const url = a[0], nbins = a[1];
  const img = new Image();
  await new Promise((res, rej) => { img.onload = res; img.onerror = () => rej(new Error('the screenshot did not decode')); img.src = url; });
  const W = img.naturalWidth, H = img.naturalHeight;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(img, 0, 0);
  const bins = new Array(nbins).fill(0);
  const step = 256 / nbins;
  let n = 0;
  const band = Math.max(1, Math.floor(8388608 / W));      // read back in strips, not one 85MB array
  for (let y = 0; y < H; y += band) {
    const h = Math.min(band, H - y);
    const d = g.getImageData(0, y, W, h).data;
    const px = W * h;
    for (let i = 0; i < px; i++) {
      const l = 0.2126 * d[i * 4] + 0.7152 * d[i * 4 + 1] + 0.0722 * d[i * 4 + 2];
      bins[Math.min(nbins - 1, Math.floor(l / step))]++;
    }
    n += px;
  }
  return { hist: bins.map((v) => Math.round(v / n * 10000) / 100), w: W, h: H };
}
"""

# D7 probes (v110 §5 D7; the module docstring says what each measures and why). FIXTURE_JS judges
# nothing: it returns numbers per row for the suite to judge, so a red names the row and the figure.
FIXTURE_JS = r"""
(a) => {
  const sel = a[0], fx = a[1] || {};
  const vis = (el) => { const cs = getComputedStyle(el), b = el.getBoundingClientRect();
    return cs.display !== 'none' && cs.visibility !== 'hidden' && Number(cs.opacity) > 0 && b.width > 0 && b.height > 0; };
  const ownText = (el) => Array.prototype.some.call(el.childNodes, (n) => n.nodeType === 3 && n.nodeValue.trim());
  const lhOf = (el) => {
    const v = parseFloat(getComputedStyle(el).lineHeight);
    if (isFinite(v)) return v;
    const p = document.createElement('span'); p.textContent = 'Hg';
    p.style.cssText = 'display:inline-block;line-height:normal;visibility:hidden;position:absolute;white-space:nowrap;padding:0;border:0;margin:0';
    el.appendChild(p); const h = p.getBoundingClientRect().height; p.remove(); return h;
  };
  const rows = Array.prototype.filter.call(document.querySelectorAll(sel), vis);
  const out = rows.map((row, i) => {
    const r = row.getBoundingClientRect(), cs = getComputedStyle(row);
    const pad = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom) + parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth);
    const content = r.height - pad;
    let lh = lhOf(row), lhAt = 'the row';
    for (const el of row.querySelectorAll('*')) {
      if (!ownText(el) || !vis(el)) continue;
      const v = lhOf(el); if (v > lh) { lh = v; lhAt = (el.getAttribute('class') || el.tagName.toLowerCase()); }
    }
    // The text's own boxes, grouped into lines by vertical overlap: two fragments share a line when they
    // overlap vertically by more than half the smaller one. Padding and line-height cannot move this count.
    const rects = [];
    const w = document.createTreeWalker(row, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      if (!n.nodeValue.trim() || !n.parentElement || !vis(n.parentElement)) continue;
      const rg = document.createRange(); rg.selectNodeContents(n);
      for (const q of rg.getClientRects()) if (q.width > 0.5 && q.height > 0.5) rects.push({ t: q.top, b: q.bottom, s: n.nodeValue.trim().slice(0, 24) });
    }
    const lines = [];
    rects.sort((x, y) => x.t - y.t).forEach((q) => {
      const hit = lines.find((L) => L.some((p) => Math.min(p.b, q.b) - Math.max(p.t, q.t) > 0.5 * Math.min(p.b - p.t, q.b - q.t)));
      if (hit) hit.push(q); else lines.push([q]);
    });
    // The row's words are its visible text nodes joined by a space. innerText is not used: two inline spans with no
    // whitespace between them read "LEESat", where no word boundary sits between the team and the weekday.
    const parts = [];
    const tw = document.createTreeWalker(row, NodeFilter.SHOW_TEXT);
    for (let n = tw.nextNode(); n; n = tw.nextNode()) if (n.nodeValue.trim() && n.parentElement && vis(n.parentElement)) parts.push(n.nodeValue.trim());
    const text = parts.join(' ').replace(/\s+/g, ' ');
    const tm = text.match(/\b([A-Z]{3}) v ([A-Z]{3})\b/);
    const dm = text.match(/\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun)(?:day|sday|nesday|rsday|urday)?\b/);
    const hm = text.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
    const key = tm ? tm[1] + '|' + tm[2] : '';
    return { i: i, text: text.slice(0, 90), height: +r.height.toFixed(2), content: +content.toFixed(2),
             lh: +lh.toFixed(2), lhAt: lhAt, ratio: +(content / lh).toFixed(3), lines: lines.length,
             lineTexts: lines.map((L) => L.map((q) => q.s).join(' ')).slice(0, 3),
             teams: key, day: dm ? dm[1] : '', time: hm ? (hm[1].length === 1 ? '0' + hm[1] : hm[1]) + ':' + hm[2] : '',
             expect: fx[key] || null, overflowX: row.scrollWidth > row.clientWidth + 1 };
  });
  return { count: rows.length, rows: out };
}
"""

# Fixture-like lists under a class the suite does not know: a parent with at least three element children
# whose text starts "ABC v XYZ". Used only to refuse a silent skip when the Today list lands under a new class.
# The Odds tab's fixture line (D4): kick-off, match and expected goals, three cells keyed by data-fx. The row's second
# line (.mini: prices, clean sheets, source) is a declared secondary line, so the rule is held on the three cells: each
# on one line, all three on the same line, and the kick-off a weekday and a time equal to the SAST kick-off.
ODDS_LINE_JS = r"""
(a) => {
  const fx = a[0] || {};
  const vis = (el) => { const cs = getComputedStyle(el), b = el.getBoundingClientRect();
    return cs.display !== 'none' && cs.visibility !== 'hidden' && b.width > 0 && b.height > 0; };
  const lhOf = (el) => { const v = parseFloat(getComputedStyle(el).lineHeight); if (isFinite(v)) return v;
    const p = document.createElement('span'); p.textContent = 'Hg';
    p.style.cssText = 'display:inline-block;line-height:normal;visibility:hidden;position:absolute;white-space:nowrap';
    el.appendChild(p); const h = p.getBoundingClientRect().height; p.remove(); return h; };
  const rectsOf = (el) => { const out = []; const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) { if (!n.nodeValue.trim()) continue; const rg = document.createRange(); rg.selectNodeContents(n);
      for (const q of rg.getClientRects()) if (q.width > 0.5 && q.height > 0.5) out.push({ t: q.top, b: q.bottom }); } return out; };
  const cellsOf = (id) => ['od-ko', 'od-fx', 'od-xg'].map((t) => document.querySelector('[data-testid="' + t + '"][data-fx="' + id + '"]'));
  return Array.prototype.filter.call(document.querySelectorAll('[data-testid="od-fx"]'), vis).map((el) => {
    const id = el.getAttribute('data-fx'), cells = cellsOf(id);
    const per = cells.map((c) => { if (!c || !vis(c)) return null; const cs = getComputedStyle(c), r = c.getBoundingClientRect();
      const content = r.height - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) - parseFloat(cs.borderTopWidth) - parseFloat(cs.borderBottomWidth);
      const lh = lhOf(c); return { text: (c.textContent || '').trim(), ratio: content / lh, rects: rectsOf(c) }; });
    const all = [].concat.apply([], per.filter(Boolean).map((p) => p.rects));
    const lines = [];
    all.sort((x, y) => x.t - y.t).forEach((q) => { const hit = lines.find((L) => L.some((p) => Math.min(p.b, q.b) - Math.max(p.t, q.t) > 0.5 * Math.min(p.b - p.t, q.b - q.t)));
      if (hit) hit.push(q); else lines.push([q]); });
    const ko = per[0] ? per[0].text : '', m = (per[1] ? per[1].text : '').match(/\b([A-Z]{3}) v ([A-Z]{3})\b/);
    const dm = ko.match(/\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\b/), hm = ko.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
    const key = m ? m[1] + '|' + m[2] : '';
    return { id: id, gw: el.getAttribute('data-gw'), match: per[1] ? per[1].text : '', ko: ko, missing: per.filter((p) => !p).length,
             maxRatio: Math.max.apply(null, per.filter(Boolean).map((p) => p.ratio)), lines: lines.length,
             day: dm ? dm[1] : '', time: hm ? (hm[1].length === 1 ? '0' + hm[1] : hm[1]) + ':' + hm[2] : '', expect: fx[key] || null };
  });
}
"""

FIXTURE_LIKE_JS = r"""
() => {
  const root = document.querySelector('.mc-root'); if (!root) return [];
  const re = /^[A-Z]{3} v [A-Z]{3}\b/, seen = new Map();
  const words = (el) => { const out = [], w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) if (n.nodeValue.trim()) out.push(n.nodeValue.trim());
    return out.join(' '); };
  for (const p of root.querySelectorAll('*')) {
    const kids = Array.prototype.filter.call(p.children, (k) => re.test(words(k)));
    if (kids.length < 3) continue;
    const sig = kids[0].tagName.toLowerCase() + ((kids[0].getAttribute('class') || '').trim() ? '.' + kids[0].getAttribute('class').trim().split(/\s+/).join('.') : '');
    seen.set(sig, (seen.get(sig) || 0) + kids.length);
  }
  return Array.from(seen.entries()).map((e) => ({ sig: e[0], n: e[1] }));
}
"""

DECOR_JS = r"""
(a) => {
  const eps = a[0], classSel = a[1];
  const root = document.querySelector('.mc-root') || document.body;
  const alpha = (c) => { if (!c || c === 'transparent') return 0; const m = String(c).match(/rgba?\(([^)]*)\)/);
    if (!m) return 1; const p = m[1].split(/[\s,\/]+/).filter(Boolean); return p.length >= 4 ? parseFloat(p[3]) : 1; };
  const SIDES = ['Top', 'Right', 'Bottom', 'Left'];
  const paints = (cs) => SIDES.some((s) => parseFloat(cs['border' + s + 'Width']) > 0 && !/^(none|hidden)$/.test(cs['border' + s + 'Style']) && alpha(cs['border' + s + 'Color']) > 0)
    || cs.backgroundImage !== 'none' || alpha(cs.backgroundColor) > 0;
  const name = (el) => { let s = el.tagName.toLowerCase(); const c = el.getAttribute('class');
    if (c && c.trim()) s += '.' + c.trim().split(/\s+/).join('.'); const d = el.getAttribute('data-testid'); if (d) s += '[data-testid="' + d + '"]'; return s; };
  const vis = (el) => { for (let n = el; n && n.nodeType === 1; n = n.parentElement) { const cs = getComputedStyle(n);
    if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') return false; } return true; };
  const padBox = (n) => { const r = n.getBoundingClientRect(); return { l: r.left + n.clientLeft, t: r.top + n.clientTop,
    r: r.left + n.clientLeft + n.clientWidth, b: r.top + n.clientTop + n.clientHeight }; };
  const clipBy = (box, from) => { let b = Object.assign({}, box), via = [];
    for (let n = from; n && n !== document.documentElement; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (cs.overflowX === 'visible' && cs.overflowY === 'visible') continue;
      const p = padBox(n); b = { l: Math.max(b.l, p.l), t: Math.max(b.t, p.t), r: Math.min(b.r, p.r), b: Math.min(b.b, p.b) }; via.push(name(n));
    }
    return { box: b, via: via }; };
  const decor = [];
  for (const el of root.querySelectorAll('*')) {
    if (!vis(el)) continue;
    for (const which of ['::before', '::after']) {
      const cs = getComputedStyle(el, which);
      if (!cs || cs.content === 'none' || cs.content === 'normal' || cs.display === 'none' || cs.visibility === 'hidden') continue;
      if (!/^(""|'')$/.test(cs.content)) continue;              // text or a counter: that is text, not a line
      if (!paints(cs)) continue;
      const rec = { sel: name(el) + which, kind: 'pseudo' };
      if (cs.position !== 'absolute' && cs.position !== 'fixed') { rec.unmeasured = 'position ' + cs.position; decor.push(rec); continue; }
      let cb = el;
      if (cs.position === 'fixed') cb = null;
      else while (cb && cb !== document.documentElement && getComputedStyle(cb).position === 'static') cb = cb.parentElement;
      const o = cb && cb !== document.documentElement ? padBox(cb) : { l: 0, t: 0 };
      let w = parseFloat(cs.width), h = parseFloat(cs.height);
      if (cs.boxSizing !== 'border-box') {
        w += parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight) + parseFloat(cs.borderLeftWidth) + parseFloat(cs.borderRightWidth);
        h += parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom) + parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth);
      }
      const L = o.l + parseFloat(cs.left) + parseFloat(cs.marginLeft), T = o.t + parseFloat(cs.top) + parseFloat(cs.marginTop);
      if (![w, h, L, T].every(isFinite)) { rec.unmeasured = 'unresolved geometry left ' + cs.left + ' top ' + cs.top + ' width ' + cs.width; decor.push(rec); continue; }
      rec.raw = { l: L, t: T, r: L + w, b: T + h };
      const rad = cs.borderTopLeftRadius;
      rec.circle = /%$/.test(rad) ? parseFloat(rad) >= 50 : parseFloat(rad) >= Math.min(w, h) / 2 - 0.5;
      rec.stroke = Math.max(parseFloat(cs.borderTopWidth) || 0, parseFloat(cs.borderLeftWidth) || 0);
      const c = clipBy(rec.raw, cb && cb !== document.documentElement ? cb : null); rec.box = c.box; rec.clip = c.via;
      decor.push(rec);
    }
  }
  if (classSel) for (const el of root.querySelectorAll(classSel)) {
    if (!vis(el)) continue;
    const r = el.getBoundingClientRect(); const rec = { sel: name(el), kind: 'element', raw: { l: r.left, t: r.top, r: r.right, b: r.bottom } };
    const cs = getComputedStyle(el); rec.circle = /%$/.test(cs.borderTopLeftRadius) ? parseFloat(cs.borderTopLeftRadius) >= 50 : false;
    rec.stroke = parseFloat(cs.borderTopWidth) || 0;
    const c = clipBy(rec.raw, el.parentElement); rec.box = c.box; rec.clip = c.via; decor.push(rec);
  }
  const texts = [];
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    const p = n.parentElement; if (!p || !n.nodeValue.trim() || /^(STYLE|SCRIPT)$/.test(p.tagName) || !vis(p)) continue;
    const rg = document.createRange(); rg.selectNodeContents(n);
    for (const q of rg.getClientRects()) if (q.width > 0.5 && q.height > 0.5) texts.push({ l: q.left, t: q.top, r: q.right, b: q.bottom, s: n.nodeValue.trim().slice(0, 40) });
  }
  const f2 = (b) => ({ l: +b.l.toFixed(2), t: +b.t.toFixed(2), r: +b.r.toFixed(2), b: +b.b.toFixed(2) });
  for (const d of decor) {
    if (!d.box) continue;
    d.visible = d.box.r - d.box.l > eps && d.box.b - d.box.t > eps;
    d.hits = !d.visible ? [] : texts.filter((q) => Math.min(q.r, d.box.r) - Math.max(q.l, d.box.l) > eps && Math.min(q.b, d.box.b) - Math.max(q.t, d.box.t) > eps)
      .map((q) => ({ s: q.s, box: f2(q) }));
    if (d.circle && d.raw) {
      // The stroke itself: a text box crosses the ring when its nearest point is inside the outer radius and its farthest
      // point is outside the inner one. Reported beside the box verdict, never instead of it.
      const cx = (d.raw.l + d.raw.r) / 2, cy = (d.raw.t + d.raw.b) / 2, R = (d.raw.r - d.raw.l) / 2, r0 = R - d.stroke;
      d.ring = d.hits.filter((h) => { const q = h.box;
        const nx = Math.max(q.l, Math.min(cx, q.r)), ny = Math.max(q.t, Math.min(cy, q.b));
        const near = Math.hypot(nx - cx, ny - cy);
        const far = Math.max(Math.hypot(q.l - cx, q.t - cy), Math.hypot(q.r - cx, q.t - cy), Math.hypot(q.l - cx, q.b - cy), Math.hypot(q.r - cx, q.b - cy));
        return near < R && far > r0; }).length;
    }
    d.raw = f2(d.raw); d.box = f2(d.box);
  }
  return { decor: decor, texts: texts.length };
}
"""

# Mutations. Each one exists so the checks can be proven able to fail, and each is applied
# to every tab and theme so the red is unmissable. --list-mutations prints them.
MUTATIONS = {
    "wide": (
        "injects a 600px-wide bar into .wrap, which is not a scroll container, so the "
        "overflow walk must name it",
        "() => { const w = document.querySelector('.wrap'); if (!w) return 'no .wrap'; "
        "const d = document.createElement('div'); d.id = 'mutation-wide-bar'; "
        "d.style.cssText = 'width:600px;height:18px;background:#7c2542'; "
        "d.textContent = 'MUTATION wide bar 600px'; w.insertBefore(d, w.firstChild); "
        "return 'injected #mutation-wide-bar width 600px'; }"
    ),
    "wide-in-scroller": (
        "injects the same 600px bar inside a declared overflow-x:auto scroller, which the "
        "walk must EXCUSE — the control that proves the reach logic is doing the work",
        "() => { const w = document.querySelector('.wrap'); if (!w) return 'no .wrap'; "
        "const s = document.createElement('div'); s.id = 'mutation-scroller'; "
        "s.style.cssText = 'overflow-x:auto'; const d = document.createElement('div'); "
        "d.style.cssText = 'width:600px;height:18px;background:#1d7a59'; "
        "d.textContent = 'MUTATION wide bar inside a scroller'; s.appendChild(d); "
        "w.insertBefore(s, w.firstChild); return 'injected #mutation-scroller with a 600px child'; }"
    ),
    "invert": (
        "rewrites the palette tokens on .mc-root to a light set, which the signature guard "
        "must fire on",
        "() => { const r = document.querySelector('.mc-root'); if (!r) return 'no .mc-root'; "
        "const t = { '--bg': '#ffffff', '--bg2': '#f2f4f8', '--bg3': '#e6e9f0', "
        "'--text': '#0b0e13', '--dim': '#3a4150', '--mute': '#5b6474', '--line': '#c9cfdb' }; "
        "for (const k in t) r.style.setProperty(k, t[k]); "
        "return 'inverted ' + Object.keys(t).length + ' palette tokens'; }"
    ),
    "drop-panel": (
        "removes the first card or section in .wrap, to show what the grid guard does and "
        "does not see",
        "() => { const s = document.querySelector('.wrap .card, .wrap .section'); "
        "if (!s) return 'nothing to drop'; const id = s.getAttribute('data-section') || s.className; "
        "const y = Math.round(s.getBoundingClientRect().top); s.remove(); "
        "return 'dropped ' + id + ' at y' + y; }"
    ),
    "reflow": (
        "lengthens forty text nodes by about fourteen characters each: the signature guards "
        "must NOT fire, and the overflow walk MUST, because over-long labels escape the "
        "viewport",
        "() => { const w = document.createTreeWalker(document.querySelector('.wrap'), "
        "NodeFilter.SHOW_TEXT); let n, c = 0; while ((n = w.nextNode()) && c < 40) { "
        "const p = n.parentElement; if (!p || p.tagName === 'STYLE') continue; "
        "if (n.nodeValue.trim().length < 3) continue; n.nodeValue = n.nodeValue + ' Wolverhampton'; c++; } "
        "return 'lengthened ' + c + ' text nodes'; }"
    ),
    "odds-wrap": (
        "squeezes every Odds match cell to 24px with wrapping on, so the D7 fixture-line check "
        "on the Odds tab must fire",
        "() => { const c = document.querySelectorAll('[data-testid=\"od-fx\"]'); "
        "c.forEach((e) => { e.style.whiteSpace = 'normal'; e.style.overflow = 'visible'; "
        "e.style.display = 'block'; e.style.width = '24px'; }); "
        "return 'squeezed ' + c.length + ' od-fx cells to 24px'; }"
    ),
    "blank": (
        "empties the mounted root, which the visible-text check must fire on",
        "() => { const r = document.querySelector('.mc-root'); if (!r) return 'no .mc-root'; "
        "for (const k of [...r.children]) { if (k.tagName !== 'STYLE') k.remove(); } "
        "return 'emptied .mc-root'; }"
    ),
}

# The kit's Today board (its styles.css .board/.fxlist/.fxrow rules with its dark-scheme chalk,
# rgba(255,255,255,.35), and its ui.js vToday markup), transplanted to the top of .wrap with the
# snapshot's own fixtures for the pinned event. Selectors are prefixed with .mc-root only so
# they outrank the app's `.mc-root *{font-size:inherit}`; every value is the kit's. The rows
# and the countdown come from fixture_facts() at runtime (the mutation's argument), never from
# a literal. The four variants each exist to turn one D7 check red, or, for kit-board, to show
# both checks RUN (no skip) on a faithful port.
KIT_BOARD_JS = r"""
(a) => {
  const f = a.facts, v = a.variant;
  const w = document.querySelector('.wrap'); if (!w) return 'no .wrap';
  if (document.getElementById('mutation-kit-board')) return 'the kit board is already in place';
  const css = [
    '.mc-root .board{background:linear-gradient(180deg,#1E5A38,#1A5032);color:#fff;border-radius:18px;padding:18px 16px 16px;position:relative;overflow:hidden;margin:10px 0;font-family:"Barlow","Helvetica Neue",Helvetica,Arial,sans-serif;font-size:16px;line-height:1.45}',
    '.mc-root .board:before{content:"";position:absolute;right:-120px;top:-120px;width:240px;height:240px;border:2px solid rgba(255,255,255,.35);border-radius:50%}',
    '.mc-root .board:after{content:"";position:absolute;right:-6px;top:-6px;width:22px;height:22px;border:2px solid rgba(255,255,255,.35);border-radius:50%}',
    '.mc-root .board>*{position:relative;z-index:1}',
    '.mc-root .board .kicker{font-size:1rem;opacity:.9;margin:0}',
    '.mc-root .board .big{font-family:"Barlow Condensed","Arial Narrow","Helvetica Neue",Arial,sans-serif;font-size:clamp(2.6rem,11vw,4.6rem);font-weight:700;line-height:.95;margin:2px 0 4px}',
    '.mc-root .board .when{margin:0;opacity:.92}',
    '.mc-root .board .fxlist{display:grid;grid-template-columns:1fr;gap:6px;margin-top:14px}',
    '.mc-root .board .fxrow{display:flex;align-items:center;gap:8px;background:rgba(0,0,0,.22);border-radius:10px;padding:7px 10px;font-size:.95rem}',
    '.mc-root .board .fxrow .t{font-family:"Barlow Condensed","Arial Narrow","Helvetica Neue",Arial,sans-serif;font-weight:600;font-size:1.1rem;white-space:nowrap;flex:0 0 auto}',
    '.mc-root .board .fxrow .ko{opacity:.85;font-size:.85rem;white-space:nowrap;flex:0 0 auto}',
    '.mc-root .board .fxrow .mine{display:flex;flex-wrap:wrap;gap:4px;margin-left:auto;justify-content:flex-end}'
  ].join('\n');
  const st = document.createElement('style'); st.id = 'mutation-kit-style'; st.textContent = css; document.head.appendChild(st);
  const sec = document.createElement('section'); sec.id = 'mutation-kit-board';
  const board = document.createElement('div'); board.className = 'board';
  const p = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; e.textContent = text; return e; };
  board.appendChild(p('p', 'kicker', 'Gameweek ' + f.gw + ' locks in'));
  board.appendChild(p('div', 'big num', f.left));
  board.appendChild(p('p', 'when', f.when));
  const list = document.createElement('div'); list.className = 'fxlist';
  f.rows.forEach((r) => {
    const row = p('div', 'fxrow', '');
    row.appendChild(p('span', 't', r.h + ' v ' + r.a));
    row.appendChild(p('span', 'ko', r.day + ' ' + (v === 'fixture-utc' ? r.utc : r.time)));
    row.appendChild(p('span', 'mine', ''));
    list.appendChild(row);
  });
  board.appendChild(list);
  sec.appendChild(board); w.insertBefore(sec, w.firstChild);
  let note = 'the kit board with ' + f.rows.length + ' fixture rows for GW' + f.gw;
  if (v === 'fixture-wrap') {
    const r0 = list.querySelector('.fxrow');
    if (r0) { r0.style.width = '150px'; r0.style.flexWrap = 'wrap'; r0.querySelectorAll('span').forEach((s) => { s.style.whiteSpace = 'normal'; }); }
    note += ', the first row squeezed to 150px so it wraps';
  }
  if (v === 'fixture-utc') note += ', kick-offs written in UTC';
  if (v === 'chalk-cross') { board.querySelector('.kicker').style.textAlign = 'right'; note += ', the kicker set right, under the big circle'; }
  if (v === 'fixture-renamed') { list.querySelectorAll('.fxrow').forEach((r) => { r.className = 'fxline'; }); note += ', its rows renamed .fxline'; }
  return note;
}
"""

for _v, _why in (
    ("kit-board", "the kit's Today board, faithful: the fixture-row and chalk checks must RUN on it "
                  "(no skip); what they say about the kit's own layout is recorded in the docstring"),
    ("fixture-wrap", "the kit board with its first fixture row squeezed so it wraps: the one-line "
                     "check must fire"),
    ("fixture-utc", "the kit board with its kick-offs written in UTC: the SAST check must fire"),
    ("chalk-cross", "the kit board with its kicker set right, under the big chalk circle: the chalk "
                    "check must fire at 390"),
    ("fixture-renamed", "the kit board with its rows under another class: the fixture rule must FAIL "
                        "naming the class, not skip"),
):
    MUTATIONS[_v] = (_why, "(a) => (" + KIT_BOARD_JS.strip() + ")({ facts: a, variant: " + json.dumps(_v) + " })")


# ---------------------------------------------------------------- baseline text


def parse_baseline(text):
    out = {}
    for raw in str(text).splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        parts = line.split()
        if len(parts) != 4 or parts[0] not in ("G", "H"):
            raise RuntimeError("browser: the baseline block carries a line it cannot parse: "
                               + line[:80])
        kind, tab, theme, csv = parts
        vals = [float(v) for v in csv.split(",")]
        want = GRID_COLS * GRID_ROWS if kind == "G" else HIST_BINS
        if len(vals) != want:
            raise RuntimeError("browser: baseline %s %s %s carries %d values, expected %d"
                               % (kind, tab, theme, len(vals), want))
        out[(kind, tab, theme)] = vals
    return out


def render_baseline(sigs):
    lines = []
    for (tab, theme) in sorted(sigs.keys()):
        rec = sigs[(tab, theme)]
        lines.append("G %s %s %s" % (tab, theme, ",".join("%.1f" % v for v in rec["grid"])))
        lines.append("H %s %s %s" % (tab, theme, ",".join("%.2f" % v for v in rec["hist"])))
    return "\n".join(lines)


def write_baseline(sigs):
    """Rewrite the BASELINE block in this file. The only file this suite writes to."""
    path = os.path.abspath(__file__)
    with open(path, "r", encoding="utf-8") as fh:
        src = fh.read()
    m = re.search(r'(BASELINE = r""")(.*?)(""")', src, re.S)
    if not m:
        raise RuntimeError("browser: the BASELINE block is not where --write-baseline expects it")
    new = src[:m.start(2)] + "\n" + render_baseline(sigs) + "\n" + src[m.end(2):]
    with open(path, "w", encoding="utf-8") as fh:
        fh.write(new)
    return path, len(sigs) * 2


def delta(a, b):
    v = [abs(x - y) for x, y in zip(a, b)]
    return max(v), sum(v) / len(v)


# ---------------------------------------------------------------- driving the page


def open_everything(page, tab):
    """Click to a tab and expand every section and reveal on it, so the walk and the
    signature see the whole screen rather than the collapsed default."""
    page.click('[data-testid="tab-%s"]' % tab)
    page.wait_for_function(
        "id => { const r = document.querySelector('.mc-root'); return r && r.getAttribute('data-view') === id; }",
        arg=tab, timeout=20000)
    secs = page.eval_on_selector_all(".section", "els => els.map(e => e.getAttribute('data-section'))")
    for sid in secs:
        sel = '[data-testid="sec-%s"]' % sid
        if page.get_attribute(sel, "aria-expanded") != "true":
            page.click(sel)
    revs = page.eval_on_selector_all(".reveal", "els => els.map(e => e.getAttribute('data-testid'))")
    for rid in revs:
        sel = '[data-testid="%s"]' % rid
        if page.get_attribute(sel, "aria-expanded") != "true":
            page.click(sel)
    page.wait_for_timeout(200)
    return secs, revs


def go_full(page):
    """The app boots in simple mode, where the tab strip is not rendered. Reach full mode
    through the real menu rather than by seeding storage."""
    page.click('[data-testid="menu"]')
    page.click('[data-mode="full"]')
    page.wait_for_selector(".tabs", timeout=15000)
    page.wait_for_timeout(120)
    return page.get_attribute(".mc-root", "data-mode")


def new_page(browser, origin, viewport, scheme, init_js, errors, aborted, label):
    ctx = browser.new_context(viewport=viewport, device_scale_factor=DSF, color_scheme=scheme)
    ctx.add_init_script(init_js)

    def route(r, req):
        if req.url.startswith(origin):
            return r.continue_()
        aborted.append(req.url)
        return r.abort()

    ctx.route("**/*", route)
    page = ctx.new_page()
    page.on("pageerror", lambda e: errors.append((label[0], "pageerror: " + str(e))))
    page.on("console", lambda m: errors.append((label[0], "console.error: " + m.text))
            if m.type == "error" else None)
    page.goto(origin + "/index.html", wait_until="load")
    page.wait_for_selector(".mc-root", timeout=30000)
    return ctx, page


# ---------------------------------------------------------------- the self-check


def press_self_check(page, theme):
    """The app carries no control literally named "self-test". Its self-report is the
    Command tab's "What the engine checked" section (src/ui.jsx:768) — four checks the
    engine runs against the snapshot on every draw. Press it and assert what it says,
    including against the Squad tab, which renders the same verdict independently."""
    page.click('[data-testid="tab-command"]')
    page.wait_for_function(
        "() => document.querySelector('.mc-root').getAttribute('data-view') === 'command'",
        timeout=20000)
    sel = '[data-testid="sec-cmd-checks"]'
    before = page.get_attribute(sel, "aria-expanded")
    if before == "true":                     # start from closed so the press has to do work
        page.click(sel)
        page.wait_for_timeout(120)
        before = page.get_attribute(sel, "aria-expanded")
    page.click(sel)
    page.wait_for_timeout(200)
    after = page.get_attribute(sel, "aria-expanded")
    rep = page.evaluate(r"""() => {
      const s = [...document.querySelectorAll('.section')]
        .find(x => x.getAttribute('data-section') === 'cmd-checks');
      if (!s) return null;
      const rows = [...s.querySelectorAll('.kv')].map(k => {
        const kk = k.querySelector('.k'), vv = k.querySelector('.v');
        return { k: kk ? kk.innerText.trim() : '', v: vv ? vv.innerText.trim() : '',
                 tone: vv ? vv.className.replace(/^v\s*/, '').trim() : '' };
      });
      return { rows: rows, text: s.innerText.replace(/\s+/g, ' ').trim(),
               blocks: document.querySelectorAll('.block').length,
               confirms: document.querySelectorAll('[data-testid^="confirm-"]').length };
    }""")
    assert_("browser-self-check-" + theme + "-opens-on-press",
            before == "false" and after == "true" and rep is not None,
            'sec-cmd-checks aria-expanded "%s" -> "%s", section %s'
            % (before, after, "rendered" if rep else "absent"))
    if rep is None:
        return
    rows = {r["k"]: r for r in rep["rows"]}
    api = rows.get("Squad matches the API")
    flags = rows.get("Flags on the fifteen")
    fts = rows.get("Free transfers")
    age = rows.get("Snapshot age")
    have_all = all(x is not None for x in (api, flags, fts, age))
    assert_("browser-self-check-" + theme + "-reports-its-four-checks",
            have_all and len(rep["rows"]) == 4,
            "%d rows: %s" % (len(rep["rows"]),
                             "; ".join("%s=%s" % (r["k"], r["v"]) for r in rep["rows"])))
    if not have_all:
        return
    ok_api = api["v"] in ("yes", "no")
    ok_tone = (api["tone"] == "go") if api["v"] == "yes" else (api["tone"] == "out")
    assert_("browser-self-check-" + theme + "-squad-verdict-is-a-verdict-with-a-matching-tone",
            ok_api and ok_tone,
            'value "%s" with tone class "%s" (yes must paint go, no must paint out)'
            % (api["v"], api["tone"]))
    assert_("browser-self-check-" + theme + "-flag-and-transfer-counts-are-numbers",
            re.match(r"^\d+$", flags["v"]) is not None and re.match(r"^\d+$", fts["v"]) is not None,
            'flags on the fifteen "%s", free transfers "%s"' % (flags["v"], fts["v"]))
    assert_("browser-self-check-" + theme + "-snapshot-age-is-an-age",
            re.match(r"^\d+(\.\d+)?\s*(min|h|d)$", age["v"]) is not None,
            'snapshot age "%s" (the clock is pinned to the snapshot, so this is its real age)'
            % age["v"])
    # The same verdict, rendered independently on the Squad tab. Two surfaces, one truth.
    page.click('[data-testid="tab-squad"]')
    page.wait_for_function(
        "() => document.querySelector('.mc-root').getAttribute('data-view') === 'squad'",
        timeout=20000)
    ssel = '[data-testid="sec-sq-confirm"]'
    if page.get_attribute(ssel, "aria-expanded") != "true":
        page.click(ssel)
    page.wait_for_timeout(200)
    sq = page.evaluate(r"""() => {
      const s = [...document.querySelectorAll('.section')]
        .find(x => x.getAttribute('data-section') === 'sq-confirm');
      return s ? { text: s.innerText.replace(/\s+/g, ' ').trim(),
                   blocks: s.querySelectorAll('.block').length } : null;
    }""")
    matches = bool(sq) and "matches the entry" in sq["text"]
    blocked = bool(sq) and sq["blocks"] > 0
    consistent = (api["v"] == "yes" and matches and not blocked) or \
                 (api["v"] == "no" and blocked and not matches)
    assert_("browser-self-check-" + theme + "-agrees-with-the-squad-tab",
            consistent,
            'Command says "%s"; Squad check says "%s" with %d block note(s)'
            % (api["v"], (sq["text"][:90] if sq else "nothing rendered"),
               (sq["blocks"] if sq else -1)))


# ---------------------------------------------------------------- Part G first paint, landing, D7

FIRST_PAINT_JS = r"""
() => {
  const r = document.querySelector('.mc-root');
  const secs = Array.prototype.slice.call(r.querySelectorAll('.section'));
  return { words: (r.innerText || '').trim().split(/\s+/).filter(Boolean).length,
           open: secs.filter((s) => { const h = s.querySelector('.sec-h'); return h && h.getAttribute('aria-expanded') === 'true'; })
                     .map((s) => s.getAttribute('data-section')),
           count: secs.length };
}
"""

LANDING_JS = r"""
() => {
  const l = document.querySelector('.mc-root .landing');
  if (!l) return null;
  const t = (l.innerText || '').trim();
  return { words: t.split(/\s+/).filter(Boolean).length, panels: l.querySelectorAll('.panel').length,
           text: t.replace(/\s+/g, ' ') };
}
"""


def first_paint(page, tab):
    """The tab as it first paints, before anything on it is pressed: the words the manager sees
    and which sections are open. Measured the same way qa/smoke.cjs measures it."""
    page.click('[data-testid="tab-%s"]' % tab)
    page.wait_for_function(
        "id => { const r = document.querySelector('.mc-root'); return r && r.getAttribute('data-view') === id; }",
        arg=tab, timeout=20000)
    page.wait_for_timeout(120)
    return page.evaluate(FIRST_PAINT_JS)


def d7_fixture_rows(page, where, expect, gate):
    """D7's fixture rule on the page as it stands. Returns a one-line summary, or None when no
    fixture row renders and no fixture-like list does either (the caller prints the skip)."""
    res = page.evaluate(FIXTURE_JS, [FIXTURE_ROW_SEL, expect])
    rows = res["rows"]
    if not rows:
        like = page.evaluate(FIXTURE_LIKE_JS)
        if like:
            assert_("browser-d7-%s-fixture-rows-are-found-by-their-class" % where, False,
                    "no %s row renders, but a fixture-like list does: %s — the Today list is "
                    "under a class this suite does not read; point FIXTURE_ROW_SEL at it rather "
                    "than let the rule skip" % (FIXTURE_ROW_SEL, ", ".join(
                        "%s x%d" % (x["sig"], x["n"]) for x in like)))
            return "a fixture-like list under another class"
        return None
    worst = max(rows, key=lambda x: x["ratio"])
    lines = sorted(set(x["lines"] for x in rows))
    summary = ("%d %s rows; content height at most %.3f x line-height (%r: %.2f px against a "
               "%.2f px line set by .%s); text on %s line(s) per row"
               % (len(rows), FIXTURE_ROW_SEL, worst["ratio"], worst["text"][:24], worst["content"],
                  worst["lh"], worst["lhAt"], "/".join(str(n) for n in lines)))
    if not gate:
        print("#   D7 fixture rows at %s, measured and not gated: %s" % (where, summary), flush=True)
        return summary
    broken = [x for x in rows if x["lines"] != 1 or x["ratio"] >= FIXTURE_LINE_RATIO]
    assert_("browser-d7-%s-fixture-rows-stay-on-one-line" % where, not broken,
            summary + " (gate: under %.1f, and exactly one line)" % FIXTURE_LINE_RATIO if not broken else
            "%d of %d rows break it: %s" % (len(broken), len(rows), "; ".join(
                "%r is %.2f px of content, %.3f x its %.2f px line, text on %d lines %s"
                % (x["text"][:30], x["content"], x["ratio"], x["lh"], x["lines"], x["lineTexts"])
                for x in broken[:3])))
    missing = [x for x in rows if not x["day"] or not x["time"]]
    assert_("browser-d7-%s-fixture-rows-show-weekday-and-time" % where, not missing,
            ("every row carries a weekday and an HH:MM time, e.g. " + "; ".join(
                "%s %s %s" % (x["teams"].replace("|", " v "), x["day"], x["time"]) for x in rows[:3]))
            if not missing else "%d row(s) show no weekday or no time: %s"
            % (len(missing), "; ".join(repr(x["text"][:40]) for x in missing[:3])))
    timed = [x for x in rows if x["day"] and x["time"]]
    wrong = []
    for x in timed:
        e = x["expect"]
        if not e:
            wrong.append("%r matches no home v away in data/mc_data.json" % x["text"][:40])
        elif e["day"] != x["day"] or e["time"] != x["time"]:
            wrong.append("%s shows %s %s, the kick-off is %s %s SAST%s"
                         % (x["teams"].replace("|", " v "), x["day"], x["time"], e["day"], e["time"],
                            " — the time shown is UTC" if x["time"] == e["utc"] else ""))
    assert_("browser-d7-%s-fixture-times-are-sast" % where, bool(timed) and not wrong,
            ("%d of %d rows equal their kick-off in SAST (UTC+2), matched by home v away against "
             "data/mc_data.json" % (len(timed), len(rows))) if timed and not wrong else
            ("no row carries a weekday and a time to check" if not timed else
             "%d row(s) wrong: %s" % (len(wrong), "; ".join(wrong[:3]))))
    return summary


def d7_odds_lines(page, where, expect):
    """D7's fixture rule on the Odds tab's fixture lines (see ODDS_LINE_JS). Returns a summary, or
    None when the tab renders no fixture line (the caller prints the skip)."""
    rows = page.evaluate(ODDS_LINE_JS, [expect])
    if not rows:
        return None
    bad = [r for r in rows if r["missing"] or r["lines"] != 1 or r["maxRatio"] >= FIXTURE_LINE_RATIO]
    worst = max(rows, key=lambda r: r["maxRatio"])
    assert_("browser-d7-%s-odds-fixture-lines-stay-on-one-line" % where, not bad,
            ("%d fixture lines (kick-off, match, expected goals) across GW%s: each cell at most %.3f x its "
             "line-height (%s), all three on one line (gate: under %.1f, one line)"
             % (len(rows), "/GW".join(sorted(set(str(r["gw"]) for r in rows))), worst["maxRatio"],
                worst["match"], FIXTURE_LINE_RATIO)) if not bad else
            "%d of %d break it: %s" % (len(bad), len(rows), "; ".join(
                "%s: %d cell(s) missing, %.3f x line-height, %d line(s)" % (r["match"] or r["id"], r["missing"],
                                                                           r["maxRatio"], r["lines"]) for r in bad[:3])))
    wrong = []
    for r in rows:
        e = r["expect"]
        if not r["day"] or not r["time"]:
            wrong.append("%s shows %r, no weekday and time" % (r["match"] or r["id"], r["ko"]))
        elif not e:
            wrong.append("%r matches no home v away in data/mc_data.json" % r["match"])
        elif e["day"] != r["day"] or e["time"] != r["time"]:
            wrong.append("%s shows %s %s, the kick-off is %s %s SAST%s" % (r["match"], r["day"], r["time"], e["day"], e["time"],
                                                                        " — the time shown is UTC" if r["time"] == e["utc"] else ""))
    assert_("browser-d7-%s-odds-fixture-lines-show-the-sast-weekday-and-time" % where, not wrong,
            "%d of %d kick-offs read as their SAST weekday and time, e.g. %s %s" % (len(rows), len(rows), rows[0]["match"], rows[0]["ko"])
            if not wrong else "%d wrong: %s" % (len(wrong), "; ".join(wrong[:3])))
    return "%d Odds fixture lines, max %.3f x line-height, one line each" % (len(rows), worst["maxRatio"])


def d7_chalk(page, tab, theme, width, found):
    """D7's chalk rule on the page as it stands. Returns None when the page draws no decorative
    line (nothing to assert on this tab); otherwise asserts and returns a one-line summary."""
    res = page.evaluate(DECOR_JS, [EDGE_EPS, DECOR_CLASS_SEL])
    decor = res["decor"]
    if not decor:
        return None
    found.append((tab, theme, width, len(decor)))
    unmeasured = [d for d in decor if d.get("unmeasured")]
    drawn = [d for d in decor if not d.get("unmeasured") and d.get("visible")]
    crossing = [d for d in drawn if d.get("hits")]

    def box(d):
        b = d["box"]
        return "%s at %.0f,%.0f to %.0f,%.0f%s" % (d["sel"], b["l"], b["t"], b["r"], b["b"],
                                                  (" (clipped by %s)" % d["clip"][0]) if d.get("clip") else "")
    if crossing:
        detail = "; ".join(
            "%s crosses %d text box(es) %s%s" % (box(d), len(d["hits"]), ", ".join(repr(h["s"]) for h in d["hits"][:3]),
                                                 (", and the stroke itself crosses %d of them" % d["ring"]) if d.get("circle") else "")
            for d in crossing[:3])
    elif unmeasured:
        detail = "%d decorative pseudo-element(s) with no measurable box: %s — position it absolutely or draw it " \
                 "as a real element carrying a chalk class" % (len(unmeasured), "; ".join(
                     "%s (%s)" % (d["sel"], d["unmeasured"]) for d in unmeasured[:3]))
    else:
        detail = ("%d decorative line(s), %d drawn and %d clipped to nothing: %s; %d text boxes walked, "
                  "none inside a decorative box" % (len(decor), len(drawn), len(decor) - len(drawn),
                                                    "; ".join(box(d) for d in drawn[:3]), res["texts"]))
    assert_("browser-d7-%s-%s-chalk-lines-clear-of-text-at-%d" % (tab, theme, width),
            not crossing and not unmeasured, detail)
    return detail


# ---------------------------------------------------------------- the suite


def main():
    ap = argparse.ArgumentParser(add_help=True, description="E5 phone-render suite")
    ap.add_argument("--write-baseline", action="store_true",
                    help="re-record the BASELINE block in this file from this run")
    ap.add_argument("--mutate", default=None, help="apply one built-in mutation (proof mode)")
    ap.add_argument("--list-mutations", action="store_true")
    args = ap.parse_args()

    if args.list_mutations:
        for k in sorted(MUTATIONS):
            print("%-16s %s" % (k, MUTATIONS[k][0]))
        return

    if args.mutate is not None and args.mutate not in MUTATIONS:
        print("FAIL browser-mutation-name — no mutation called %r; try --list-mutations"
              % args.mutate)
        done()

    if not os.path.exists(INDEX):
        assert_("browser-dist-index-html-exists", False,
                INDEX + " is missing; this suite never builds it — run `node build.cjs` first")
        done()
    if not os.path.exists(CHROMIUM):
        assert_("browser-chromium-is-preinstalled", False,
                CHROMIUM + " is missing; do not run `playwright install`, the browser is "
                           "provided and PLAYWRIGHT_BROWSERS_PATH points at it")
        done()
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        assert_("browser-playwright-is-importable", False,
                "the playwright package is not importable by this python3; qa/browser.py "
                "needs Python Playwright (the Node package in fpl/node_modules is a "
                "different install)")
        done()

    os.makedirs(SHOTS, exist_ok=True)
    now_iso, ev_id = pinned_now()
    init_js = INIT_JS % json.dumps(now_iso)
    base = parse_baseline(BASELINE)
    mut_name = args.mutate
    mutating = mut_name is not None
    src_tabs, src_primary, src_problem = source_contract()
    fx_expect, fx_board = fixture_facts(ev_id, now_iso)
    first_words = {}          # (tab, theme) -> visible words at first paint
    walks = {}                # (tab, theme, width) -> overflow walk summary
    landing = {}              # theme -> the landing card as measured
    chalk_found = []          # every (tab, theme, width) that drew a decorative line
    fixture_seen = {}         # theme -> the fixture-row summary, or None when no row rendered

    stat = os.stat(INDEX)
    print("# dist/index.html %d bytes, modified %s"
          % (stat.st_size, datetime.datetime.utcfromtimestamp(stat.st_mtime).isoformat() + "Z"),
          flush=True)
    print("# clock pinned to %s (26h before the deadline of snapshot event %d)"
          % (now_iso, ev_id), flush=True)
    if mutating:
        print("# MUTATION MODE: %s — %s" % (mut_name, MUTATIONS[mut_name][0]), flush=True)

    srv, origin = serve(DIST)
    errors, aborted = [], []
    label = ["boot"]
    sigs = {}
    exercised = set()

    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch(executable_path=CHROMIUM,
                                         args=["--no-sandbox", "--disable-dev-shm-usage"])
            ver = str(browser.version)          # a property in Python Playwright, not a call
            assert_("browser-chromium-launched-from-the-preinstalled-build",
                    browser.is_connected() and re.match(r"^\d+\.", ver) is not None,
                    "chromium %s at %s" % (ver, CHROMIUM))

            sigctx = browser.new_context()
            sigpage = sigctx.new_page()
            sigpage.set_content("<!doctype html><body></body>")

            def sign(png, cols, rows):
                url = "data:image/png;base64," + base64.b64encode(png).decode("ascii")
                return sigpage.evaluate(GRID_JS, [url, cols, rows])

            def histogram(png):
                url = "data:image/png;base64," + base64.b64encode(png).decode("ascii")
                return sigpage.evaluate(HIST_JS, [url, HIST_BINS])

            tabs_seen = None

            # ---------------------------------------------- pass 1: 390x844, everything
            for theme in ("dark", "light"):
                label[0] = theme + "/boot"
                ctx, page = new_page(browser, origin, VIEW, theme, init_js, errors, aborted,
                                     label)
                proto = page.evaluate("() => location.protocol")
                assert_("browser-" + theme + "-is-served-over-http-not-a-file-url",
                        proto == "http:",
                        "location.protocol %s at %s (the service-worker path needs an origin)"
                        % (proto, origin))
                sw = page.evaluate("() => ({ calls: window.__SWCALLS__ || [], "
                                   "state: window.__PWA__ ? String(window.__PWA__.sw) : 'no __PWA__' })")
                assert_("browser-" + theme + "-registers-its-service-worker-against-the-stub",
                        sw["calls"] == ["sw.js"] and sw["state"] == "registered",
                        "register() calls %s, __PWA__.sw %s (resolved by the stub; no worker "
                        "is installed, so runs stay independent)" % (json.dumps(sw["calls"]), sw["state"]))

                # Part G: the landing card, in simple mode as the app boots, in this scheme.
                land = page.evaluate(LANDING_JS)
                landing[theme] = land
                assert_("browser-landing-%s-under-%d-words-in-at-most-%d-panels"
                        % (theme, LANDING_WORDS_GATE, LANDING_PANELS_GATE),
                        land is not None and 0 < land["words"] < LANDING_WORDS_GATE
                        and 1 <= land["panels"] <= LANDING_PANELS_GATE,
                        ("%d visible words in %d panels (gates: under %d words, at most %d panels), "
                         "simple mode at boot, prefers-color-scheme %s"
                         % (land["words"], land["panels"], LANDING_WORDS_GATE, LANDING_PANELS_GATE, theme))
                        if land else "no .landing rendered in simple mode at boot")

                mode = go_full(page)
                tabs = page.eval_on_selector_all(".tabi", "els => els.map(e => e.getAttribute('data-tab'))")
                assert_("browser-" + theme + "-full-mode-renders-a-tab-strip",
                        mode == "full" and len(tabs) > 0,
                        "data-mode %s, %d tabs discovered from the DOM: %s"
                        % (mode, len(tabs), ",".join(tabs)))
                # The walk below visits what the strip offers; this proves the strip offers what the
                # source declares, so a tab cannot drop out of the render and out of this suite together.
                assert_("browser-" + theme + "-the-strip-it-walks-is-the-source-TABS",
                        src_problem is None and tabs == src_tabs,
                        ("%d tabs in the DOM equal the %d TABS entries of %s, in order: %s"
                         % (len(tabs), len(src_tabs), os.path.relpath(APP_JSX, ROOT), ",".join(tabs)))
                        if src_problem is None else src_problem)
                if tabs_seen is None:
                    tabs_seen = list(tabs)

                for tab in tabs:
                    label[0] = theme + "/" + tab
                    before = len(errors)
                    fp = first_paint(page, tab)
                    first_words[(tab, theme)] = fp["words"]
                    want = src_primary.get(tab)
                    assert_("browser-%s-%s-first-paint-under-%d-words-with-only-its-primary-open"
                            % (tab, theme, TAB_WORDS_GATE),
                            fp["words"] < TAB_WORDS_GATE and want is not None and fp["open"] == [want],
                            "%d visible words (gate: under %d); open at first paint [%s] of %d sections, "
                            "PRIMARY %s" % (fp["words"], TAB_WORDS_GATE, ",".join(fp["open"]), fp["count"],
                                            want if want else "missing from the source's PRIMARY"))
                    secs, revs = open_everything(page, tab)
                    if mutating:
                        msg = page.evaluate(MUTATIONS[mut_name][1], fx_board)
                        page.wait_for_timeout(250)
                        print("#   mutation on %s/%s: %s" % (theme, tab, msg), flush=True)
                    view = page.get_attribute(".mc-root", "data-view")
                    info = page.evaluate(r"""() => {
                      const r = document.querySelector('.mc-root');
                      return { words: (r.innerText || '').trim().split(/\s+/).filter(Boolean).length,
                               boundary: r.querySelectorAll('.boundary').length,
                               sections: r.querySelectorAll('.section').length };
                    }""")
                    assert_("browser-%s-%s-mounts-with-visible-text" % (tab, theme),
                            view == tab and info["words"] >= WORD_FLOOR and info["boundary"] == 0,
                            "data-view %s, %d visible words (floor %d), %d sections open, "
                            "%d error boundaries" % (view, info["words"], WORD_FLOOR,
                                                     info["sections"], info["boundary"]))

                    walk = page.evaluate(WALK_JS, EDGE_EPS)
                    walks[(tab, theme, VIEW["width"])] = (len(walk["offenders"]), len(walk["excused"]),
                                                          walk["docScrollWidth"], len(walk["scrollers"]))
                    for e in walk["excused"]:
                        print("#   reachable overflow on %s/%s: %s %s edge %.2f vs viewport %d, "
                              "over %.2f, scroll reach %.2f via %s"
                              % (theme, tab, e["sel"], e["side"],
                                 e["right"] if e["side"] == "right" else e["left"],
                                 e["viewport"], e["over"], e["reach"], "; ".join(e["via"])),
                              flush=True)
                    worst = walk["offenders"][0] if walk["offenders"] else None
                    assert_("browser-%s-%s-no-unreachable-overflow-at-390" % (tab, theme),
                            not walk["offenders"],
                            ("%d element(s) escape the %dpx viewport unreachably; worst: %s "
                             "%s edge %.2f (over by %.2fpx, no scroll reach) text %r"
                             % (len(walk["offenders"]), walk["viewport"], worst["sel"], worst["side"],
                                worst["right"] if worst["side"] == "right" else worst["left"],
                                worst["over"], worst["text"]))
                            if worst else
                            ("every element inside the %dpx viewport or reachable by an inner "
                             "scroller; %d element rects walked, %d declared scroller(s), %d "
                             "reachable overflow(s); document.scrollWidth %d is printed as a "
                             "measurement, not used as the gate"
                             % (walk["viewport"],
                                page.evaluate("() => document.querySelectorAll('*').length"),
                                len(walk["scrollers"]), len(walk["excused"]), walk["docScrollWidth"])))

                    # D7, with every section and reveal open, at 390.
                    d7_chalk(page, tab, theme, VIEW["width"], chalk_found)
                    if tab == FIXTURE_TAB:
                        fixture_seen[theme] = d7_fixture_rows(
                            page, "%s-%s" % (tab, theme), fx_expect, gate=True)
                        if fixture_seen[theme] is None:
                            skip_("browser-d7-%s-%s-fixture-rows-stay-on-one-line / -show-weekday-and-time / "
                                  "-fixture-times-are-sast" % (tab, theme),
                                  "no %s row and no fixture-like list renders on the %s tab in this build "
                                  "(dist/index.html %d bytes): the Today fixture list has not landed, so there "
                                  "is no row to measure. The checks run the moment one renders"
                                  % (FIXTURE_ROW_SEL, tab, os.stat(INDEX).st_size))
                    if tab == ODDS_TAB and d7_odds_lines(page, "%s-%s" % (tab, theme), fx_expect) is None:
                        skip_("browser-d7-%s-%s-odds-fixture-lines" % (tab, theme),
                              "the %s tab renders no [data-testid=\"od-fx\"] fixture line in this build" % tab)

                    shot = page.screenshot()
                    grid = sign(shot, GRID_COLS, GRID_ROWS)
                    full = page.screenshot(full_page=True)
                    hist = histogram(full)
                    shot_path = os.path.join(SHOTS, "browser-%s-%s.png" % (tab, theme))
                    full_path = os.path.join(SHOTS, "browser-%s-%s-full.png" % (tab, theme))
                    with open(shot_path, "wb") as fh:
                        fh.write(shot)
                    with open(full_path, "wb") as fh:
                        fh.write(full)
                    assert_("browser-%s-%s-screenshot-is-a-real-iphone-raster" % (tab, theme),
                            grid["w"] == VIEW["width"] * DSF and grid["h"] == VIEW["height"] * DSF,
                            "%s is %dx%d real pixels (390x844 css at device_scale_factor %d); "
                            "full page %s is %dx%d"
                            % (os.path.basename(shot_path), grid["w"], grid["h"], DSF,
                               os.path.basename(full_path), hist["w"], hist["h"]))

                    sigs[(tab, theme)] = {"grid": grid["sig"], "hist": hist["hist"]}
                    exercised.add((tab, theme))

                    if not args.write_baseline:
                        gb = base.get(("G", tab, theme))
                        hb = base.get(("H", tab, theme))
                        if gb is None or hb is None:
                            assert_("browser-%s-%s-has-a-committed-signature" % (tab, theme), False,
                                    "no baseline line for this tab and theme; run "
                                    "`python3 qa/browser.py --write-baseline` and read the diff "
                                    "before committing it")
                        else:
                            gmax, gmean = delta(gb, grid["sig"])
                            assert_("browser-%s-%s-viewport-signature-within-tolerance" % (tab, theme),
                                    gmean <= TOL_GRID_MEAN and gmax <= TOL_GRID_MAX,
                                    "6x12 luminance grid vs baseline: mean |delta| %.2f "
                                    "(tolerance %.1f), max %.1f (tolerance %.1f)"
                                    % (gmean, TOL_GRID_MEAN, gmax, TOL_GRID_MAX))
                            hmax, hmean = delta(hb, hist["hist"])
                            assert_("browser-%s-%s-fullpage-histogram-within-tolerance" % (tab, theme),
                                    hmax <= TOL_HIST_MAX,
                                    "16-bin luminance histogram of the %dx%d full-page shot vs "
                                    "baseline: max bin |delta| %.2f pp (tolerance %.1f pp), "
                                    "mean %.3f pp" % (hist["w"], hist["h"], hmax, TOL_HIST_MAX, hmean))

                    after = [m for (lbl, m) in errors if lbl == theme + "/" + tab]
                    assert_("browser-%s-%s-raises-no-page-error" % (tab, theme),
                            len(errors) == before and not after,
                            "zero pageerror and zero console.error while the tab was on screen"
                            if len(errors) == before
                            else "%d: %s" % (len(errors) - before, " | ".join(after[:3])))

                label[0] = theme + "/self-check"
                press_self_check(page, theme)
                ctx.close()

            # ---------------------------------------------- pass 2: 320x568, the walk only
            for theme in ("dark", "light"):
                label[0] = theme + "/320"
                ctx, page = new_page(browser, origin, NARROW, theme, init_js, errors, aborted,
                                     label)
                go_full(page)
                tabs = page.eval_on_selector_all(".tabi", "els => els.map(e => e.getAttribute('data-tab'))")
                for tab in tabs:
                    label[0] = theme + "/320/" + tab
                    open_everything(page, tab)
                    if mutating:
                        page.evaluate(MUTATIONS[mut_name][1], fx_board)
                        page.wait_for_timeout(250)
                    walk = page.evaluate(WALK_JS, EDGE_EPS)
                    walks[(tab, theme, NARROW["width"])] = (len(walk["offenders"]), len(walk["excused"]),
                                                            walk["docScrollWidth"], len(walk["scrollers"]))
                    d7_chalk(page, tab, theme, NARROW["width"], chalk_found)
                    if tab == FIXTURE_TAB:
                        d7_fixture_rows(page, "%s-%s-at-%d" % (tab, theme, NARROW["width"]), fx_expect, gate=False)
                    for e in walk["excused"]:
                        print("#   reachable overflow on %s/%s at 320: %s %s edge %.2f vs "
                              "viewport %d, over %.2f, scroll reach %.2f via %s"
                              % (theme, tab, e["sel"], e["side"],
                                 e["right"] if e["side"] == "right" else e["left"],
                                 e["viewport"], e["over"], e["reach"], "; ".join(e["via"])),
                              flush=True)
                    worst = walk["offenders"][0] if walk["offenders"] else None
                    assert_("browser-%s-%s-no-unreachable-overflow-at-320" % (tab, theme),
                            not walk["offenders"],
                            ("%d element(s) escape the %dpx viewport unreachably; worst: %s "
                             "%s edge %.2f (over by %.2fpx, no scroll reach) text %r"
                             % (len(walk["offenders"]), walk["viewport"], worst["sel"], worst["side"],
                                worst["right"] if worst["side"] == "right" else worst["left"],
                                worst["over"], worst["text"]))
                            if worst else
                            ("clean at %dpx: %d declared scroller(s), %d reachable overflow(s) "
                             "excused by an inner scroller, document.scrollWidth %d"
                             % (walk["viewport"], len(walk["scrollers"]), len(walk["excused"]),
                                walk["docScrollWidth"])))
                ctx.close()

            # ---------------------------------------------- pass 3: the long clock, D7 chalk on Today
            # The countdown is the widest text a chalk circle sits beside, and the pinned clock shows
            # its shortest form. One minute after the previous deadline it is at its longest.
            long_iso = long_clock(ev_id)
            if long_iso is None:
                skip_("browser-d7-%s-long-clock-chalk-lines-clear-of-text" % FIXTURE_TAB,
                      "data/live.json has no deadline before event %d, so there is no longest countdown "
                      "to render" % ev_id)
            else:
                _unused, fx_board_long = fixture_facts(ev_id, long_iso)
                print("# long clock pinned to %s: the countdown to the event %d deadline reads %r, its "
                      "longest in this cycle" % (long_iso, ev_id, fx_board_long["left"]), flush=True)
                n_err = len(errors)
                for theme in ("dark", "light"):
                    for vp in (VIEW, NARROW):
                        label[0] = "%s/long/%d" % (theme, vp["width"])
                        ctx, page = new_page(browser, origin, vp, theme, INIT_JS % json.dumps(long_iso),
                                             errors, aborted, label)
                        go_full(page)
                        open_everything(page, FIXTURE_TAB)
                        if mutating:
                            page.evaluate(MUTATIONS[mut_name][1], fx_board_long)
                            page.wait_for_timeout(250)
                        d7_chalk(page, FIXTURE_TAB + "-long-clock", theme, vp["width"], chalk_found)
                        ctx.close()
                late = [m for (lbl, m) in errors[n_err:]]
                assert_("browser-long-clock-renders-raise-no-page-error", not late,
                        "the %s tab at %s, both schemes, %d and %d: zero pageerror and zero console.error"
                        % (FIXTURE_TAB, long_iso, VIEW["width"], NARROW["width"]) if not late else
                        "%d: %s" % (len(late), " | ".join(late[:3])))

            browser.close()
    finally:
        srv.shutdown()

    # ---------------------------------------------- cross-cutting checks
    label[0] = "global"
    assert_("browser-made-no-off-origin-request", not aborted,
            "no request left %s" % origin if not aborted
            else "%d off-origin request(s) aborted: %s" % (len(aborted), ", ".join(sorted(set(aborted))[:4])))

    # Light mode is not implemented (zero prefers-color-scheme rules in src/ui.jsx). This is
    # the tripwire the graphics audit asked for: it holds the two renders identical, so a
    # light palette cannot land without someone deciding to.
    for tab in sorted({t for (t, _th) in exercised}):
        d = sigs.get((tab, "dark")), sigs.get((tab, "light"))
        if not all(d):
            continue
        tmax, tmean = delta(d[0]["grid"], d[1]["grid"])
        hmax, _hmean = delta(d[0]["hist"], d[1]["hist"])
        assert_("browser-%s-renders-identically-in-light-and-dark" % tab,
                tmax <= TOL_THEME_MAX and hmax <= TOL_THEME_HIST,
                "dark vs light 6x12 grid: max |delta| %.1f (tolerance %.1f), mean %.2f; full-page "
                "histogram max bin |delta| %.2f pp (tolerance %.2f) — the app declares no "
                "prefers-color-scheme rule, so both must stay 0; a light palette landing here is a "
                "deliberate change, not a pass" % (tmax, TOL_THEME_MAX, tmean, hmax, TOL_THEME_HIST))
    if landing.get("dark") and landing.get("light"):
        assert_("browser-landing-reads-the-same-in-light-and-dark",
                landing["dark"]["text"] == landing["light"]["text"],
                "the landing card's visible text is identical in both schemes (%d words)"
                % landing["dark"]["words"] if landing["dark"]["text"] == landing["light"]["text"] else
                "dark %d words, light %d words: the two schemes show different decisions"
                % (landing["dark"]["words"], landing["light"]["words"]))

    # D7's chalk rule had nothing to measure anywhere: say so once, with the reason.
    if not chalk_found:
        skip_("browser-d7-chalk-lines-clear-of-text",
              "no decorative line renders on any of the %d tabs, in either scheme, at %d or %d: nothing "
              "matches %s and no ::before/::after inside .mc-root paints an empty-content border or "
              "background (the kit draws its board circles that way; the Today board has not landed in "
              "this build). The check runs on every tab the moment one renders"
              % (len(tabs_seen or []), VIEW["width"], NARROW["width"], DECOR_CLASS_SEL))

    # The measurement table the report quotes: words at first paint and the overflow walk, per tab.
    for theme in ("dark", "light"):
        print("# measured first paint, %s: %s" % (theme, ", ".join(
            "%s %d" % (t, first_words[(t, theme)]) for t in (tabs_seen or []) if (t, theme) in first_words)), flush=True)
        if landing.get(theme):
            print("# measured landing, %s: %d words in %d panels" % (theme, landing[theme]["words"],
                                                                   landing[theme]["panels"]), flush=True)
        for w in (VIEW["width"], NARROW["width"]):
            print("# measured overflow walk at %d, %s (unreachable/reachable/document scrollWidth): %s"
                  % (w, theme, ", ".join("%s %d/%d/%d" % ((t,) + walks[(t, theme, w)][:3])
                                         for t in (tabs_seen or []) if (t, theme, w) in walks)), flush=True)
    print("# measured D7: fixture rows %s; decorative lines on %d tab/scheme/width reading(s)"
          % ("; ".join("%s: %s" % (th, fixture_seen.get(th) or "none rendered") for th in ("dark", "light")),
             len(chalk_found)), flush=True)

    if args.write_baseline:
        path, lines = write_baseline(sigs)
        print("# wrote %d baseline lines for %d tab/theme pairs into %s"
              % (lines, len(sigs), path), flush=True)
        assert_("browser-baseline-recorded", lines > 0,
                "%d lines; re-run without --write-baseline to check against it" % lines)
    else:
        known = set((t, th) for (_k, t, th) in base.keys())
        missing = sorted(known - exercised)
        # An empty baseline would make this check unable to fail, so it has to be non-empty too.
        assert_("browser-every-committed-signature-was-exercised", known and not missing,
                "%d tab/theme pair(s) rendered, all %d in the baseline accounted for"
                % (len(exercised), len(known)) if (known and not missing) else
                ("the baseline block is empty, so this check proves nothing — record it with "
                 "--write-baseline" if not known else
                 "the baseline holds %s but this run never rendered it; a tab that vanished is "
                 "a regression, not a smaller suite" % ", ".join("%s/%s" % m for m in missing)))

    # The screenshots must stay untracked: the root .gitignore ignores *.png and re-includes
    # only dist/*.png, which is why the baseline above is text.
    probe = os.path.join(SHOTS, "browser-%s-dark.png" % (tabs_seen[0] if tabs_seen else "command"))
    try:
        out = subprocess.run(["git", "check-ignore", "-v", probe], cwd=ROOT,
                             capture_output=True, text=True, timeout=30)
        assert_("browser-screenshots-stay-untracked",
                out.returncode == 0 and out.stdout.strip() != "",
                "git check-ignore -v %s -> %s" % (os.path.relpath(probe, ROOT),
                                                  out.stdout.strip() or "NOT ignored (exit %d)" % out.returncode))
    except Exception as e:                                    # noqa: BLE001 - reported, not swallowed
        assert_("browser-screenshots-stay-untracked", False,
                "git check-ignore could not be run: %s" % e)

    done()


if __name__ == "__main__":
    main()
