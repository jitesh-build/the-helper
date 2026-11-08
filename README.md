# Hammer Jam Planner (Clash of Clans)

## Setup
1. Create a free MongoDB Atlas cluster -> Database Access (create a user) -> Network Access (allow your IP).
2. Copy the SRV connection string.
3. `cp server/.env.example server/.env` and paste it into MONGODB_URI.
4. `npm install && npm run install:all`
5. `npm run seed`   (loads server/data/seed.json - placeholder data!)
6. `npm run dev`    -> client http://localhost:5173, API http://localhost:4000

## Importing real data
Create a JSON array in this shape (time in MINUTES) and run
`npm --prefix server run seed -- path/to/file.json`

[{ "name": "Cannon", "category": "Defense", "level": 20, "kind": "builder",
   "resource": "gold", "baseMinutes": 20160, "baseCost": 5000000 }]

kind: "builder" | "lab"      resource: "gold" | "elixir" | "darkElixir"
Rows are upserted by (name, level, kind), so re-running is safe.