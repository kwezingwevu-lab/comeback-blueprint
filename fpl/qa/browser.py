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

    It also presses the app's own check report and asserts what it says, and it proves the
    dark and light renders are identical, which is the assertion the graphics audit asked
    for (light mode is not implemented; this is the tripwire that stops one landing
    silently).

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
       copy on every run and the signature baseline would become a clock — E-084's class.

RUN
    python3 qa/browser.py                     the suite
    python3 qa/browser.py --write-baseline    re-record the baseline block in this file
    python3 qa/browser.py --mutate wide       inject a wide element (the overflow proof)
    python3 qa/browser.py --mutate invert     invert the palette (the signature proof)
    python3 qa/browser.py --list-mutations

    Output: PASS/FAIL per check with the measured value, then "SUITE browser <pass>/<total>".
    Exit 1 on any FAIL, and on a total of zero — a suite that asserted nothing is a failure,
    not a green line (E-052).

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
TOL_THEME_MAX = 1.0      # dark vs light, measured 0.0 on all seven tabs
EDGE_EPS = 0.5           # sub-pixel slack on a rect edge comparison
WORD_FLOOR = 40          # an empty shell is 0 words; the thinnest tab measured 322

# ---------------------------------------------------------------- BASELINE START
# Generated by `python3 qa/browser.py --write-baseline`. Text, because qa/shots/*.png is
# ignored by the repository root and a golden image cannot be committed here.
#   G <tab> <theme> <GRID_COLS*GRID_ROWS mean luminances, row-major, one decimal>
#   H <tab> <theme> <HIST_BINS area percentages of the full-page shot, two decimals>
BASELINE = r"""
G chips dark 35.7,40.7,39.7,40.7,26.1,33.3,27.4,33.4,23.7,23.7,23.7,27.8,28.7,32.7,33.7,33.7,33.5,30.0,31.5,32.4,32.7,32.7,32.6,26.7,21.4,23.6,20.7,20.7,20.7,18.8,24.7,24.4,23.7,28.7,30.7,27.6,22.7,23.7,23.7,23.7,27.7,24.4,24.4,25.4,25.4,24.4,24.4,25.7,37.9,43.5,42.5,42.8,43.5,31.6,30.6,36.6,33.5,28.8,29.7,24.7,29.7,36.5,37.5,35.7,30.7,25.6,32.4,39.5,40.5,40.5,39.5,26.6
H chips dark 14.75,68.03,12.16,0.42,0.31,0.24,0.46,0.30,0.36,0.57,1.60,0.11,0.05,0.06,0.58,0.00
G chips light 35.7,40.7,39.7,40.7,26.1,33.3,27.4,33.4,23.7,23.7,23.7,27.8,28.7,32.7,33.7,33.7,33.5,30.0,31.5,32.4,32.7,32.7,32.6,26.7,21.4,23.6,20.7,20.7,20.7,18.8,24.7,24.4,23.7,28.7,30.7,27.6,22.7,23.7,23.7,23.7,27.7,24.4,24.4,25.4,25.4,24.4,24.4,25.7,37.9,43.5,42.5,42.8,43.5,31.6,30.6,36.6,33.5,28.8,29.7,24.7,29.7,36.5,37.5,35.7,30.7,25.6,32.4,39.5,40.5,40.5,39.5,26.6
H chips light 14.75,68.03,12.16,0.42,0.31,0.24,0.46,0.30,0.36,0.57,1.60,0.11,0.05,0.06,0.58,0.00
G command dark 29.0,43.2,42.6,43.7,40.7,34.6,33.6,46.6,40.7,41.8,42.8,29.9,30.5,41.7,40.7,37.7,36.7,28.8,32.8,51.7,48.7,48.9,44.9,27.8,36.7,62.7,58.7,32.7,32.7,27.6,28.8,35.9,33.9,29.7,29.7,25.8,29.4,35.5,35.5,34.7,35.4,26.6,30.7,39.5,39.5,38.5,37.5,23.6,30.7,38.5,39.5,36.5,33.7,26.6,31.6,37.4,30.7,27.7,25.7,22.6,31.7,39.5,36.5,36.5,36.6,28.7,25.7,29.5,28.7,28.7,25.7,22.6
H command dark 12.50,65.14,17.51,0.38,0.25,0.23,0.39,0.26,0.31,0.45,1.24,0.12,0.08,0.10,1.01,0.00
G command light 29.0,43.2,42.6,43.7,40.7,34.6,33.6,46.6,40.7,41.8,42.8,29.9,30.5,41.7,40.7,37.7,36.7,28.8,32.8,51.7,48.7,48.9,44.9,27.8,36.7,62.7,58.7,32.7,32.7,27.6,28.8,35.9,33.9,29.7,29.7,25.8,29.4,35.5,35.5,34.7,35.4,26.6,30.7,39.5,39.5,38.5,37.5,23.6,30.7,38.5,39.5,36.5,33.7,26.6,31.6,37.4,30.7,27.7,25.7,22.6,31.7,39.5,36.5,36.5,36.6,28.7,25.7,29.5,28.7,28.7,25.7,22.6
H command light 12.50,65.14,17.51,0.38,0.25,0.23,0.39,0.26,0.31,0.45,1.24,0.12,0.08,0.10,1.01,0.00
G draft dark 35.9,41.9,41.1,34.5,37.7,34.7,25.9,26.6,26.2,23.7,23.7,23.6,25.9,31.9,25.2,23.7,23.7,25.7,25.5,27.4,29.2,23.7,23.7,24.6,25.1,24.9,24.7,24.7,24.7,22.6,29.7,37.8,38.7,37.8,35.7,27.5,27.6,32.7,31.7,33.4,28.4,21.6,28.6,34.7,32.7,33.5,35.7,22.5,29.4,36.5,35.5,37.5,31.5,23.6,27.6,31.7,24.7,25.7,24.7,22.6,27.7,33.7,27.7,27.7,28.4,24.6,29.6,40.6,25.7,24.7,23.6,21.6
H draft dark 15.81,67.58,11.54,0.40,0.30,0.26,0.44,0.37,0.49,0.53,1.49,0.12,0.05,0.05,0.57,0.00
G draft light 35.9,41.9,41.1,34.5,37.7,34.7,25.9,26.6,26.2,23.7,23.7,23.6,25.9,31.9,25.2,23.7,23.7,25.7,25.5,27.4,29.2,23.7,23.7,24.6,25.1,24.9,24.7,24.7,24.7,22.6,29.7,37.8,38.7,37.8,35.7,27.5,27.6,32.7,31.7,33.4,28.4,21.6,28.6,34.7,32.7,33.5,35.7,22.5,29.4,36.5,35.5,37.5,31.5,23.6,27.6,31.7,24.7,25.7,24.7,22.6,27.7,33.7,27.7,27.7,28.4,24.6,29.6,40.6,25.7,24.7,23.6,21.6
H draft light 15.81,67.58,11.54,0.40,0.30,0.26,0.44,0.37,0.49,0.53,1.49,0.12,0.05,0.05,0.57,0.00
G lab dark 36.7,41.7,39.6,40.7,40.0,28.0,26.6,24.4,24.4,26.4,35.7,30.6,27.4,33.4,26.4,23.7,23.7,27.6,28.7,34.5,26.4,32.4,34.4,24.7,31.6,36.7,23.7,34.4,37.7,28.1,26.6,29.7,23.7,27.7,30.7,24.9,24.6,23.7,25.7,23.7,23.7,23.7,27.7,27.4,29.4,24.7,23.7,24.7,28.7,27.7,28.7,25.4,23.7,25.7,27.4,30.4,29.4,25.7,24.4,24.7,26.6,27.7,24.7,26.7,27.4,24.7,26.7,23.7,23.7,23.7,29.5,23.7
H lab dark 11.20,74.67,8.66,0.36,0.29,0.24,0.34,0.31,0.43,0.50,1.42,0.89,0.06,0.06,0.57,0.00
G lab light 36.7,41.7,39.6,40.7,40.0,28.0,26.6,24.4,24.4,26.4,35.7,30.6,27.4,33.4,26.4,23.7,23.7,27.6,28.7,34.5,26.4,32.4,34.4,24.7,31.6,36.7,23.7,34.4,37.7,28.1,26.6,29.7,23.7,27.7,30.7,24.9,24.6,23.7,25.7,23.7,23.7,23.7,27.7,27.4,29.4,24.7,23.7,24.7,28.7,27.7,28.7,25.4,23.7,25.7,27.4,30.4,29.4,25.7,24.4,24.7,26.6,27.7,24.7,26.7,27.4,24.7,26.7,23.7,23.7,23.7,29.5,23.7
H lab light 11.20,74.67,8.66,0.36,0.29,0.24,0.34,0.31,0.43,0.50,1.42,0.89,0.06,0.06,0.57,0.00
G plan dark 36.3,28.4,39.6,42.7,41.7,36.7,29.7,35.5,31.5,31.7,31.4,24.9,29.5,34.7,23.6,22.6,22.6,21.6,28.7,32.7,29.7,23.7,23.7,29.7,25.7,24.7,23.7,23.7,23.7,29.7,22.7,25.4,24.4,23.7,23.7,23.9,23.6,23.7,24.4,24.4,23.7,22.7,25.4,25.9,26.9,28.2,23.7,24.9,23.7,25.9,26.9,30.0,24.4,25.6,25.6,29.2,30.2,31.7,28.4,25.1,31.7,39.5,40.5,33.7,33.7,25.6,27.6,32.4,30.4,29.4,28.4,24.4
H plan dark 10.35,72.79,12.19,0.36,0.28,0.23,0.32,0.27,0.35,0.47,1.21,0.19,0.08,0.09,0.81,0.00
G plan light 36.3,28.4,39.6,42.7,41.7,36.7,29.7,35.5,31.5,31.7,31.4,24.9,29.5,34.7,23.6,22.6,22.6,21.6,28.7,32.7,29.7,23.7,23.7,29.7,25.7,24.7,23.7,23.7,23.7,29.7,22.7,25.4,24.4,23.7,23.7,23.9,23.6,23.7,24.4,24.4,23.7,22.7,25.4,25.9,26.9,28.2,23.7,24.9,23.7,25.9,26.9,30.0,24.4,25.6,25.6,29.2,30.2,31.7,28.4,25.1,31.7,39.5,40.5,33.7,33.7,25.6,27.6,32.4,30.4,29.4,28.4,24.4
H plan light 10.35,72.79,12.19,0.36,0.28,0.23,0.32,0.27,0.35,0.47,1.21,0.19,0.08,0.09,0.81,0.00
G rivals dark 37.6,40.7,34.9,34.9,40.9,35.4,25.6,24.4,24.4,24.4,31.7,23.4,27.6,23.7,23.7,23.7,32.7,24.1,30.5,23.7,23.7,23.7,36.7,25.6,29.7,35.8,34.5,30.4,28.4,23.7,22.8,26.9,24.6,21.9,21.9,20.8,25.9,26.7,25.7,23.7,23.7,25.3,25.6,29.7,24.7,23.7,23.7,23.2,30.6,35.4,32.4,25.4,23.7,24.1,31.7,35.7,36.7,25.4,24.7,24.9,20.5,21.6,21.6,21.6,21.6,19.5,27.7,28.7,27.5,19.7,19.7,21.5
H rivals dark 14.81,75.84,5.84,0.23,0.16,0.16,0.35,0.17,0.27,0.26,0.57,0.14,0.10,0.11,0.99,0.00
G rivals light 37.6,40.7,34.9,34.9,40.9,35.4,25.6,24.4,24.4,24.4,31.7,23.4,27.6,23.7,23.7,23.7,32.7,24.1,30.5,23.7,23.7,23.7,36.7,25.6,29.7,35.8,34.5,30.4,28.4,23.7,22.8,26.9,24.6,21.9,21.9,20.8,25.9,26.7,25.7,23.7,23.7,25.3,25.6,29.7,24.7,23.7,23.7,23.2,30.6,35.4,32.4,25.4,23.7,24.1,31.7,35.7,36.7,25.4,24.7,24.9,20.5,21.6,21.6,21.6,21.6,19.5,27.7,28.7,27.5,19.7,19.7,21.5
H rivals light 14.81,75.84,5.84,0.23,0.16,0.16,0.35,0.17,0.27,0.26,0.57,0.14,0.10,0.11,0.99,0.00
G squad dark 36.6,41.7,34.7,41.7,37.7,33.9,27.9,28.5,23.7,23.7,23.4,25.6,32.4,34.5,27.7,26.2,23.7,27.6,26.7,28.7,26.7,26.2,24.1,23.1,31.6,37.7,27.4,23.7,23.7,27.7,27.7,33.5,32.7,32.5,29.4,23.9,24.9,27.7,22.6,22.6,22.6,21.5,27.7,31.4,31.4,23.7,23.7,21.9,26.9,24.7,24.7,23.7,23.7,23.3,30.6,32.7,31.4,25.4,24.7,22.8,20.5,23.6,21.8,21.6,21.6,19.5,28.6,30.7,23.7,23.7,29.9,25.6
H squad dark 15.73,75.51,4.81,0.31,0.20,0.18,0.46,0.20,0.31,0.38,1.01,0.11,0.06,0.06,0.65,0.00
G squad light 36.6,41.7,34.7,41.7,37.7,33.9,27.9,28.5,23.7,23.7,23.4,25.6,32.4,34.5,27.7,26.2,23.7,27.6,26.7,28.7,26.7,26.2,24.1,23.1,31.6,37.7,27.4,23.7,23.7,27.7,27.7,33.5,32.7,32.5,29.4,23.9,24.9,27.7,22.6,22.6,22.6,21.5,27.7,31.4,31.4,23.7,23.7,21.9,26.9,24.7,24.7,23.7,23.7,23.3,30.6,32.7,31.4,25.4,24.7,22.8,20.5,23.6,21.8,21.6,21.6,19.5,28.6,30.7,23.7,23.7,29.9,25.6
H squad light 15.73,75.51,4.81,0.31,0.20,0.18,0.46,0.20,0.31,0.38,1.01,0.11,0.06,0.06,0.65,0.00
"""
# ---------------------------------------------------------------- BASELINE END

# ---------------------------------------------------------------- counters


class Counters(object):
    def __init__(self):
        self.pas = 0
        self.fail = 0
        self.failures = []


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


def done(suite="browser"):
    total = C.pas + C.fail
    if total == 0:
        print("FAIL " + suite + " — the suite recorded no assertions at all (it threw or "
              "returned before its first check); 0/0 is not a pass", flush=True)
        print("SUITE " + suite + " 0/0", flush=True)
        sys.exit(1)
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
    "blank": (
        "empties the mounted root, which the visible-text check must fire on",
        "() => { const r = document.querySelector('.mc-root'); if (!r) return 'no .mc-root'; "
        "for (const k of [...r.children]) { if (k.tagName !== 'STYLE') k.remove(); } "
        "return 'emptied .mc-root'; }"
    ),
}


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
                mode = go_full(page)
                tabs = page.eval_on_selector_all(".tabi", "els => els.map(e => e.getAttribute('data-tab'))")
                assert_("browser-" + theme + "-full-mode-renders-a-tab-strip",
                        mode == "full" and len(tabs) > 0,
                        "data-mode %s, %d tabs discovered from the DOM: %s"
                        % (mode, len(tabs), ",".join(tabs)))
                if tabs_seen is None:
                    tabs_seen = list(tabs)

                for tab in tabs:
                    label[0] = theme + "/" + tab
                    before = len(errors)
                    secs, revs = open_everything(page, tab)
                    if mutating:
                        msg = page.evaluate(MUTATIONS[mut_name][1])
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
                        page.evaluate(MUTATIONS[mut_name][1])
                        page.wait_for_timeout(250)
                    walk = page.evaluate(WALK_JS, EDGE_EPS)
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
        assert_("browser-%s-renders-identically-in-light-and-dark" % tab,
                tmax <= TOL_THEME_MAX,
                "dark vs light 6x12 grid: max |delta| %.1f (tolerance %.1f), mean %.2f — the "
                "app declares no prefers-color-scheme rule, so this must stay 0; a light "
                "palette landing here is a deliberate change, not a pass"
                % (tmax, TOL_THEME_MAX, tmean))

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
