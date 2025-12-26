let nearMissChart, escalationChart;

document.getElementById('uploadForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const formData = new FormData();
  formData.append('nearMissFile', document.getElementById('nearMissFile').files[0]);
  formData.append('incidentFile', document.getElementById('incidentFile').files[0]);

  const res = await fetch('/api/analyze', {
    method: 'POST',
    body: formData
  });

  const data = await res.json();
  console.log('API RESPONSE:', data);

  // Summary
  const results = document.getElementById('results');
  results.classList.remove('d-none');
  results.innerHTML = data.summary;

  // Bar Chart
  if (nearMissChart) nearMissChart.destroy();
  nearMissChart = new Chart(document.getElementById('nearMissChart'), {
    type: 'bar',
    data: {
      labels: Object.keys(data.nearMissCategoryCount),
      datasets: [{
        label: 'Near Miss Count',
        data: Object.values(data.nearMissCategoryCount),
        backgroundColor: 'rgba(54,162,235,0.8)'
      }]
    }
  });

  // Doughnut Chart
  if (escalationChart) escalationChart.destroy();
  const totalNearMisses = Object.values(data.nearMissCategoryCount)
    .reduce((a, b) => a + b, 0);

  escalationChart = new Chart(document.getElementById('escalationChart'), {
    type: 'doughnut',
    data: {
      labels: ['Escalated', 'No Escalation'],
      datasets: [{
        data: [data.escalationCount, totalNearMisses - data.escalationCount],
        backgroundColor: ['#dc3545', '#198754']
      }]
    }
  });

  // Download button
  const btn = document.getElementById('downloadReport');
  btn.classList.remove('d-none');
  btn.href = data.reportUrl;
});
