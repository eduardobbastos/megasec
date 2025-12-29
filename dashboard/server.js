const express = require("express");
const helmet = require("helmet");
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");

const app = express();
const PORT = 3000;

// Global track of the active scan process
let activeScanProcess = null;

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
  res.json({
    reportExists: exists,
    isScanning: !!activeScanProcess
  });
});

// API: Stop Scan
app.post("/api/stop-scan", (req, res) => {
  if (activeScanProcess) {
    // Kill the process tree (or just the process)
    // Since we spawn docker commands, simple kill might be enough if we use the right signal
    // But docker cli might leave container running. Ideally we should stop the container too if possible.
    // For simplicity in this single-container model, killing the spawn usually works OK for interruption.
    // However, explicitly killing the container logic would be safer for 'docker run'.
    // We'll stick to killing the child process for now to stop the stream.

    activeScanProcess.kill('SIGTERM');
    activeScanProcess = null;
    return res.json({ message: "Scan stopped successfully" });
  }
  return res.status(400).json({ message: "No active scan to stop" });
  return res.status(400).json({ message: "No active scan to stop" });
});

// API: Reset Reports
app.post("/api/reset", (req, res) => {
  try {
    const files = ["/app/reports/report.html", "/app/reports/report.json", "/app/reports/secrets.json", "/app/reports/cve_report.html", "/app/reports/cve_report.json"];
    files.forEach(file => {
      if (fs.existsSync(file)) fs.unlinkSync(file);
    });
    res.json({ message: "Reports cleared" });
  } catch (e) {
    res.status(500).json({ message: "Failed to clear reports", error: e.message });
  }
});



// API: Summary
app.get("/api/summary", (req, res) => {
  const summary = {
    zap: { high: 0, medium: 0, low: 0 },
    // cve: { critical: 0, high: 0, medium: 0 },
    // secrets: { count: 0 }
  };

  // ZAP JSON
  try {
    if (fs.existsSync("/app/reports/report.json")) {
      const zapData = JSON.parse(fs.readFileSync("/app/reports/report.json", 'utf8'));
      // ZAP JSON structure varies, but usually: site[0].alerts
      // We'll simplify and count logic here or rely on summary fields if available
      // For baseline, it might be in zapData.site[0].alerts
      if (zapData.site && zapData.site.length > 0 && zapData.site[0].alerts) {
        zapData.site[0].alerts.forEach(alert => {
          const risk = alert.riskdesc.split(' ')[0].toLowerCase(); // "High (Medium Confidence)"
          if (risk === 'high') summary.zap.high++;
          if (risk === 'medium') summary.zap.medium++;
          if (risk === 'low') summary.zap.low++;
        });
      }
    }
  } catch (e) { console.error("Error parsing ZAP JSON", e); }



  // Secrets
  // summary.secrets = parseSecretsReport("/app/reports/secrets.json");

  res.json(summary);
});

// API: Scan - Streaming
app.get("/api/scan", (req, res) => {
  let targetUrl = (req.query.url || "https://secure_web:8443").trim();

  // Robust validation using URL object
  try {
    const parsed = new URL(targetUrl);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error("Invalid protocol");
    }
  } catch (e) {
    res.write(`Error: Invalid URL format. ${e.message}\n`);
    return res.end();
  }



  if (activeScanProcess) {
    res.write("Error: A scan is already in progress. Please stop it first.\n");
    return res.end();
  }

  res.setHeader("Content-Type", "text/plain");
  res.setHeader("Transfer-Encoding", "chunked");

  const child = spawn("docker", [
    "exec",
    "security_scanner",
    "zap-baseline.py",
    "-t",
    targetUrl,
    "-r",
    "report.html",
    "-J",           // Generate JSON report
    "report.json"   // Filename
  ]);

  activeScanProcess = child;

  child.stdout.on("data", (data) => {
    res.write(data);
  });

  child.stderr.on("data", (data) => {
    res.write(data);
  });

  child.on("error", (err) => {
    console.error("Failed to spawn docker:", err);
    res.write(`\n[FATAL ERROR] Failed to run scan command: ${err.message}\n`);
    res.end();
    activeScanProcess = null;
  });

  child.on("close", (code) => {
    activeScanProcess = null;
    if (code === 0 || code === 2) { // ZAP returns 2 for "issues found"
      res.write("\n[SUCCESS] Scan completed successfully.\n");
    } else if (code === null) {
      res.write("\n[INFO] Scan stopped by user.\n");
    } else {
      res.write(`\n[ERROR] Scan process exited with code ${code}\n`);
    }
    res.end();
  });
});

// API: Full Scan - Streaming (Interactive/Attack Mode)
app.get("/api/scan-full", (req, res) => {
  let targetUrl = (req.query.url || "https://secure_web:8443").trim();

  // Robust validation
  try {
    const parsed = new URL(targetUrl);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error("Invalid protocol");
    }
  } catch (e) {
    res.write(`Error: Invalid URL format. ${e.message}\n`);
    return res.end();
  }

  if (activeScanProcess) {
    res.write("Error: A scan is already in progress. Please stop it first.\n");
    return res.end();
  }

  res.setHeader("Content-Type", "text/plain");
  res.setHeader("Transfer-Encoding", "chunked");

  // zap-full-scan.py -t <target> -j (ajax) -a (alpha) -r report.html -J report.json
  const child = spawn("docker", [
    "exec",
    "security_scanner",
    "zap-full-scan.py",
    "-t",
    targetUrl,
    "-j", // Ajax spider
    "-a", // Alpha rules
    "-r",
    "report.html",
    "-J",
    "report.json"
  ]);

  activeScanProcess = child;

  child.stdout.on("data", (data) => {
    res.write(data);
  });

  child.stderr.on("data", (data) => {
    res.write(data);
  });

  child.on("error", (err) => {
    console.error("Failed to spawn docker:", err);
    res.write(`\n[FATAL ERROR] Failed to run scan command: ${err.message}\n`);
    res.end();
    activeScanProcess = null;
  });

  child.on("close", (code) => {
    activeScanProcess = null;
    if (code === 0 || code === 2) {
      res.write("\n[SUCCESS] Full Scan completed successfully.\n");
    } else if (code === null) {
      res.write("\n[INFO] Scan stopped by user.\n");
    } else {
      res.write(`\n[ERROR] Scan process exited with code ${code}\n`);
    }
    res.end();
  });
});





app.listen(PORT, () => {
  console.log(`Dashboard running on http://localhost:${PORT}`);
});
