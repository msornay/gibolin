# Deploying to VPS

Docker-based deployment via git push. Accessed via SSH tunnel.

## Prerequisites

A VPS with Docker and Docker Compose installed. SSH access configured as `vps` in `~/.ssh/config`.

## 1. First-time setup

```bash
make setup-vps
```

This creates a bare git repo on the VPS, installs the post-receive hook, and adds the `vps` git remote locally.

Then place the env file on the VPS:

```bash
scp .env.prod.example vps:~/gibolin/.env.prod
ssh vps 'nano ~/gibolin/.env.prod'
```

Generate a secret key for the env file:

```bash
python3 -c 'import secrets; print(secrets.token_urlsafe(50))'
```

## 2. Deploy

```bash
make deploy
```

This pushes to the VPS bare repo. The post-receive hook checks out the code, builds the Docker image, and restarts the stack. The Makefile then waits for the healthcheck to pass.

## 3. Create a superuser

```bash
make prod-createsuperuser
```

## 4. Access the app

```bash
ssh -L 8000:localhost:8000 vps
```

Open http://localhost:8000/. Log in via http://localhost:8000/backoffice/.

## Operations

```bash
make prod-logs        # tail logs
make prod-shell       # Django shell
make prod-up          # start
make prod-down        # stop
```

## Database

Data lives on the host filesystem at `~/gibolin/data/postgres/`. Back it up with:

```bash
ssh vps 'cd ~/gibolin && docker compose -f docker-compose.prod.yml exec postgres pg_dump -U gibolin gibolin > backup.sql'
```
