const express = require("express");
const helmet = require("helmet");
const path = require("path");
const fs = require("fs");
const { exec } = require("child_process");

const app = express();
const PORT = 3000;

// Security middleware
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
          "https://cdnjs.cloudflare.com",
        ], // Allow inline for simple dashboard
        styleSrc: [
          "'self'",
          "'unsafe-inline'",
          "https://cdnjs.cloudflare.com",
          "https://fonts.googleapis.com",
        ],
        fontSrc: [
          "'self'",
          "https://cdnjs.cloudflare.com",
          "https://fonts.gstatic.com",
        ],
        imgSrc: ["'self'", "data:"],
      },
    },
  })
);

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Serve ZAP report
app.get("/reports/report.html", (req, res) => {
  const reportPath = "/app/reports/report.html";
  if (fs.existsSync(reportPath)) {
    res.sendFile(reportPath);
  } else {
    res.status(404).send("Report not found");
  }
});

// API: Status
app.get("/api/status", (req, res) => {
  const exists = fs.existsSync("/app/reports/report.html");
  res.json({ reportExists: exists });
});

// API: Scan
app.post("/api/scan", (req, res) => {
  let targetUrl = req.body.url || "https://secure_web:8443";

  console.log(`Starting scan for target: ${targetUrl}`);

  // Strict validation to prevent command injection
  // Allow only http/https, alphanumeric, dots, hyphens, colons, slashes
  // This is a basic check, but stronger than before.
  if (!/^https?:\/\/[a-zA-Z0-9.\-_:\/]+$/.test(targetUrl)) {
    return res.status(400).json({ success: false, logs: "Invalid URL format" });
  }

  const command = `docker exec security_scanner zap-baseline.py -t ${targetUrl} -r report.html`;

  exec(command, (error, stdout, stderr) => {
    const result = {
      success: !error || (stdout && stdout.includes("Report generation")),
      logs: stdout || stderr,
    };
    res.json(result);
  });
});

app.listen(PORT, () => {
  console.log(`Dashboard running on http://localhost:${PORT}`);
});
