# Deploying Swipeboxd on an Oracle VPS with Docker

The target shape: an **Oracle Cloud free-tier compute instance** (the Always Free
`A1.Flex` ARM shape is plenty — this app idles near zero) running one Docker
container behind **Caddy** for HTTPS, updated automatically by GitHub Actions
when a release tag is published.

The pipeline:

```
tag v2.6.1-swipeboxd.N pushed
  └─ GitHub Actions: tests → build amd64+arm64 → publish ghcr.io/giraycoskun/swipeboxd:<tag>+latest
       └─ deploy job: SSH to the VPS → docker compose pull && up -d → verify /api/version
```

CI (tests, typecheck, lint, the e2e contract, the docker smoke) runs on every
push to `dev` and `main` and on pull requests.

## 1. Create the instance

1. Oracle Cloud → Compute → **Create instance**.
2. Shape: **Ampere A1.Flex**, 2 OCPU / 12 GB (Always Free eligible). Image:
   **Ubuntu 24.04** (Canonical).
3. Networking: a public subnet, **assign a public IPv4**, and — if you have a
   domain — point an `A` record for e.g. `swipe.example.com` at it now.
4. Add your SSH public key at creation time. Download/save the private key.

> The Always Free AMD shape (`VM.Standard.E2.1.Micro`, 1/8 OCPU, 1 GB RAM) also
> works but is tight; prefer A1.

## 2. Open the ports — twice

Oracle closes ports in **two** places; miss either and you get connection
timeouts:

1. **VCN security list** (cloud console): VCN → Security Lists → Add ingress
   rule: source `0.0.0.0/0`, TCP, destination ports `80` and `443`.
2. **The Ubuntu firewall inside the instance** (Oracle's images ship a
   restrictive iptables set):

```bash
sudo apt-get update && sudo apt-get install -y iptables-persistent
sudo iptables -I INPUT 6 -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save
```

(Insert position 6 puts them above the `REJECT` rule — check with
`sudo iptables -L INPUT --line-numbers`.)

## 3. Install Docker and the app

```bash
# docker engine + compose plugin
curl -fsSL https://get.docker.com | sudo sh
sudo useradd -m -s /bin/bash -G docker deploy || true

sudo mkdir -p /opt/swipeboxd && sudo chown deploy:deploy /opt/swipeboxd
```

As `deploy`, create `/opt/swipeboxd/compose.yaml` — start from
[`docker-compose.example.yml`](../docker-compose.example.yml) and set at least:

```yaml
services:
  messer-swipe:
    image: ghcr.io/giraycoskun/swipeboxd:latest   # pin a v*-swipeboxd.N tag to control updates
    container_name: messer-swipe
    restart: unless-stopped
    environment:
      - PROVIDER=jellyfin            # or PROVIDER=letterboxd + LETTERBOXD_WATCHLIST_URL
      - PROVIDER_LOCK=false          # let visitors pick a source at sign-in
      - APP_PUBLIC_URL=https://swipe.example.com
      - USE_SECURE_COOKIES=true
      - DATABASE_URL=file:/app/data/swiparr.db
    volumes:
      - ./data:/app/data             # the whole state of the app — back this up
    ports:
      - 127.0.0.1:4321:4321          # loopback only; Caddy fronts the internet
```

> **Private image?** GHCR packages start private. Either flip the package to
> public (GitHub → Packages → swipeboxd → Package settings → Change visibility)
> or `docker login ghcr.io` once on the VPS with a read-scoped PAT.

Start it and check health:

```bash
docker compose up -d
docker compose logs -f        # migrations run on boot
curl -fs http://localhost:4321/api/health
```

## 4. HTTPS with Caddy

Caddy gives automatic Let's Encrypt certificates:

```bash
sudo apt-get install -y caddy
```

`/etc/caddy/Caddyfile`:

```
swipe.example.com {
    reverse_proxy 127.0.0.1:4321
}
```

```bash
sudo systemctl reload caddy
```

Because `APP_PUBLIC_URL` is set to the HTTPS domain and `USE_SECURE_COOKIES=true`,
sessions and guest-lending cookies are marked secure automatically. Caddy passes
the `Host` header through by default, which is all the app needs.

**No domain?** Skip Caddy, publish the port directly (`- 4321:4321`), and open
port 4321 in both firewalls instead. The app works over plain HTTP; only
`USE_SECURE_COOKIES` must stay `false`.

## 5. Wire up the automatic deploy

1. **Deploy key**: on the VPS, as `deploy`:
   `ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519 -N '' && cat ~/.ssh/id_ed25519.pub >> ~/.ssh/authorized_keys`
2. **Repo settings** → *Secrets and variables* → Actions:
   - **Secret** `DEPLOY_SSH_KEY`: the private key (`~/.ssh/id_ed25519`) contents.
   - **Variable** `DEPLOY_HOST`: the VPS IP or `swipe.example.com`.
   - **Variable** `DEPLOY_USER`: `deploy` (the default), and `DEPLOY_PORT` if not 22.
3. Ship: on `dev`, bump the version and tag:

```bash
git switch dev && git pull
npm version 2.6.2 --no-git-tag-version        # or edit package.json by hand
git commit -am "chore(release): prepare Swipeboxd 2.6.2"
git tag v2.6.2-swipeboxd.1
git push origin dev main --follow-tags
```

The `v*-swipeboxd.*` tag triggers the publish workflow (native amd64 **and**
arm64 builds — no QEMU), then the deploy job SSHes in, pulls, restarts, and
fails the run unless `/api/version` on the VPS answers the new version.

No deploy variables configured? The deploy job skips and the image is simply
published — update by hand with `docker compose pull && docker compose up -d`.

## 6. Day two

- **Backups**: everything lives in `/opt/swipeboxd/data` (SQLite + the auth
  secret + the agent token). `cp` or `rsync` it somewhere off the box; SQLite
  is hot-copy-safe while the app runs.
- **Logs**: `docker compose logs -f messer-swipe`; `docker exec messer-swipe messer-swipe status --human` for a health summary.
- **Updates**: push a new tag, or run the "Publish Swipeboxd Image" workflow again after deleting the old tag run.
- **Oracle idle-reclaim**: Always Free A1 instances that idle under a tiny CPU
  threshold for 7 days *may* be reclaimed. This app is idle by design — if the
  instance matters, keep a small load or convert to Pay-As-You-Go (still free
  within the Always Free limits).
