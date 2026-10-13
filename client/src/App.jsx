
import { useEffect, useRef, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import {
  ShieldCheck,
  Upload,
  FileText,
  Activity,
  AlertTriangle,
  Globe,
  Download,
  RefreshCw,
  Search,
  CheckCircle2,
  Clock3,
  Terminal,
} from "lucide-react";
import "./App.css";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";

function formatNumber(value) {
  return Number(value || 0).toLocaleString();
}

function shortHour(value) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "UTC",
      });
}

export default function App() {
  const [job, setJob] = useState(null);
  const [report, setReport] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [search, setSearch] = useState("");
  const [severity, setSeverity] = useState("all");
  const [activeNav, setActiveNav] = useState("Overview");

  const fileRef = useRef(null);

  async function request(path, options = {}) {
    const response = await fetch(`${API}${path}`, options);
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.error || `Request failed (${response.status})`);
    }

    return data;
  }

  async function startJob(path, options = {}) {
    setBusy(true);
    setError("");
    setReport(null);
    setJob(null);

    try {
      const data = await request(path, options);
      setJob(data.job);
    } catch (err) {
      setError(err.message || "Could not start analysis.");
      setBusy(false);
    }
  }

  async function uploadFile(event) {
    event.preventDefault();

    if (!selectedFile) {
      setError("Choose a .log or .txt file first.");
      return;
    }

    const form = new FormData();
    form.append("file", selectedFile);

    await startJob("/api/upload", {
      method: "POST",
      body: form,
    });
  }

  async function runDemo() {
    await startJob("/api/demo", { method: "POST" });
  }

  useEffect(() => {
    if (!job?.id) return;

    let cancelled = false;
    let timeoutId;
    const jobId = job.id;

    async function poll() {
      try {
        const data = await request(`/api/jobs/${jobId}`);
        if (cancelled) return;

        const currentJob = data.job;

        if (currentJob.status === "completed") {
          const reportData = await request(
            `/api/jobs/${jobId}/report?format=json`
          );

          if (cancelled) return;

          setReport(reportData);
          setJob(currentJob);
          setBusy(false);
          return;
        }

        if (currentJob.status === "failed") {
          setJob(currentJob);
          setError(currentJob.error || "Analysis failed.");
          setBusy(false);
          return;
        }

        setJob(currentJob);
        timeoutId = setTimeout(poll, 1000);
      } catch (err) {
        if (cancelled) return;
        setError(err.message || "Could not retrieve analysis results.");
        setBusy(false);
      }
    }

    poll();

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [job?.id]);

  function navigateTo(label, sectionId) {
    setActiveNav(label);
    document.getElementById(sectionId)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  function handleNavKeyDown(event, label, sectionId) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      navigateTo(label, sectionId);
    }
  }

  function downloadCsv() {
    if (!job?.id) return;

    window.open(
      `${API}/api/jobs/${job.id}/report?format=csv`,
      "_blank",
      "noopener,noreferrer"
    );
  }

  const summary = report?.summary;
  const findings = report?.findings || [];
  const attacksPerHour = report?.attacksPerHour || [];
  const topAttackers = report?.topAttackers || [];
  const attackTypes = summary?.attackTypeCounts || {};

  const filteredFindings = findings.filter((item) => {
    const query = search.toLowerCase();

    const matchesSearch = [
      item.ip,
      item.path,
      item.attackName,
      item.type,
      item.country,
    ].some((value) =>
      String(value || "").toLowerCase().includes(query)
    );

    return (
      matchesSearch &&
      (severity === "all" || item.severity === severity)
    );
  });

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">
            <ShieldCheck size={24} />
          </div>
          <div>
            <div className="brand-name">LogLens</div>
            <div className="brand-subtitle">SECURITY ANALYTICS</div>
          </div>
        </div>

        <div className="side-label">WORKSPACE</div>

        <div
          className={`nav-item ${activeNav === "Overview" ? "active" : ""}`}
          role="button"
          tabIndex={0}
          onClick={() => navigateTo("Overview", "overview-section")}
          onKeyDown={(e) =>
            handleNavKeyDown(e, "Overview", "overview-section")
          }
        >
          <Activity size={18} />
          <span>Overview</span>
        </div>

        <div
          className={`nav-item ${activeNav === "Log analysis" ? "active" : ""}`}
          role="button"
          tabIndex={0}
          onClick={() => navigateTo("Log analysis", "log-analysis-section")}
          onKeyDown={(e) =>
            handleNavKeyDown(e, "Log analysis", "log-analysis-section")
          }
        >
          <FileText size={18} />
          <span>Log analysis</span>
        </div>

        <div
          className={`nav-item ${activeNav === "Threat findings" ? "active" : ""}`}
          role="button"
          tabIndex={0}
          onClick={() =>
            navigateTo("Threat findings", "threat-findings-section")
          }
          onKeyDown={(e) =>
            handleNavKeyDown(e, "Threat findings", "threat-findings-section")
          }
        >
          <AlertTriangle size={18} />
          <span>Threat findings</span>
        </div>

        <div className="sidebar-bottom">
          <div className="status-dot" />
          <div>
            <div className="connection-title">Analysis engine</div>
            <div className="connection-status">Local API · Port 5000</div>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumb">
            Workspace <span>/</span> {activeNav}
          </div>

          <div className="topbar-right">
            <span className="live-indicator">
              <span /> SYSTEM READY
            </span>
            <div className="avatar">LL</div>
          </div>
        </header>

        <section className="page-heading" id="overview-section">
          <div>
            <div className="eyebrow">
              SECURITY OPERATIONS / LOG INTELLIGENCE
            </div>
            <h1>Security overview</h1>
            <p className="muted">
              Analyze web server logs and identify suspicious activity.
            </p>
          </div>

          <button
            className="button button-secondary"
            onClick={() => window.location.reload()}
            disabled={busy}
          >
            <RefreshCw size={16} /> Reset dashboard
          </button>
        </section>

        <section className="upload-panel" id="log-analysis-section">
          <div className="upload-copy">
            <div className="panel-icon">
              <Upload size={21} />
            </div>
            <div>
              <h2>Analyze access logs</h2>
              <p>Upload an Apache or Nginx log file to begin analysis.</p>
              <span className="file-limit">LOG / TXT · MAX 100 MB</span>
            </div>
          </div>

          <form className="upload-actions" onSubmit={uploadFile}>
            <input
              ref={fileRef}
              type="file"
              accept=".log,.txt,text/plain"
              hidden
              onChange={(event) => {
                setSelectedFile(event.target.files?.[0] || null);
                setError("");
              }}
            />

            <button
              type="button"
              className="button button-secondary"
              onClick={() => fileRef.current?.click()}
              disabled={busy}
            >
              <FileText size={16} />
              {selectedFile ? selectedFile.name : "Choose log file"}
            </button>

            <button
              type="submit"
              className="button button-primary"
              disabled={busy || !selectedFile}
            >
              <Upload size={16} /> Upload &amp; analyze
            </button>

            <button
              type="button"
              className="button button-demo"
              onClick={runDemo}
              disabled={busy}
            >
              <Terminal size={16} /> Run demo
            </button>
          </form>

          {busy && (
            <div className="progress-area">
              <div className="progress-label">
                <span>
                  <RefreshCw size={14} className="spin" />
                  Analyzing {job?.filename || "log file"}…
                </span>
                <strong>{job?.progress ?? 0}%</strong>
              </div>

              <div className="progress-track">
                <div
                  className="progress-fill"
                  style={{ width: `${job?.progress ?? 0}%` }}
                />
              </div>

              <small>Status: {job?.status || "starting"}</small>
            </div>
          )}

          {error && <div className="error-message">{error}</div>}

          {job?.status === "completed" && report && (
            <div className="success-message">
              <CheckCircle2 size={17} />
              Analysis completed for {job.filename}. Report loaded successfully.
            </div>
          )}
        </section>

        <div className="section-heading">
          <div>
            <h2>Analysis summary</h2>
            <p>Metrics from the latest completed job.</p>
          </div>

          {report && (
            <button
              className="button button-secondary"
              onClick={downloadCsv}
            >
              <Download size={16} /> Export CSV
            </button>
          )}
        </div>

        <section className="metric-grid">
          <MetricCard
            icon={<FileText size={19} />}
            label="Requests parsed"
            value={summary ? formatNumber(summary.parsedLines) : "—"}
            note={
              summary
                ? `${formatNumber(summary.invalidLines)} invalid lines`
                : "Awaiting analysis"
            }
          />

          <MetricCard
            icon={<AlertTriangle size={19} />}
            label="Attack matches"
            value={summary ? formatNumber(summary.totalAttackMatches) : "—"}
            note="Signature and brute-force matches"
            accent="red"
          />

          <MetricCard
            icon={<Activity size={19} />}
            label="Affected requests"
            value={summary ? formatNumber(summary.detectedRequests) : "—"}
            note="Requests with at least one detection"
            accent="amber"
          />

          <MetricCard
            icon={<Globe size={19} />}
            label="Attacker IPs"
            value={report ? formatNumber(topAttackers.length) : "—"}
            note="Top 20 shown below"
            accent="blue"
          />
        </section>

        <section className="charts-grid">
          <div className="panel chart-panel">
            <div className="panel-heading">
              <div>
                <h3>Attacks over time</h3>
                <p>Detection matches grouped by UTC hour</p>
              </div>
              <span className="chart-tag">HOURLY</span>
            </div>

            {attacksPerHour.length ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={attacksPerHour}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="#e8edf3"
                  />
                  <XAxis
                    dataKey="hour"
                    tickFormatter={shortHour}
                    tick={{ fontSize: 11, fill: "#78869a" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 11, fill: "#78869a" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    labelFormatter={(value) =>
                      new Date(value).toLocaleString()
                    }
                  />
                  <Bar
                    dataKey="count"
                    name="Attack matches"
                    fill="#6178ed"
                    radius={[5, 5, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState message="Run an analysis to see attack activity." />
            )}
          </div>

          <div className="panel chart-panel">
            <div className="panel-heading">
              <div>
                <h3>Detection categories</h3>
                <p>Matches by detection signature</p>
              </div>
            </div>

            <div className="category-list">
              {Object.entries(attackTypes).length ? (
                Object.entries(attackTypes)
                  .sort((a, b) => b[1] - a[1])
                  .map(([name, count]) => {
                    const total = summary.totalAttackMatches || 1;

                    return (
                      <div className="category-row" key={name}>
                        <div className="category-label">
                          <span>{name.replaceAll("-", " ")}</span>
                          <strong>{formatNumber(count)}</strong>
                        </div>
                        <div className="category-track">
                          <div
                            className="category-fill"
                            style={{
                              width: `${Math.max(3, (count / total) * 100)}%`,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })
              ) : (
                <EmptyState message="Detection breakdown appears after analysis." />
              )}
            </div>

            {summary && (
              <div className="severity-summary">
                <span>
                  <i className="severity-dot high" /> High
                  <strong>{summary.severityCounts?.high || 0}</strong>
                </span>
                <span>
                  <i className="severity-dot medium" /> Medium
                  <strong>{summary.severityCounts?.medium || 0}</strong>
                </span>
                <span>
                  <i className="severity-dot low" /> Low
                  <strong>{summary.severityCounts?.low || 0}</strong>
                </span>
              </div>
            )}
          </div>
        </section>

        <section className="panel table-panel">
          <div className="panel-heading table-heading">
            <div>
              <h3>Top attacker IPs</h3>
              <p>Sources ranked by detected attack matches</p>
            </div>
            <span className="result-count">
              {topAttackers.length} sources
            </span>
          </div>

          {topAttackers.length ? (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>IP ADDRESS</th>
                    <th>COUNTRY</th>
                    <th>REQUESTS</th>
                    <th>ATTACK MATCHES</th>
                    <th>DETECTION TYPES</th>
                  </tr>
                </thead>
                <tbody>
                  {topAttackers.map((attacker) => (
                    <tr key={attacker.ip}>
                      <td className="ip-cell">{attacker.ip}</td>
                      <td>{attacker.country || "Unknown"}</td>
                      <td>{formatNumber(attacker.requests)}</td>
                      <td>
                        <span className="attack-count">
                          {formatNumber(attacker.attacks)}
                        </span>
                      </td>
                      <td>{attacker.types?.join(", ") || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState message="No attacker IPs to display yet." />
          )}
        </section>

        <section
          className="panel table-panel findings-panel"
          id="threat-findings-section"
        >
          <div className="panel-heading table-heading">
            <div>
              <h3>Security findings</h3>
              <p>
                Showing up to {summary?.findingsStored ?? 0} stored findings
                {summary?.findingsTruncated
                  ? " · Results truncated at the storage limit"
                  : ""}
              </p>
            </div>
            <span className="result-count">
              {filteredFindings.length} results
            </span>
          </div>

          <div className="findings-filters">
            <div className="search-box">
              <Search size={16} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search IP, path, country, attack…"
              />
            </div>

            <select
              value={severity}
              onChange={(event) => setSeverity(event.target.value)}
              aria-label="Filter by severity"
            >
              <option value="all">All severities</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>

          {filteredFindings.length ? (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>SEVERITY</th>
                    <th>DETECTION</th>
                    <th>SOURCE IP</th>
                    <th>HTTP</th>
                    <th>REQUEST PATH</th>
                    <th>TIME (UTC)</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredFindings.map((item, index) => (
                    <tr key={`${item.lineNumber}-${item.type}-${index}`}>
                      <td>
                        <span
                          className={`severity-pill ${item.severity || "high"}`}
                        >
                          {item.severity || "unknown"}
                        </span>
                      </td>
                      <td className="finding-name">{item.attackName}</td>
                      <td className="ip-cell">{item.ip}</td>
                      <td>{item.statusCode}</td>
                      <td className="path-cell" title={item.path}>
                        {item.path}
                      </td>
                      <td>
                        {item.timestamp
                          ? new Date(item.timestamp).toLocaleString()
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              message={
                report
                  ? "No findings match these filters."
                  : "Upload a log or run the demo to see findings."
              }
            />
          )}
        </section>

        <footer className="footer">
          <span>
            <ShieldCheck size={15} /> LogLens · Log analysis prototype
          </span>
          <span>
            <Clock3 size={14} />
            {job?.completedAt
              ? `Last completed ${new Date(job.completedAt).toLocaleString()}`
              : "No completed analysis yet"}
          </span>
        </footer>
      </main>
    </div>
  );
}

function MetricCard({ icon, label, value, note, accent = "purple" }) {
  return (
    <div className="metric-card">
      <div className={`metric-icon ${accent}`}>{icon}</div>
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
      <div className="metric-note">{note}</div>
    </div>
  );
}

function EmptyState({ message }) {
  return (
    <div className="empty-state">
      <div className="empty-icon">
        <Activity size={20} />
      </div>
      <p>{message}</p>
    </div>
  );
}
