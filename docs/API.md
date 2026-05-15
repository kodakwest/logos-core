# API

## `GET /api/status`

Returns verse and Greek parser cache counts.

## `POST /api/upload/chapter`

Body:

```json
{ "book": "Luke", "bookNumber": 42, "chapter": 1 }
```

Reads `/home/tsrwest/BTB/interlinear/{bookNumber} - {book}/{chapter}/`, upserts verses into D1, creates embeddings with Workers AI, and upserts vectors into Vectorize.

## `GET /api/verses/search`

Query params:

- `q`: optional keyword
- `book`: optional book filter
- `chapter`: optional chapter filter
- `limit`: defaults to 20

## `POST /api/verses/semantic`

Body:

```json
{ "query": "shepherds watching their flocks", "limit": 5 }
```

## `POST /api/parse/greek`

Body:

```json
{ "greek": "Ἐγένετο ἐν ταῖς ἡμέραις Ἡρῴδου" }
```
