const express = require("express");
const helmet = require("helmet");
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");

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

// API: Scan - Streaming
app.get("/api/scan", (req, res) => {
  let targetUrl = req.query.url || "https://secure_web:8443";

  // Strict validation to prevent command injection
  if (!/^https?:\/\/[a-zA-Z0-9.\-_:\/]+$/.test(targetUrl)) {
    res.write("Error: Invalid URL format\n");
    return res.end();
  }

  console.log(`Starting stream scan for target: ${targetUrl}`);

  // Set headers for streaming text
  res.setHeader("Content-Type", "text/plain");
  res.setHeader("Transfer-Encoding", "chunked");

  const child = spawn("docker", [
    "exec",
    "security_scanner",
    "zap-baseline.py",
    "-t",
    targetUrl,
    "-r",
    "report.html"
  ]);

  child.stdout.on("data", (data) => {
    res.write(data);
  });

  child.stderr.on("data", (data) => {
    res.write(data);
  });

  child.on("close", (code) => {
    if (code === 0) {
      res.write("\n[SUCCESS] Scan completed successfully.\n");
    } else {
      res.write(`\n[ERROR] Scan process exited with code ${code}\n`);
    }
    res.end();
  });
});

// Serve CVE report
app.get("/reports/cve_report.html", (req, res) => {
  const reportPath = "/app/reports/cve_report.html";
  if (fs.existsSync(reportPath)) {
    res.sendFile(reportPath);
  } else {
    res.status(404).send("CVE Report not found");
  }
});

// API: CVE Scan - Streaming
app.get("/api/scan-cve", (req, res) => {
  console.log("Starting CVE scan...");

  res.setHeader("Content-Type", "text/plain");
  res.setHeader("Transfer-Encoding", "chunked");

  const child = spawn("docker", [
    "run",
    "--rm",
    "-v",
    "/var/run/docker.sock:/var/run/docker.sock",
    "-v",
    `${path.join(__dirname, "../reports")}:/reports`,
    "aquasec/trivy",
    "image",
    "--format",
    "template",
    "--template",
    "@/contrib/html.tpl",
    "-o",
    "/reports/cve_report.html",
    "secure_template-web:latest" // We scan the built image directly
  ]);

  child.stdout.on("data", (data) => {
    res.write(data);
  });

  child.stderr.on("data", (data) => {
    res.write(data);
  });

  child.on("close", (code) => {
    if (code === 0) {
      res.write("\n[SUCCESS] CVE Scan completed successfully.\n");
    } else {
      res.write(`\n[ERROR] CVE Scan process exited with code ${code}\n`);
    }
    res.end();
  });
});

app.listen(PORT, () => {
  console.log(`Dashboard running on http://localhost:${PORT}`);
});
