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

// Helper to parse TruffleHog JSONL
function parseSecretsReport(filePath) {
  try {
    if (!fs.existsSync(filePath)) return { count: 0 };
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.trim().split('\n');
    let count = 0;
    for (const line of lines) {
      if (line.trim()) count++;
    }
    return { count };
  } catch (e) {
    return { count: 0 };
  }
}

// API: Summary
app.get("/api/summary", (req, res) => {
  const summary = {
    zap: { high: 0, medium: 0, low: 0 },
    cve: { critical: 0, high: 0, medium: 0 },
    secrets: { count: 0 }
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

  // CVE JSON
  try {
    if (fs.existsSync("/app/reports/cve_report.json")) {
      const cveData = JSON.parse(fs.readFileSync("/app/reports/cve_report.json", 'utf8'));
      // Trivy JSON: Results[].Vulnerabilities[]
      if (cveData.Results) {
        cveData.Results.forEach(res => {
          if (res.Vulnerabilities) {
            res.Vulnerabilities.forEach(vuln => {
              const severity = vuln.Severity.toLowerCase();
              if (severity === 'critical') summary.cve.critical++;
              if (severity === 'high') summary.cve.high++;
              if (severity === 'medium') summary.cve.medium++;
            });
          }
        });
      }
    }
  } catch (e) { console.error("Error parsing CVE JSON", e); }

  // Secrets
  summary.secrets = parseSecretsReport("/app/reports/secrets.json");

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
  });

  child.on("close", (code) => {
    if (code === 0 || code === 2) { // ZAP returns 2 for "issues found"
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


  res.setHeader("Content-Type", "text/plain");
  res.setHeader("Transfer-Encoding", "chunked");

  // Run JSON scan FIRST (internal)
  const jsonChild = spawn("docker", [
    "run", "--rm",
    "--net=host", // Fix DNS/Network timeout for DB download
    "-v", "/var/run/docker.sock:/var/run/docker.sock",
    "-v", `${path.join(__dirname, "../reports")}:/reports`,
    "aquasec/trivy", "image",
    "--format", "json",
    "-o", "/reports/cve_report.json",
    "secure_template-web:latest"
  ]);

  jsonChild.on("close", (jsonCode) => {
    // Then Run HTML scan (for display)
    const child = spawn("docker", [
      "run", "--rm",
      "--net=host", // Fix DNS/Network timeout for DB download
      "-v", "/var/run/docker.sock:/var/run/docker.sock",
      "-v", `${path.join(__dirname, "../reports")}:/reports`,
      "aquasec/trivy", "image",
      "--format", "template", "--template", "@/contrib/html.tpl",
      "-o", "/reports/cve_report.html",
      "secure_template-web:latest"
    ]);

    child.stdout.on("data", (data) => { res.write(data); });
    child.stderr.on("data", (data) => { res.write(data); });

    child.on("close", (code) => {
      if (code === 0) {
        res.write("\n[SUCCESS] CVE Scan completed successfully.\n");
      } else {
        res.write(`\n[ERROR] CVE Scan process exited with code ${code}\n`);
      }
      res.end();
    });
  });
});

// Serve Secrets report
app.get("/reports/secrets_report.json", (req, res) => {
  const reportPath = "/app/reports/secrets.json";
  if (fs.existsSync(reportPath)) {
    res.sendFile(reportPath);
  } else {
    res.status(404).send("Secrets Report not found");
  }
});

// API: Secret Scan - Streaming
app.get("/api/scan-secrets", (req, res) => {


  res.setHeader("Content-Type", "text/plain");
  res.setHeader("Transfer-Encoding", "chunked");

  // We run the container as an ephemeral run command to control execution from here
  // Note: We mount the host directory to scan it. In a real production env, this might be a CI step.
  const child = spawn("docker", [
    "run",
    "--rm",
    "-v",
    `${path.join(__dirname, "../")}:/app`,   // Scan the parent folder (project root)
    "-v",
    `${path.join(__dirname, "../reports")}:/reports`,
    "trufflesecurity/trufflehog:latest",
    "filesystem",
    "/app",
    "--json",
    "--no-verification",
    "--fail" // Return exit code if secrets found
  ]);

  // TruffleHog outputs found secrets to stdout in JSON lines
  // We want to capture them to a file AND stream to the user log
  const reportFile = fs.createWriteStream("/app/reports/secrets.json");

  child.stdout.on("data", (data) => {
    res.write(data);
    reportFile.write(data);
  });

  child.stderr.on("data", (data) => {
    res.write(data);
  });

  child.on("close", (code) => {
    reportFile.end();
    if (code === 0) {
      res.write("\n[SUCCESS] Secret Scan completed. No secrets found.\n");
    } else if (code === 183) { // TruffleHog specific code for "issues found"
      res.write("\n[WARNING] Secrets FOUND! Check the report.\n");
    } else {
      res.write(`\n[ERROR] Secret Scan process exited with code ${code}\n`);
    }
    res.end();
  });
});

app.listen(PORT, () => {
  console.log(`Dashboard running on http://localhost:${PORT}`);
});
