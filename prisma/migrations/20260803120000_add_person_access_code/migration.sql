-- AlterTable: add the public access code, backfilling existing people with a
-- fresh random code (the DB id is no longer usable to reach /public/[code]).
ALTER TABLE "Person" ADD COLUMN "accessCode" TEXT;

-- Cross join Person x 12 rows, grouped back per person: random() is volatile,
-- so it is evaluated once per generated row, giving 12 independent characters
-- per person. Same alphabet as src/lib/access-code.ts, so backfilled codes are
-- indistinguishable from ones minted by the app.
UPDATE "Person" p SET "accessCode" = sub.code
FROM (
  SELECT id,
         string_agg(substr('23456789ABCDEFGHJKMNPQRSTUVWXYZ', 1 + floor(random() * 31)::int, 1), '') AS code
  FROM "Person", generate_series(1, 12)
  GROUP BY id
) sub
WHERE p.id = sub.id;

ALTER TABLE "Person" ALTER COLUMN "accessCode" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Person_accessCode_key" ON "Person"("accessCode");
