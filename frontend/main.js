let keywordChart;

document.getElementById('uploadForm').addEventListener('submit', async e => {
  e.preventDefault();

  const formData = new FormData();
  formData.append('nearMissFile', document.getElementById('nearMissFile').files[0]);
  formData.append('incidentFile', document.getElementById('incidentFile').files[0]);

  const res = await fetch('/api/analyze', {
    method: 'POST',
    body: formData
  });

  const data = await res.json();

  // Summary
  const results = document.getElementById('results');
  results.classList.remove('d-none');
  results.innerHTML = data.summary;

  // Chart
  const labels = Object.keys(data.keywordDetails);
  const nearMissCounts = labels.map(k => data.keywordDetails[k].nearMissCount);
  const incidentCounts = labels.map(k => data.keywordDetails[k].incidentCount);

  if (keywordChart) keywordChart.destroy();

  keywordChart = new Chart(document.getElementById('keywordChart'), {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Near Miss Count',
          data: nearMissCounts,
          backgroundColor: 'rgba(54,162,235,0.8)'
        },
        {
          label: 'Incident Count',
          data: incidentCounts,
          backgroundColor: 'rgba(255,99,132,0.8)'
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        title: {
          display: true,
          text: 'Top 5 Keywords – Near Miss vs Incident'
        }
      }
    }
  });

  // Download
  const btn = document.getElementById('downloadReport');
  btn.classList.remove('d-none');
  btn.href = data.reportUrl;
});
