#!/bin/zsh
# Foto delle ricette fatte con ChatGPT → public/recipes (JPG quadrato 560×560, come le altre).
# Uso: scripts/importa-foto-ricette.sh [cartella sorgente] [cartella destinazione]
# Prende solo i nomi che l'app aspetta (elenco in docs/immagini-ricette.md); gli altri file li ignora.
set -e
SRC="${1:-$HOME/Downloads/ricette}"
ROOT="${0:A:h:h}"
DEST="${2:-$ROOT/public/recipes}"
NAMES=($(grep -oE '`[a-z0-9-]+\.png`' "$ROOT/docs/immagini-ricette.md" | tr -d '`' | sed 's/\.png$//'))
done_n=0; skip_n=0
for f in "$SRC"/*.(png|PNG|jpg|jpeg|JPG|webp)(N); do
  name="${${f:t}%.*}"
  if (( ! ${NAMES[(Ie)$name]} )); then echo "salto $f:t (nome non in elenco)"; skip_n=$((skip_n+1)); continue; fi
  tmp="$(mktemp -t ricetta).jpg"
  # ritaglio quadrato al centro, poi 560×560, JPG qualità 80
  w=$(sips -g pixelWidth "$f" | awk '/pixelWidth/{print $2}'); h=$(sips -g pixelHeight "$f" | awk '/pixelHeight/{print $2}')
  side=$(( w < h ? w : h ))
  sips -s format jpeg -s formatOptions 80 --cropToHeightWidth "$side" "$side" "$f" --out "$tmp" >/dev/null
  sips -z 560 560 "$tmp" --out "$DEST/$name.jpg" >/dev/null
  rm -f "$tmp"
  echo "ok $name.jpg"; done_n=$((done_n+1))
done
echo "importate $done_n foto, saltate $skip_n; ne mancano $(for n in $NAMES; do [[ -f "$DEST/$n.jpg" ]] || echo $n; done | wc -l | tr -d ' ')"
