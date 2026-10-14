# LogLens — Simplified Security Log Analysis

**Live Application:** https://loglens-2enb.onrender.com/  
**Backend API:** https://loglens-api-toya.onrender.com  
**GitHub Repository:** https://github.com/sahilgoyal545/LogLens

## Overview

LogLens is a web-based security log analysis application designed to help users identify suspicious activity in Apache/Nginx-style web server access logs. It analyzes request patterns and presents findings in a dashboard for easier security investigation.

## Features

- Upload log files for analysis.
- Load a sample demo log.
- Identify suspicious patterns associated with SQL injection, cross-site scripting (XSS), and directory traversal.
- Highlight repeated HTTP 401 responses that may indicate brute-force activity.
- View analysis results through a dashboard.
- Filter findings and export results to CSV.
- Submit analysis jobs and retrieve their status and results.

## Technology Stack

- **Frontend:** React, Vite
- **Charts:** Recharts
- **Backend:** Node.js, Express
- **Deployment:** Render

## How to Use

1. Open the live application.
2. Select the demo log or upload a supported `.log` or `.txt` file.
3. Submit the file for analysis.
4. Review the analysis dashboard and available filters.
5. Export the results to CSV if required.

## Local Development

Clone the repository:

```bash
git clone https://github.com/sahilgoyal545/LogLens.git
cd LogLens
```

Install dependencies in the frontend and backend directories using their respective package files. Configure the frontend API URL to point to the backend, then start both services using the scripts defined in their `package.json` files.

Refer to the source code for the exact API routes and environment variables.

## Detection Approach

LogLens uses pattern-based detection to identify suspicious request strings. Repeated authentication failures from the same IP address can also indicate potentially malicious activity.

These detections support initial triage. A signature match does not prove that an attack succeeded, and legitimate requests may occasionally match a detection rule.

## Limitations

- Detection accuracy depends on the available signatures and supported log formats.
- GeoIP information, where available, depends on the configured lookup source.
- Large-file performance depends on parsing implementation, server resources, and hosting limits.
- Detection results should be reviewed before taking security actions.

## Security Notice

Use sanitized logs for demonstrations. Avoid uploading logs containing passwords, session tokens, personal information, or other sensitive data to a publicly accessible deployment.

## Performance

See [PERFORMANCE_NOTE.md](PERFORMANCE_NOTE.md) for the large-file processing approach, limitations, and recommended validation tests.