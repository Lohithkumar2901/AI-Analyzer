const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const xlsx = require('xlsx');

const app = express();
const PORT = 3000;

/* ================= SETUP ================= */
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

app.use(express.static(path.join(__dirname, '../frontend')));
app.use(express.json());

const upload = multer({ dest: uploadDir });

/* ================= HAZARD DICTIONARY ================= */
const HAZARD_MAP = {
  slip:  ['slip','slipped','floor','oil','wet','spillage'],
  trip:  ['trip','stumble','kept','placed'],
  cut:   ['cut','sharp','burr','knife'],
  hit:   ['hit','struck','impact'],
  wheel: ['wheel','disc','trolley','rim'],
  hand:  ['hand','finger','palm'],
  fall:  ['fall','fell','collapse']
};

const safeText = v => v ? String(v).toLowerCase() : '';

function detectHazards(text) {
  const t = safeText(text);
  return Object.keys(HAZARD_MAP).filter(h =>
    HAZARD_MAP[h].some(w => t.includes(w))
  );
}

// PRIMARY hazard = most safety-critical
function primaryHazard(hazards) {
  const priority = ['slip','trip','cut','hit','wheel','fall','hand'];
  return priority.find(h => hazards.includes(h)) || null;
}

function incidentKey(inc) {
  return inc.treatment_number
    ? String(inc.treatment_number)
    : `${inc.incident_date}-${safeText(inc.incident_description).slice(0,40)}`;
}

/* ================= API ================= */
app.post(
  '/api/analyze',
  upload.fields([
    { name: 'safetyObservationFile', maxCount: 1 },
    { name: 'nearMissFile', maxCount: 1 },
    { name: 'incidentFile', maxCount: 1 }
  ]),
  (req, res) => {
    try {
      const SO = xlsx.utils.sheet_to_json(
        xlsx.readFile(req.files.safetyObservationFile[0].path)
          .Sheets[xlsx.readFile(req.files.safetyObservationFile[0].path).SheetNames[0]]
      );
      const NM = xlsx.utils.sheet_to_json(
        xlsx.readFile(req.files.nearMissFile[0].path)
          .Sheets[xlsx.readFile(req.files.nearMissFile[0].path).SheetNames[0]]
      );
      const INC = xlsx.utils.sheet_to_json(
        xlsx.readFile(req.files.incidentFile[0].path)
          .Sheets[xlsx.readFile(req.files.incidentFile[0].path).SheetNames[0]]
      );

      /* ===== HAZARD COUNTS (FOR DASHBOARD CHART) ===== */
const hazardCounts = {};
Object.keys(HAZARD_MAP).forEach(h => {
  hazardCounts[h] = { so: 0, nm: 0, inc: 0 };
});

SO.forEach(so => {
  detectHazards(so['Nearmiss observation']).forEach(h => {
    hazardCounts[h].so++;
  });
});

NM.forEach(nm => {
  detectHazards(nm['Observation']).forEach(h => {
    hazardCounts[h].nm++;
  });
});

INC.forEach(inc => {
  detectHazards(inc['incident_description']).forEach(h => {
    hazardCounts[h].inc++;
  });
});


      const so_inc = [];
      const nm_inc = [];
      const so_nm_inc = [];
      const prevented = [];

      const soSet = new Set();
      const nmSet = new Set();
      const soNmSet = new Set();

      /* ===== NM → INCIDENT (PRIMARY HAZARD MATCH ONLY) ===== */
      NM.forEach(nm => {
        const nmHaz = detectHazards(nm['Observation']);
        const nmPrimary = primaryHazard(nmHaz);
        const nmPlant = nm['Plant'] || 'NA';
        const nmZone = nm['Zone'] || 'NA';

        INC.forEach(inc => {
          const incHaz = detectHazards(inc['incident_description']);
          const incPrimary = primaryHazard(incHaz);

          if (!nmPrimary || nmPrimary !== incPrimary) return;

          const key = `${nmPrimary}|${incidentKey(inc)}`;
          if (!nmSet.has(key)) {
            nmSet.add(key);
            nm_inc.push([
              nmPlant,
              nmZone,
              nmPrimary,
              nm['Observation'],
              inc['plant'] || 'NA',
              inc['zone_code'] || 'NA',
              inc['incident_description']
            ]);
          }
        });
      });

      /* ===== SO → INCIDENT ===== */
      SO.forEach(so => {
        const soHaz = detectHazards(so['Nearmiss observation']);
        const soPrimary = primaryHazard(soHaz);
        const soPlant = so['Plant code'] || 'NA';
        const soZone = so['Zone code'] || 'NA';

        INC.forEach(inc => {
          const incHaz = detectHazards(inc['incident_description']);
          const incPrimary = primaryHazard(incHaz);

          if (!soPrimary || soPrimary !== incPrimary) return;

          const key = `${soPrimary}|${incidentKey(inc)}`;
          if (!soSet.has(key)) {
            soSet.add(key);
            so_inc.push([
              soPlant,
              soZone,
              soPrimary,
              so['Nearmiss observation'],
              inc['plant'] || 'NA',
              inc['zone_code'] || 'NA',
              inc['incident_description']
            ]);
          }
        });
      });

      /* ===== SO + NM → INCIDENT ===== */
      SO.forEach(so => {
        const soPrimary = primaryHazard(detectHazards(so['Nearmiss observation']));
        const soPlant = so['Plant code'] || 'NA';
        const soZone = so['Zone code'] || 'NA';

        NM.forEach(nm => {
          const nmPrimary = primaryHazard(detectHazards(nm['Observation']));
          const nmPlant = nm['Plant'] || 'NA';
          const nmZone = nm['Zone'] || 'NA';

          if (!soPrimary || soPrimary !== nmPrimary) return;

          INC.forEach(inc => {
            const incPrimary = primaryHazard(detectHazards(inc['incident_description']));
            if (incPrimary !== soPrimary) return;

            const key = `${soPrimary}|${incidentKey(inc)}`;
            if (!soNmSet.has(key)) {
              soNmSet.add(key);
              so_nm_inc.push([
                soPlant,
                soZone,
                nmPlant,
                nmZone,
                soPrimary,
                so['Nearmiss observation'],
                nm['Observation'],
                inc['plant'] || 'NA',
                inc['zone_code'] || 'NA',
                inc['incident_description']
              ]);
            }
          });
        });
      });

      /* ===== PREVENTED RISKS ===== */
      Object.keys(HAZARD_MAP).forEach(h => {
        const hasIncident = INC.some(inc =>
          primaryHazard(detectHazards(inc['incident_description'])) === h
        );

        if (!hasIncident) {
          SO.forEach(so => {
            NM.forEach(nm => {
              if (
                primaryHazard(detectHazards(so['Nearmiss observation'])) === h &&
                primaryHazard(detectHazards(nm['Observation'])) === h
              ) {
                prevented.push([
                  so['Plant code'] || 'NA',
                  so['Zone code'] || 'NA',
                  nm['Plant'] || 'NA',
                  nm['Zone'] || 'NA',
                  h,
                  so['Nearmiss observation'],
                  nm['Observation'],
                  'PREVENTED'
                ]);
              }
            });
          });
        }
      });

      /* ===== EXCEL ===== */
      const wb = xlsx.utils.book_new();

      xlsx.utils.book_append_sheet(wb,
        xlsx.utils.aoa_to_sheet([
          ['Metric','Count'],
          ['SO → Incident', so_inc.length],
          ['NM → Incident', nm_inc.length],
          ['SO + NM → Incident', so_nm_inc.length],
          ['Prevented Risks', prevented.length]
        ]),
        'Summary'
      );

      xlsx.utils.book_append_sheet(wb,
        xlsx.utils.aoa_to_sheet([
          ['SO Plant','SO Zone','Hazard','SO Observation','Incident Plant','Incident Zone','Incident Description'],
          ...so_inc
        ]),
        'SO_to_Incident'
      );

      xlsx.utils.book_append_sheet(wb,
        xlsx.utils.aoa_to_sheet([
          ['NM Plant','NM Zone','Hazard','NM Observation','Incident Plant','Incident Zone','Incident Description'],
          ...nm_inc
        ]),
        'NM_to_Incident'
      );

      xlsx.utils.book_append_sheet(wb,
        xlsx.utils.aoa_to_sheet([
          ['SO Plant','SO Zone','NM Plant','NM Zone','Hazard','SO Observation','NM Observation','Incident Plant','Incident Zone','Incident Description'],
          ...so_nm_inc
        ]),
        'SO_NM_to_Incident'
      );

      xlsx.utils.book_append_sheet(wb,
        xlsx.utils.aoa_to_sheet([
          ['SO Plant','SO Zone','NM Plant','NM Zone','Hazard','SO Observation','NM Observation','Status'],
          ...prevented
        ]),
        'Prevented_Risks'
      );

      const reportName = `Safety_Report_${Date.now()}.xlsx`;
      xlsx.writeFile(wb, path.join(uploadDir, reportName));


      res.json({
        hazards: Object.keys(HAZARD_MAP),   // ✅ REQUIRED FOR CHART
        hazardCounts,                       // ✅ REQUIRED FOR CHART
        counts: {
          so_inc: so_inc.length,
          nm_inc: nm_inc.length,
          so_nm_inc: so_nm_inc.length,
          prevented: prevented.length
        },
        reportUrl: `/download/${reportName}` // ✅ REQUIRED FOR DOWNLOAD
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Analysis failed' });
    }
  }
);

app.get('/download/:file', (req, res) => {
  res.download(path.join(uploadDir, req.params.file));
});

app.listen(PORT, () => {
  console.log(`✅ Safety Dashboard running on http://localhost:${PORT}`);
});
