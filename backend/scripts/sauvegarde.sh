#!/usr/bin/env bash
#
# Sauvegarde de la base de la boutique, avec rotation.
#
# Pensé pour être lancé par une minuterie systemd, mais exécutable à la main :
#   ./scripts/sauvegarde.sh
#
# L'authentification passe par ~/.pgpass (mode 600), jamais par un mot de passe
# écrit ici ou laissé dans l'historique du shell.
#
# Variables reconnues :
#   BOUTIQUE_SAUVEGARDES  répertoire de destination
#   BOUTIQUE_RETENTION    nombre de sauvegardes conservées
#   BOUTIQUE_BASE         nom de la base
#   BOUTIQUE_HOTE         hôte PostgreSQL
#   BOUTIQUE_UTILISATEUR  rôle PostgreSQL
set -euo pipefail

DESTINATION="${BOUTIQUE_SAUVEGARDES:-$HOME/sauvegardes/boutique}"
RETENTION="${BOUTIQUE_RETENTION:-7}"
BASE="${BOUTIQUE_BASE:-boutique}"
HOTE="${BOUTIQUE_HOTE:-localhost}"
UTILISATEUR="${BOUTIQUE_UTILISATEUR:-boutique}"

horodatage() { date '+%Y-%m-%d %H:%M:%S'; }
journal() { printf '%s  %s\n' "$(horodatage)" "$*"; }
echec() { journal "ECHEC : $*" >&2; exit 1; }

mkdir -p "$DESTINATION"

# Format « custom » : compressé, et restaurable sélectivement avec pg_restore.
FICHIER="$DESTINATION/${BASE}-$(date '+%Y-%m-%d-%H%M%S').dump"

# Flux d'erreur de pg_dump, recopié ensuite dans le journal. Sans cette
# capture, le diagnostic qui explique l'échec (« database does not exist »,
# « no space left on device ») dépend du StandardError= de l'appelant et se
# perd justement quand on en a besoin.
ERREURS="$(mktemp)"

# Le fichier temporaire ne doit jamais survivre à un échec : pg_dump le crée
# avant d'échouer, et la rotation plus bas ne connaît que les « *.dump ». Sans
# ce nettoyage chaque échec laisserait un résidu que rien ne ramasse jamais.
# Un trap sur EXIT plutôt qu'un rm après chaque erreur : il couvre aussi
# l'interruption au clavier et le dépassement de TimeoutStartSec.
nettoyer() { rm -f "$FICHIER.partiel" "$ERREURS"; }
trap nettoyer EXIT

# Recopie le flux d'erreur dans le journal, en le décalant pour qu'on voie
# d'un coup d'oeil ce qui vient de pg_dump et ce qui vient d'ici.
reporter_erreurs() {
    if [ -s "$ERREURS" ]; then
        while IFS= read -r ligne; do journal "    $ligne"; done < "$ERREURS"
    fi
}

journal "Sauvegarde de « $BASE » vers $FICHIER"

# --- Avertissement : une sauvegarde sur le même disque ne protège pas d'une
# panne de ce disque. Elle couvre la fausse manoeuvre, pas la panne matérielle.
if [ "$(df --output=source "$DESTINATION" | tail -1)" = "$(df --output=source "$HOME" | tail -1)" ]; then
    journal "AVERTISSEMENT : destination sur le même système de fichiers que \$HOME."
    journal "                Protège d'une fausse manoeuvre, pas d'une panne de disque."
    journal "                Pointer BOUTIQUE_SAUVEGARDES vers un disque externe."
fi

# --format=custom --compress : un seul fichier, compressé.
# --no-owner --no-privileges : restaurable sur une instance aux rôles différents.
if ! pg_dump \
    --host="$HOTE" \
    --username="$UTILISATEUR" \
    --dbname="$BASE" \
    --format=custom \
    --compress=9 \
    --no-owner \
    --no-privileges \
    --file="$FICHIER.partiel" \
    2>"$ERREURS"
then
    reporter_erreurs
    echec "pg_dump a échoué, aucune sauvegarde produite"
fi

# pg_dump peut réussir en ayant tout de même quelque chose à dire.
reporter_erreurs

# --- Contrôle d'intégrité AVANT de publier le fichier.
# Un dump tronqué par un disque plein ou une coupure ressemble à un fichier
# valide. Le relire est le seul moyen de savoir. Le nom définitif n'est posé
# qu'après ce contrôle : ainsi le répertoire ne contient jamais de sauvegarde
# non vérifiée.
if ! pg_restore --list "$FICHIER.partiel" > /dev/null 2>"$ERREURS"; then
    reporter_erreurs
    echec "le dump produit est illisible, il a été supprimé"
fi

mv "$FICHIER.partiel" "$FICHIER"

TAILLE=$(du -h "$FICHIER" | cut -f1)
TABLES=$(pg_restore --list "$FICHIER" | grep -c 'TABLE DATA' || true)
journal "Sauvegarde vérifiée : $TAILLE, $TABLES table(s) de données"

# --- Rotation : on garde les N plus récentes, on supprime au-delà.
# Supprimé après la nouvelle sauvegarde, jamais avant : une rotation qui passe
# en premier laisserait un trou si le dump venait à échouer.
mapfile -t ANCIENNES < <(ls -1t "$DESTINATION/${BASE}-"*.dump 2>/dev/null | tail -n +"$((RETENTION + 1))")
if [ "${#ANCIENNES[@]}" -gt 0 ]; then
    for vieille in "${ANCIENNES[@]}"; do
        journal "Rotation : suppression de $(basename "$vieille")"
        rm -f "$vieille"
    done
fi

CONSERVEES=$(ls -1 "$DESTINATION/${BASE}-"*.dump 2>/dev/null | wc -l)
journal "Terminé. $CONSERVEES sauvegarde(s) conservée(s) sur $RETENTION."
