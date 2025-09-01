# Użycie:
#   make dev
#   make migrate
#   make backup DB=postgres://user:pass@host:5432/centrum
#   make restore DB=... FILE=./backups/db-YYYYMMDD-HHMMSS.sql.gz
#   make up (docker compose)
#   make down

.PHONY: dev migrate backup restore up down

dev:
	cd server && npm i && npm run dev

migrate:
	cd server && npm i && npm run db:migrate

backup:
	./scripts/pg-backup.sh $(DB)

restore:
	./scripts/pg-restore.sh $(DB) $(FILE)

up:
	docker compose up --build

down:
	docker compose down
