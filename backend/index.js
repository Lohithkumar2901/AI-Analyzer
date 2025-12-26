const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const xlsx = require('xlsx');

const app = express();
const PORT = 3000;

// Ensure uploads folder exists
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

// Serve frontend
app.use(express.static(path.join(__dirname, '../frontend')));
app.use(express.json());

// Multer config
const upload = multer({ dest: uploadDir });

// Utility functions
const cleanText = (t = '') => t.toLowerCase();

const classifyHazard = (text) => {
  text = cleanText(text);
  if (text.includes('slip') || text.includes('wet') || text.includes('fall')) return 'Slip / Trip / Fall';
  if (text.includes('hand') || text.includes('finger') || text.includes('hit') || text.includes('cut')) return 'Hand / Finger Injury';
  if (text.includes('walk') || text.includes('floor')) return 'Housekeeping';
  if (text.includes('machine') || text.includes('wheel') || text.includes('roller')) return 'Machine Interaction';
  return 'Other';
};

// API
app.post(
  '/api/analyze',
  upload.fields([
    { name: 'nearMissFile', maxCount: 1 },
    { name: 'incidentFile', maxCount: 1 }
  ]),
  (req, res) => {
    console.log('🔥 /api/analyze HIT');

    const nearMissWB = xlsx.readFile(req.files.nearMissFile[0].path);
    const incidentWB = xlsx.readFile(req.files.incidentFile[0].path);

    const nearMissData = xlsx.utils.sheet_to_json(nearMissWB.Sheets[nearMissWB.SheetNames[0]]);
    const incidentData = xlsx.utils.sheet_to_json(incidentWB.Sheets[incidentWB.SheetNames[0]]);

    // Categorize near misses
    const nearMissCategoryCount = {};
    nearMissData.forEach(r => {
      const cat = classifyHazard(r['NEAR MISS']);
      nearMissCategoryCount[cat] = (nearMissCategoryCount[cat] || 0) + 1;
    });

    // Simple escalation logic (category-based)
    let escalationCount = 0;
    incidentData.forEach(inc => {
      const incCat = classifyHazard(inc['INCIDENT']);
      if (nearMissCategoryCount[incCat]) escalationCount++;
    });

    // Summary
    const summary = `
<b>Total Near Misses:</b> ${nearMissData.length}<br>
<b>Total Incidents:</b> ${incidentData.length}<br>
<b>Highest Near Miss Category:</b> ${Object.keys(nearMissCategoryCount)[0]}
`;

    // Create Excel report
    const reportWB = xlsx.utils.book_new();
    const reportSheet = [['Category', 'Near Miss Count']];
    Object.entries(nearMissCategoryCount).forEach(([k, v]) => reportSheet.push([k, v]));

    xlsx.utils.book_append_sheet(reportWB, xlsx.utils.aoa_to_sheet(reportSheet), 'Summary');

    const reportName = `Safety_Report_${Date.now()}.xlsx`;
    const reportPath = path.join(uploadDir, reportName);
    xlsx.writeFile(reportWB, reportPath);

    // FINAL RESPONSE (CRITICAL)
    res.json({
      summary,
      nearMissCategoryCount,
      escalationCount,
      reportUrl: `/download/${reportName}`
    });
  }
);

// Download route
app.get('/download/:file', (req, res) => {
  res.download(path.join(uploadDir, req.params.file));
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ Backend running on http://localhost:${PORT}`);
});
