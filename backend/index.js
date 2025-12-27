const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const xlsx = require('xlsx');

const app = express();
const PORT = 3000;

/* =========================
   SETUP
========================= */
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

app.use(express.static(path.join(__dirname, '../frontend')));
app.use(express.json());

const upload = multer({ dest: uploadDir });

/* =========================
   NLP UTILITIES
========================= */
const STOP_WORDS = [
  'the','and','was','were','from','with','while','during','on','in','to',
  'of','his','her','is','got','due','so','at','by','for','it','as','into'
];

function tokenize(text = '') {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 3 && !STOP_WORDS.includes(w));
}

/* =========================
   API
========================= */
app.post(
  '/api/analyze',
  upload.fields([
    { name: 'nearMissFile', maxCount: 1 },
    { name: 'incidentFile', maxCount: 1 }
  ]),
  (req, res) => {

    const nearWB = xlsx.readFile(req.files.nearMissFile[0].path);
    const incWB  = xlsx.readFile(req.files.incidentFile[0].path);

    const nearData = xlsx.utils.sheet_to_json(nearWB.Sheets[nearWB.SheetNames[0]]);
    const incData  = xlsx.utils.sheet_to_json(incWB.Sheets[incWB.SheetNames[0]]);

    /* =========================
       STEP 1: KEYWORD COUNTS (NEAR MISS FOCUS)
    ========================= */
    const keywordNearCount = {};
    const keywordIncidentCount = {};
    const keywordDetails = {};

    nearData.forEach(row => {
      tokenize(row['NEAR MISS']).forEach(word => {
        keywordNearCount[word] = (keywordNearCount[word] || 0) + 1;
      });
    });

    incData.forEach(row => {
      tokenize(row['INCIDENT']).forEach(word => {
        keywordIncidentCount[word] = (keywordIncidentCount[word] || 0) + 1;
      });
    });

    /* =========================
       STEP 2: TOP 5 KEYWORDS (BY NEAR MISS)
    ========================= */
    const topKeywords = Object.entries(keywordNearCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([k]) => k);

    /* =========================
       STEP 3: LINK DATA TO KEYWORDS
    ========================= */
    topKeywords.forEach(k => {
      keywordDetails[k] = {
        nearMissCount: keywordNearCount[k] || 0,
        incidentCount: keywordIncidentCount[k] || 0,
        nearMissList: [],
        incidentList: []
      };
    });

    nearData.forEach(row => {
      const text = row['NEAR MISS'].toLowerCase();
      topKeywords.forEach(k => {
        if (text.includes(k)) {
          keywordDetails[k].nearMissList.push(row['NEAR MISS']);
        }
      });
    });

    incData.forEach(row => {
      const text = row['INCIDENT'].toLowerCase();
      topKeywords.forEach(k => {
        if (text.includes(k)) {
          keywordDetails[k].incidentList.push(row['INCIDENT']);
        }
      });
    });

    /* =========================
       SUMMARY
    ========================= */
    let summary = `
<b>Total Near Misses:</b> ${nearData.length}<br>
<b>Total Incidents:</b> ${incData.length}<br><br>
<b>Top 5 Keywords (Near Miss Driven):</b><br>
`;

    topKeywords.forEach(k => {
      summary += `
<b>${k}</b> → Near Miss: ${keywordDetails[k].nearMissCount},
Incident: ${keywordDetails[k].incidentCount}<br>
`;
    });

    /* =========================
       EXCEL REPORT
    ========================= */
    const reportWB = xlsx.utils.book_new();

    // Sheet 1: Keyword Summary
    const summarySheet = [
      ['Keyword', 'Near Miss Count', 'Incident Count']
    ];
    topKeywords.forEach(k => {
      summarySheet.push([
        k,
        keywordDetails[k].nearMissCount,
        keywordDetails[k].incidentCount
      ]);
    });

    xlsx.utils.book_append_sheet(
      reportWB,
      xlsx.utils.aoa_to_sheet(summarySheet),
      'Keyword Summary'
    );

    // Sheet 2: Near Miss Linked Data
    const nearSheet = [['Keyword', 'Near Miss Description']];
    topKeywords.forEach(k => {
      keywordDetails[k].nearMissList.forEach(desc => {
        nearSheet.push([k, desc]);
      });
    });

    xlsx.utils.book_append_sheet(
      reportWB,
      xlsx.utils.aoa_to_sheet(nearSheet),
      'Near Miss Details'
    );

    // Sheet 3: Incident Linked Data
    const incSheet = [['Keyword', 'Incident Description']];
    topKeywords.forEach(k => {
      keywordDetails[k].incidentList.forEach(desc => {
        incSheet.push([k, desc]);
      });
    });

    xlsx.utils.book_append_sheet(
      reportWB,
      xlsx.utils.aoa_to_sheet(incSheet),
      'Incident Details'
    );

    const reportName = `Safety_Keyword_Report_${Date.now()}.xlsx`;
    xlsx.writeFile(reportWB, path.join(uploadDir, reportName));

    /* =========================
       RESPONSE
    ========================= */
    res.json({
      summary,
      keywordDetails,
      reportUrl: `/download/${reportName}`
    });
  }
);

/* =========================
   DOWNLOAD
========================= */
app.get('/download/:file', (req, res) => {
  res.download(path.join(uploadDir, req.params.file));
});

app.listen(PORT, () => {
  console.log(`✅ Safety AI Analyzer running on http://localhost:${PORT}`);
});
