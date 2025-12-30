let chart;

document.getElementById('uploadForm').addEventListener('submit', async e => {
  e.preventDefault();

  const fd = new FormData();
  fd.append('safetyObservationFile', document.getElementById('so').files[0]);
  fd.append('nearMissFile', document.getElementById('nm').files[0]);
  fd.append('incidentFile', document.getElementById('inc').files[0]);

  const res = await fetch('/api/analyze', { method:'POST', body: fd });
  const data = await res.json();

  document.getElementById('soInc').innerText = data.counts.so_inc;
  document.getElementById('nmInc').innerText = data.counts.nm_inc;
  document.getElementById('soNmInc').innerText = data.counts.so_nm_inc;
  document.getElementById('prevented').innerText = data.counts.prevented;



const labels = data.hazards;

const soData  = labels.map(h => data.hazardCounts[h].so);
const nmData  = labels.map(h => data.hazardCounts[h].nm);
const incData = labels.map(h => data.hazardCounts[h].inc);

if (chart) chart.destroy();

chart = new Chart(document.getElementById('chart'), {
  type: 'bar',
  data: {
    labels,
    datasets: [
      { label:'Safety Observation', data: soData, backgroundColor:'#0d6efd' },
      { label:'Near Miss', data: nmData, backgroundColor:'#ffc107' },
      { label:'Incident', data: incData, backgroundColor:'#dc3545' }
    ]
  }
});

const d = document.getElementById('download');
d.classList.remove('d-none');
d.href = data.reportUrl;
});
