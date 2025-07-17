// Login logic
function validateLogin() {
  const user = document.getElementById("username").value.trim();
  const pass = document.getElementById("password").value.trim();
  if (user === "Forex263" && pass === "Forex263") {
    document.getElementById("login-screen").style.display = "none";
    document.getElementById("tool").style.display = "block";
    initializeTool();
  } else {
    alert("Incorrect username or password.");
  }
}

// Globals
let ws;
let tickBuffer = [];
let countdown = 10;
let countdownInterval;
let digitChart, biasChart;

// Helper to get last digit from tick price
function getLastDigit(price) {
  return parseInt(price.toString().slice(-1));
}

// Calculate frequency of digits 0-9 in an array
function getDigitFrequency(arr) {
  const freq = Array(10).fill(0);
  arr.forEach(d => freq[d]++);
  return freq;
}

// Get digit with highest frequency and its confidence %
function getMostFrequentDigit(arr) {
  const freq = getDigitFrequency(arr);
  const max = Math.max(...freq);
  const index = freq.indexOf(max);
  const confidence = ((max / arr.length) * 100).toFixed(2);
  return { digit: index, confidence };
}

// Update tick history display with highlighting for predicted digit
function updateTickHistory(predictedDigit) {
  const historyDiv = document.getElementById("tick-history");
  historyDiv.innerHTML = "";

  tickBuffer.forEach(d => {
    const span = document.createElement("span");
    span.textContent = d;
    span.className = "tick";
    if (d === predictedDigit) {
      span.classList.add("highlight");
    }
    historyDiv.appendChild(span);
  });
}

// Update charts for frequency and bias
function updateCharts() {
  const freq = getDigitFrequency(tickBuffer);

  if (!digitChart) {
    digitChart = new Chart(document.getElementById("digitChart"), {
      type: 'bar',
      data: {
        labels: [...Array(10).keys()].map(String),
        datasets: [{
          label: 'Digit Frequency',
          data: freq,
          backgroundColor: '#3b82f6'
        }]
      },
      options: {
        responsive: true,
        scales: { y: { beginAtZero: true, precision: 0 } }
      }
    });
  } else {
    digitChart.data.datasets[0].data = freq;
    digitChart.update();
  }

  if (!biasChart) {
    biasChart = new Chart(document.getElementById("biasChart"), {
      type: 'radar',
      data: {
        labels: [...Array(10).keys()].map(String),
        datasets: [{
          label: 'Digit Bias Map',
          data: freq,
          backgroundColor: 'rgba(59, 130, 246, 0.4)',
          borderColor: '#1d4ed8',
          borderWidth: 2
        }]
      },
      options: { responsive: true, scales: { r: { beginAtZero: true } } }
    });
  } else {
    biasChart.data.datasets[0].data = freq;
    biasChart.update();
  }
}

// Show prediction, confidence, popup & trade button
function showPrediction() {
  if (tickBuffer.length === 0) return;
  const { digit, confidence } = getMostFrequentDigit(tickBuffer);

  const predictedDigitDisplay = document.getElementById("predicted-digit-display");
  const conf = document.getElementById("confidence-score");
  const popup = document.getElementById("popup");
  const tradeButton = document.getElementById("trade-button");

  predictedDigitDisplay.textContent = digit;
  conf.textContent = confidence;

  updateTickHistory(digit);

  if (confidence >= 80) {
    popup.style.display = "block";
    tradeButton.style.display = "block";
  } else {
    popup.style.display = "none";
    tradeButton.style.display = "none";
  }
}

// Countdown timer logic
function updateCountdown() {
  const timer = document.getElementById("timer");
  timer.textContent = `Next prediction in: ${countdown}s`;
  countdown--;
  if (countdown < 0) {
    showPrediction();
    countdown = 10;
  }
}

function startCountdown() {
  clearInterval(countdownInterval);
  countdown = 10;
  countdownInterval = setInterval(updateCountdown, 1000);
}

// WebSocket live tick subscription
function startLiveTicks(market) {
  if (ws) ws.close();
  tickBuffer = [];

  ws = new WebSocket("wss://ws.binaryws.com/websockets/v3?app_id=1089");
  ws.onopen = () => ws.send(JSON.stringify({ ticks: market, subscribe: 1 }));
  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.tick && data.tick.quote) {
      const digit = getLastDigit(data.tick.quote);
      tickBuffer.push(digit);
      if (tickBuffer.length > 1000) tickBuffer.shift();
      updateTickHistory();
    }
  };

  startCountdown();
}

// Fetch tick history (last 1000 ticks)
async function fetchTickHistory(market, count = 1000) {
  try {
    const response = await fetch("https://api.binaryws.com/v3/ticks_history", {
      method: "POST",
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ticks_history: market,
        adjust_start_time: 1,
        count: count,
        end: "latest",
        start: 1,
        style: "ticks"
      })
    });
    const data = await response.json();
    if (data.history && data.history.prices) {
      return data.history.prices.map(getLastDigit);
    }
    return [];
  } catch (error) {
    console.error("Tick history fetch error:", error);
    return [];
  }
}

// Initialize tool: fetch history, start websocket, start countdown
async function initializeTool() {
  const market = document.getElementById("market-select").value;
  tickBuffer = await fetchTickHistory(market, 1000);
  updateTickHistory();
  updateCharts();
  showPrediction();
  startLiveTicks(market);
}

document.getElementById("market-select").addEventListener("change", initializeTool);