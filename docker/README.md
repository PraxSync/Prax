# Prax Docker Image

Runs Prax using a Docker container.

## Usage

1. Create `.env` file and specify the `PORT` (refer to `.env.example`)
2. `docker compose up -d`
3. Open [http://localhost:3000](http://localhost:3000)
4. You can bring the containers down by `docker compose stop`

## Env Variables

If you want to persist your data (workflows, logs, credentials, storage), set these variables in the `.env` file inside the `docker` folder:

-   DATABASE_PATH=/root/.prax
-   LOG_PATH=/root/.prax/logs
-   SECRETKEY_PATH=/root/.prax
-   BLOB_STORAGE_PATH=/root/.prax/storage

Prax also supports additional environment variables for advanced configuration. Refer to the `.env.example` file in the root directory.

## Queue Mode

### Building from source

You can build the images for worker and main from scratch with:

```
docker compose -f docker-compose-queue-source.yml up -d
```

Monitor health:

```
docker compose -f docker-compose-queue-source.yml ps
```

### Using pre-built images

You can also use pre-built container images:

```
docker compose -f docker-compose-queue-prebuilt.yml up -d
```

Monitor health:

```
docker compose -f docker-compose-queue-prebuilt.yml ps
```
