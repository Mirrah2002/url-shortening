export async function createUrl(prisma, data) {
  return prisma.url.create({
    data,
  });
}

export async function findUrlByShortCode(prisma, shortCode) {
  return prisma.url.findUnique({
    where: {
      shortCode,
    },
    include: {
      _count: {
        select: { clicks: true },
      },
    },
  });
}

export async function findUrlById(prisma, id) {
  return prisma.url.findUnique({
    where: {
      id: BigInt(id),
    },
  });
}

export async function deleteUrlByShortCode(prisma, shortCode) {
  // First delete associated clicks to respect foreign key constraint
  const url = await prisma.url.findUnique({
    where: { shortCode },
    select: { id: true },
  });

  if (!url) return null;

  return prisma.$transaction([
    prisma.urlClick.deleteMany({
      where: { urlId: url.id },
    }),
    prisma.url.delete({
      where: { id: url.id },
    }),
  ]);
}

export async function listUrls(prisma, { skip = 0, take = 20 } = {}) {
  const [items, total] = await Promise.all([
    prisma.url.findMany({
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { clicks: true },
        },
      },
    }),
    prisma.url.count(),
  ]);

  return { items, total };
}

export async function createUrlClick(prisma, data) {
  return prisma.urlClick.create({
    data: {
      urlId: BigInt(data.urlId),
      clickedAt: data.clickedAt ? new Date(data.clickedAt) : new Date(),
      ipAddress: data.ipAddress ?? null,
      userAgent: data.userAgent ?? null,
      referer: data.referer ?? null,
    },
  });
}

export async function createUrlClicksBatch(prisma, clicks) {
  if (!clicks || clicks.length === 0) return { count: 0 };

  const records = clicks.map((c) => ({
    urlId: BigInt(c.urlId),
    clickedAt: c.clickedAt ? new Date(c.clickedAt) : new Date(),
    ipAddress: c.ipAddress ?? null,
    userAgent: c.userAgent ?? null,
    referer: c.referer ?? null,
  }));

  return prisma.urlClick.createMany({
    data: records,
  });
}

export async function getUrlAnalyticsData(prisma, urlId) {
  const bigIntId = BigInt(urlId);

  const [totalClicks, recentClicks, clicksByDateRaw, topReferrersRaw] = await Promise.all([
    prisma.urlClick.count({
      where: { urlId: bigIntId },
    }),
    prisma.urlClick.findMany({
      where: { urlId: bigIntId },
      take: 50,
      orderBy: { clickedAt: 'desc' },
      select: {
        id: true,
        clickedAt: true,
        ipAddress: true,
        userAgent: true,
        referer: true,
      },
    }),
    prisma.$queryRaw`
      SELECT 
        DATE(clicked_at) as date,
        COUNT(*)::int as count
      FROM url_clicks
      WHERE url_id = ${bigIntId}
      GROUP BY DATE(clicked_at)
      ORDER BY DATE(clicked_at) DESC
      LIMIT 30;
    `,
    prisma.$queryRaw`
      SELECT 
        COALESCE(referer, 'Direct') as referer,
        COUNT(*)::int as count
      FROM url_clicks
      WHERE url_id = ${bigIntId}
      GROUP BY referer
      ORDER BY count DESC
      LIMIT 10;
    `,
  ]);

  return {
    totalClicks,
    clicksByDate: clicksByDateRaw.map((r) => ({
      date: r.date instanceof Date ? r.date.toISOString().split('T')[0] : String(r.date),
      count: Number(r.count),
    })),
    topReferrers: topReferrersRaw.map((r) => ({
      referer: r.referer,
      count: Number(r.count),
    })),
    recentClicks: recentClicks.map((c) => ({
      id: c.id.toString(),
      clickedAt: c.clickedAt,
      ipAddress: c.ipAddress,
      userAgent: c.userAgent,
      referer: c.referer,
    })),
  };
}
