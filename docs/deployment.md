# Deployment notes

Docker specifics a self-hoster hits after the first `docker run`: a sub-path deployment, a reverse
proxy in front, volumes and the environment file.

### Custom Base Path

If you want to serve Messer Swipe under a subpath — e.g. `https://jellyfin.example.com/swipe/` — you need to set `URL_BASE_PATH` **at image build time**, not as a runtime environment variable.

**Why?** Next.js bakes asset URLs (`/_next/static/...`) into the compiled output at build time. Setting a base path only at runtime can fix page routing but leaves all JS/CSS/image references pointing at the wrong path, breaking the app. The prefix must be known before the build.

> **The prebuilt image from `ghcr.io` does not support `URL_BASE_PATH`** — it is built without a base path. You must build your own image.

#### If you are not using compose and want to build the image

```bash
git clone https://github.com/jakobbjelver/messer-swipe.git
cd messer-swipe
docker build --build-arg URL_BASE_PATH=/swipe -t messer-swipe-custom .
```
Then use `messer-swipe-custom` as your image name in your docker run command.

#### If you are using compose, compose can build and manage the image for you at runtime

```yaml
services:
  messer-swipe:
    pull_policy: build
    build:
      context: https://github.com/jakobbjelver/messer-swipe.git
      args:
        URL_BASE_PATH: /swipe
    container_name: messer-swipe
    restart: unless-stopped
    environment:
      - JELLYFIN_URL=http://jellyfin:8096
      - URL_BASE_PATH=/swipe       # must match the --build-arg value exactly
    volumes:
      - ./messer-swipe-data:/app/data
    ports:
      - 4321:4321
```

> `URL_BASE_PATH` must also be passed as a runtime environment variable so the app generates correct internal links and auth redirects. It must match the `--build-arg` value exactly.

#### Step 3 — Configure your reverse proxy

Forward requests for the subpath to the container. The app handles stripping the prefix internally — **do not strip it in the proxy**.

**Nginx:**

```nginx
location /swipe {
    proxy_pass http://messer-swipe:4321;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

**Traefik (Docker labels):**

```yaml
labels:
  - "traefik.enable=true"
  - "traefik.http.routers.messer-swipe.rule=Host(`jellyfin.example.com`) && PathPrefix(`/swipe`)"
  - "traefik.http.routers.messer-swipe.tls=true"
```

**Caddy:**

```caddy
handle /swipe* {
    reverse_proxy messer-swipe:4321
}
```

### Reverse Proxy Configuration (root path)

**Nginx Example:**

```nginx
location / {
    proxy_pass http://messer-swipe:4321;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

**Required Headers:**
- `Host` - Required for authentication
- `X-Forwarded-For` - Client IP for logging
- `X-Forwarded-Proto` - Protocol detection

### Volume Management

```yaml
volumes:
  - ./data:/app/data          # Database & cache
  - ./logs:/app/logs          # Optional: Persist logs
```

### Environment File

Use `--env-file .env` with Docker for cleaner configuration management.
