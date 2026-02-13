const express = require('express');
const mysql = require('mysql2/promise');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

const dbConfig = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'frasers',
  password: process.env.DB_PASSWORD || 'gBszj6TJPtNpfvX',
  database: process.env.DB_NAME || 'fraser',
  waitForConnections: true,
  connectionLimit: 10,
};

const pool = mysql.createPool(dbConfig);

const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const viewRegex = /^v_(\d{4})_(\d{2})_(reports|traffic)$/;

async function getAvailableYears() {
  const [rows] = await pool.query(
    `SELECT TABLE_NAME
     FROM INFORMATION_SCHEMA.VIEWS
     WHERE TABLE_SCHEMA = ?
       AND TABLE_NAME REGEXP '^v_[0-9]{4}_[0-9]{2}_(reports|traffic)$'`,
    [dbConfig.database],
  );

  const years = new Set();
  for (const row of rows) {
    const match = row.TABLE_NAME.match(viewRegex);
    if (match) {
      years.add(Number(match[1]));
    }
  }

  return [...years].sort((a, b) => a - b);
}

async function loadReportData(viewName, mall) {
  const [rows] = await pool.query(
    `SELECT caption, zone, COUNT(*) AS feedback_count, AVG(rating) AS avg_rating
     FROM \`${viewName}\`
     WHERE zone = ?
       AND caption IS NOT NULL
       AND caption <> ''
     GROUP BY caption, zone
     ORDER BY feedback_count DESC, avg_rating ASC
     LIMIT 3`,
    [mall],
  );

  const [meta] = await pool.query(
    `SELECT COUNT(*) AS total_feedback FROM \`${viewName}\` WHERE zone = ?`,
    [mall],
  );

  return {
    items: rows.map((row, index) => ({
      rank: index + 1,
      caption: row.caption,
      feedbackCount: Number(row.feedback_count || 0),
      avgRating: Number(row.avg_rating || 0),
    })),
    totalFeedback: Number(meta[0]?.total_feedback || 0),
  };
}

async function loadTrafficData(viewName, mall) {
  const [rows] = await pool.query(
    `SELECT SUM(total_visitors) AS visitors
     FROM \`${viewName}\`
     WHERE mall = ?`,
    [mall],
  );
  return Number(rows[0]?.visitors || 0);
}

async function getMallsForYear(year) {
  const month = String(1).padStart(2, '0');
  const viewName = `v_${year}_${month}_reports`;
  const [rows] = await pool.query(
    `SELECT DISTINCT zone FROM \`${viewName}\` WHERE zone IS NOT NULL AND zone <> '' ORDER BY zone`,
  );
  return rows.map((row) => row.zone);
}

app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/filters', async (req, res) => {
  try {
    const years = await getAvailableYears();
    if (!years.length) {
      return res.json({ years: [], malls: [] });
    }

    const defaultYear = years[years.length - 1];
    const malls = await getMallsForYear(defaultYear);
    return res.json({ years, malls, defaultYear, defaultMall: malls[0] || null });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.get('/api/top3', async (req, res) => {
  try {
    const year = Number(req.query.year);
    const mall = req.query.mall;

    if (!year || !mall) {
      return res.status(400).json({ error: 'year and mall are required' });
    }

    const monthFilter = req.query.month ? Number(req.query.month) : null;

    const monthIndexes = monthFilter ? [monthFilter - 1] : [...Array(12).keys()];

    const monthly = [];

    for (const monthIndex of monthIndexes) {
      const mm = String(monthIndex + 1).padStart(2, '0');
      const reportsView = `v_${year}_${mm}_reports`;
      const trafficView = `v_${year}_${mm}_traffic`;

      const reportData = await loadReportData(reportsView, mall);
      const visitors = await loadTrafficData(trafficView, mall);

      monthly.push({
        month: monthNames[monthIndex],
        monthNumber: monthIndex + 1,
        reportData,
        visitors,
      });
    }

    return res.json({ year, mall, monthly });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.listen(port, () => {
  console.log(`Dashboard server running on http://localhost:${port}`);
});
