#!/bin/sh
# Usage: sh scripts/pdf-compare.sh <baselineDir> <afterDir> [--light-ref]
set -eu
A="$1"; B="$2"; REF="${3:-}"; W=$(mktemp -d); FAIL=0
trap 'rm -rf "$W"' EXIT HUP INT TERM
[ -d "$A" ] && [ -d "$B" ] || { echo "MISSING DIR"; exit 1; }
# Baseline and after must contain the same non-empty case set.
find "$A" -type f -name '*.pdf' -exec basename {} \; | sort > "$W/a-files"
find "$B" -type f -name '*.pdf' -exec basename {} \; | sort > "$W/b-files"
[ -s "$W/a-files" ] && [ -s "$W/b-files" ] || { echo "EMPTY PDF SET"; exit 1; }
cmp -s "$W/a-files" "$W/b-files" || { echo "MISSING OR EXTRA PDF CASE"; exit 1; }
for b in "$B"/*.pdf; do
  n=$(basename "$b" .pdf); r="$n"
  [ "$REF" = "--light-ref" ] && r=$(echo "$n" | sed 's/-dark$/-light/')
  a="$A/$r.pdf"; [ -f "$a" ] || { echo "MISSING baseline $r"; FAIL=1; continue; }
  pdfinfo "$a" > "$W/info-a" || { echo "TOOL ERROR pdfinfo $a"; exit 1; }
  pdfinfo "$b" > "$W/info-b" || { echo "TOOL ERROR pdfinfo $b"; exit 1; }
  pa=$(awk '/^Pages/{print $2}' "$W/info-a"); pb=$(awk '/^Pages/{print $2}' "$W/info-b")
  case "$pa:$pb" in *[!0-9:]*|:*) echo "INVALID PAGE COUNT"; exit 1;; esac
  [ "${pa:-0}" -gt 0 ] && [ "${pb:-0}" -gt 0 ] || { echo "INVALID PAGE COUNT"; exit 1; }
  [ "$pa" = "$pb" ] || { echo "PAGES $n: $pa vs $pb"; FAIL=1; }
  pdftotext -layout "$a" "$W/a.txt" || { echo "TOOL ERROR pdftotext $a"; exit 1; }
  pdftotext -layout "$b" "$W/b.txt" || { echo "TOOL ERROR pdftotext $b"; exit 1; }
  cmp -s "$W/a.txt" "$W/b.txt" || { echo "TEXT $n differs"; FAIL=1; }
  pdffonts "$a" > "$W/font-a" || { echo "TOOL ERROR pdffonts $a"; exit 1; }
  pdffonts "$b" > "$W/font-b" || { echo "TOOL ERROR pdffonts $b"; exit 1; }
  tail -n +3 "$W/font-a" | awk '{print $1}' | sed 's/^[A-Z]\{6\}+//' | sort > "$W/fa"
  tail -n +3 "$W/font-b" | awk '{print $1}' | sed 's/^[A-Z]\{6\}+//' | sort > "$W/fb"
  cmp -s "$W/fa" "$W/fb" || { echo "FONTS $n differ"; FAIL=1; }
  pdftoppm -r 150 -png "$a" "$W/$n-a" || { echo "TOOL ERROR pdftoppm $a"; exit 1; }
  pdftoppm -r 150 -png "$b" "$W/$n-b" || { echo "TOOL ERROR pdftoppm $b"; exit 1; }
  for pa_png in "$W/$n-a"-*.png; do
    [ -f "$pa_png" ] || { echo "MISSING RENDERED PAGE"; exit 1; }
    pb_png=$(echo "$pa_png" | sed 's/-a-\([0-9]*\)\.png$/-b-\1.png/')
    [ -f "$pb_png" ] || { echo "MISSING PAGE $pb_png"; FAIL=1; continue; }
    page=$(basename "$pa_png" .png)
    metric="$W/metric"
    status=0
    magick compare -metric AE "$pa_png" "$pb_png" "$B/$page-diff.png" > /dev/null 2> "$metric" || status=$?
    [ "$status" -le 1 ] || { cat "$metric"; echo "COMPARE ERROR"; exit 1; }
    ae=$(awk '{print $1}' "$metric")
    echo "$n $(basename "$pa_png") AE=$ae"
    [ "$ae" = "0" ] || FAIL=1
  done
done
rm -rf "$W"; [ $FAIL -eq 0 ] && echo "ALL IDENTICAL" || { echo "DIFFERENCES FOUND"; exit 1; }
