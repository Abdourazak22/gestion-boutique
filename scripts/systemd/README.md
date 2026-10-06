# Sauvegarde planifiée

Trois unités systemd « utilisateur » qui font tourner `../sauvegarde.sh` une
fois par jour, avec rotation sur sept jours et alerte en cas d'échec.

## Installation

Les unités sont liées depuis le dépôt, pas copiées : une correction ici se
répercute après un simple `daemon-reload`, sans risque de divergence entre le
dépôt et `~/.config`.

```sh
mkdir -p ~/.config/systemd/user
ln -sf "$PWD"/sauvegarde-boutique.service       ~/.config/systemd/user/
ln -sf "$PWD"/sauvegarde-boutique.timer         ~/.config/systemd/user/
ln -sf "$PWD"/sauvegarde-boutique-echec.service ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable --now sauvegarde-boutique.timer
```

`ExecStart` vaut `%h/Test/backend/scripts/sauvegarde.sh` : si le projet est
déplacé, corriger ce chemin.

## Vérifier

```sh
systemctl --user list-timers sauvegarde-boutique.timer   # prochain déclenchement
systemctl --user start sauvegarde-boutique.service       # lancer tout de suite
journalctl --user -u sauvegarde-boutique -n 30           # ce qu'elle a fait
```

## Deux limites à connaître

**1. La minuterie ne tourne que session ouverte.** `Linger=no` pour cet
utilisateur : le gestionnaire systemd utilisateur s'arrête à la déconnexion, et
la minuterie avec lui. `Persistent=true` rattrape la sauvegarde manquée au
prochain démarrage de session, donc rien n'est perdu tant que la session est
ouverte au moins une fois par jour. Pour que la sauvegarde ait lieu même sans
session ouverte :

```sh
loginctl enable-linger cheick
```

**2. Même disque que `$HOME`.** La destination par défaut
(`~/sauvegardes/boutique`) protège de la fausse manoeuvre — un `DELETE` de trop,
un schéma modifié à la main — mais pas d'une panne du disque. Le script le
signale à chaque exécution. Pour une vraie protection, décommenter
`BOUTIQUE_SAUVEGARDES` dans le `.service` et le pointer vers un disque externe.

## Restaurer

C'est l'étape qui compte. Elle a été testée : dump restauré dans une base
jetable, les six tables et l'empreinte du contenu des ventes identiques à la
production.

```sh
# 1. Repérer la sauvegarde
ls -lt ~/sauvegardes/boutique/

# 2. Vérifier qu'elle est lisible avant de toucher à quoi que ce soit
pg_restore --list ~/sauvegardes/boutique/boutique-AAAA-MM-JJ-HHMMSS.dump

# 3. Restaurer dans une base jetable d'abord, jamais directement en production
psql -h localhost -U boutique -d boutique_test -c \
    'drop schema public cascade; create schema public;'
pg_restore -h localhost -U boutique -d boutique_test --no-owner --no-privileges \
    ~/sauvegardes/boutique/boutique-AAAA-MM-JJ-HHMMSS.dump

# 4. Contrôler le contenu, puis seulement ensuite viser la vraie base
```

Le rôle `boutique` n'a pas `CREATEDB` : on restaure dans une base existante
(`boutique_test`), on n'en crée pas une à la volée.
