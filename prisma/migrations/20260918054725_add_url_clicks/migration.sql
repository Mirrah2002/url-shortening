-- CreateTable
CREATE TABLE "url_clicks" (
    "id" BIGSERIAL NOT NULL,
    "url_id" BIGINT NOT NULL,
    "clicked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "referer" TEXT,

    CONSTRAINT "url_clicks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "url_clicks_url_id_idx" ON "url_clicks"("url_id");

-- AddForeignKey
ALTER TABLE "url_clicks" ADD CONSTRAINT "url_clicks_url_id_fkey" FOREIGN KEY ("url_id") REFERENCES "urls"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
