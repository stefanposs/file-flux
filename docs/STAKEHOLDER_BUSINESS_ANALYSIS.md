# FileFlux — Stakeholder & Business Analysis

**Date:** February 12, 2026  
**Status:** Draft  
**Audience:** Founders, Investors, Product Leadership  
**Document Type:** Strategic Business Analysis

---

## Executive Summary

FileFlux is a self-hosted Managed File Transfer (MFT) platform targeting mid-market enterprises (500–5,000 employees), initially in the DACH region. It fills a clear market gap: existing MFT solutions are either prohibitively expensive (Stonebranch at €100K+/year, IBM Sterling), recovering from catastrophic security failures (MOVEit's 2023 breach affecting 2,500+ organizations), or built on aging technology stacks (GoAnywhere's Java monolith, Globalscape's Windows-only architecture).

FileFlux's core differentiation is **modern architecture at mid-market pricing**: a single-binary Go backend with no JVM/runtime dependencies, lightweight Lit Web Components frontend (7KB vs 40KB React bundles), cross-platform agents, and a deployment model that gives enterprises full data sovereignty — critical in the post-Schrems II EU regulatory environment.

**The market opportunity is real:** The global MFT market is valued at ~$1.8B (2024) with 8–10% annual growth, driven by increasing regulatory pressure (GDPR, NIS2, DORA) and the move away from ad-hoc SFTP scripts toward auditable, automated transfer platforms.

---

## 1. Business Goals & Vision

### Core Value Proposition

> **"Enterprise-grade file transfer automation without enterprise-grade complexity or cost — fully self-hosted, fully under your control."**

### The Problem FileFlux Solves

Mid-market enterprises face a painful dilemma:

| Option | Problem |
|--------|---------|
| **Manual SFTP/FTP scripts** | No audit trail, no monitoring, no retry logic, compliance risk |
| **Cloud transfer services (AWS, Azure)** | Data leaves the organization; GDPR/sovereignty concerns |
| **GoAnywhere MFT** | Java runtime dependency, €15K+/year, complex deployment |
| **Stonebranch / IBM Sterling** | €100K+/year, 6-month implementation, oversized for mid-market |
| **MOVEit** | Trust deficit after 2023 breach; 2,500+ organizations compromised |

FileFlux solves this by offering:

1. **Zero-dependency deployment** — Single Go binary + PostgreSQL. No JVM, no application server, no runtime licensing.
2. **Full data sovereignty** — All data stays on-premise or in the customer's private cloud. No phone-home, no telemetry.
3. **Modern developer experience** — REST API, WebSocket real-time updates, infrastructure-as-code friendly (Helm, Docker Compose).
4. **Transparent, predictable pricing** — Per-agent licensing with no per-GB transfer fees. Customers know their cost upfront.

### Strategic Vision (3-Year Horizon)

| Timeframe | Goal |
|-----------|------|
| **Year 1 (2026)** | MVP launch → 10 paying customers in DACH, establish product-market fit |
| **Year 2 (2027)** | Feature parity with GoAnywhere core features, 50+ customers, EU expansion |
| **Year 3 (2028)** | Advanced workflows, marketplace integrations, 150+ customers, SOC 2 certification |

---

## 2. Target Personas

### Primary Personas

#### Persona 1: "Klaus" — IT Infrastructure Manager
- **Company:** 800 employees, manufacturing, southern Germany
- **Age:** 42, 15+ years in IT operations
- **Pain:** Manages 30+ SFTP scripts across cron jobs on 12 servers. No central view. Gets called at 2am when a critical ERP data feed fails silently.
- **Need:** Central dashboard, automated retries, alerting, audit trail for ISO 27001 audits.
- **Budget authority:** Up to €25K/year without board approval.
- **Decision criteria:** Must run on-premise (factory floor data cannot leave the network). Must support Linux and Windows. Must not require Java.

#### Persona 2: "Sarah" — DevOps Engineer
- **Company:** 1,200 employees, fintech, Zurich
- **Age:** 31, cloud-native background
- **Pain:** Inherited a GoAnywhere installation from the previous team. Hates the Java admin console. Can't integrate it into their Terraform/Kubernetes workflow.
- **Need:** Helm chart, API-first design, Prometheus metrics, infrastructure-as-code deployment.
- **Budget authority:** Recommends tools; CTO approves.
- **Decision criteria:** Must have a modern API. Must be containerable. Must expose Prometheus metrics.

#### Persona 3: "Dr. Müller" — Chief Information Security Officer (CISO)
- **Company:** 2,500 employees, healthcare group, Austria
- **Age:** 48, compliance-focused
- **Pain:** After the MOVEit breach, the board mandated replacing all third-party cloud transfer tools. Needs an auditable, on-premise solution.
- **Need:** End-to-end encryption, immutable audit logs, RBAC, GDPR-compliant data handling, SHA-256 integrity verification.
- **Budget authority:** €50K+ with board backing for security initiatives.
- **Decision criteria:** Must be self-hosted. Must have audit logging. Must support encryption at rest and in transit.

#### Persona 4: "Thomas" — System Administrator
- **Company:** 600 employees, logistics, Germany
- **Age:** 35, generalist IT
- **Pain:** Moves CSV export files between ERP, warehouse management, and shipping systems manually. Uses USB sticks for some transfers between air-gapped networks.
- **Need:** Simple agent installation, scheduled transfers, file-based triggers (watch a directory, auto-transfer new files).
- **Budget authority:** None — submits requests to IT manager.
- **Decision criteria:** Must be easy to install. Must handle large files (CAD drawings from engineering). Must have a clear UI.

### Secondary Personas

| Persona | Role | Key Need |
|---------|------|----------|
| **Compliance Officer** | Auditor/regulatory | Exportable audit logs, transfer history reports, GDPR documentation |
| **CTO / IT Director** | Budget holder | TCO comparison vs. competitors, roadmap transparency, vendor stability |
| **External Partner** | Supplier/customer IT | Receive agent, minimal configuration, secure transfer acceptance |

---

## 3. User Stories (MVP — Prioritized)

### P0 — Must Have for v1.0 Launch

| # | As a... | I want to... | So that... | Acceptance Criteria |
|---|---------|-------------|-----------|-------------------|
| US-01 | IT Admin | install an agent on a Linux/Windows server in under 5 minutes | I can start transferring files without complex setup | Single script install, auto-registers with backend, shows as "online" in dashboard |
| US-02 | IT Admin | create a file transfer job between two agents | files move automatically between systems | Select source agent + path, destination agent + path, job runs successfully |
| US-03 | IT Admin | schedule a transfer job with cron syntax | transfers run automatically at defined intervals | Cron expression validated, next 5 runs previewed, job executes on schedule |
| US-04 | IT Admin | see real-time transfer progress in the dashboard | I know if something is stuck or failing | Progress bar updates live (SSE), shows bytes transferred, speed, ETA |
| US-05 | IT Admin | receive an alert when a transfer fails | I can react before it impacts business processes | Email/webhook notification within 60s of failure, includes error details |
| US-06 | IT Admin | resume a failed transfer from where it stopped | I don't waste bandwidth re-transferring completed parts | Chunked transfer with per-chunk tracking, resume from last successful chunk |
| US-07 | CISO | view an immutable audit log of all transfer activity | we can demonstrate compliance to auditors | Tamper-evident log, filterable by date/agent/user, exportable as CSV |
| US-08 | CISO | enforce TLS encryption for all agent communication | data in transit is protected | WebSocket connections require TLS, non-TLS connections rejected |
| US-09 | IT Admin | verify file integrity after transfer via SHA-256 hash | I can be certain the file wasn't corrupted or tampered with | Hash computed at source, verified at destination, mismatch triggers alert |
| US-10 | IT Admin | manage user accounts with role-based access (Admin/Operator/Viewer) | I can control who can create vs. only view jobs | Three roles enforced server-side, UI reflects permissions |

### P1 — Important for v1.0 Completeness

| # | As a... | I want to... | So that... |
|---|---------|-------------|-----------|
| US-11 | IT Admin | group agents logically (by location, department, function) | I can organize and manage 50+ agents efficiently |
| US-12 | IT Admin | configure retry policies per job (count, backoff) | transient failures auto-recover without manual intervention |
| US-13 | IT Admin | see a dashboard with transfer volume, success rates, and throughput trends | I can report on system health and capacity to management |
| US-14 | IT Admin | set up file-watching on an agent directory | files are transferred automatically when they appear (event-driven) |
| US-15 | DevOps | deploy FileFlux via Docker Compose with a single command | I can set up the platform in our existing container infrastructure |
| US-16 | DevOps | scrape Prometheus metrics from the backend | I can integrate FileFlux into our existing Grafana monitoring stack |
| US-17 | IT Admin | configure webhook notifications for transfer events | our ticketing/alerting system is notified automatically |
| US-18 | IT Admin | use API keys for service-to-service authentication | automated systems can trigger transfers without user credentials |

### P2 — Nice-to-Have for v1.0, Target for v1.1

| # | As a... | I want to... | So that... |
|---|---------|-------------|-----------|
| US-19 | IT Admin | define multi-step workflows (transfer → transform → forward) | I can build automated data pipelines |
| US-20 | Compliance Officer | generate a compliance report covering all transfers in a date range | I can prepare for ISO 27001 audits with one click |

---

## 4. MVP Scope Definition

### v1.0 — "Reliable Transfer" (Target: Week 24, ~6 months)

**Core capability:** Securely and reliably move files between N agents on a schedule, with monitoring and audit trail.

| Category | In Scope | Out of Scope (v2.0+) |
|----------|----------|---------------------|
| **Transfer Engine** | Chunked transfer with compression (zstd/LZ4), SHA-256 integrity, resume on failure, retry with backoff | Direct agent-to-agent transfer (P2P), multi-hop routing |
| **Scheduling** | Cron-based scheduling, manual trigger, file-watcher trigger | Calendar-based blackout windows, dependency chains |
| **Agents** | Linux (amd64/arm64), macOS (amd64/arm64), Windows (amd64), system service install | Agent auto-update, agent-side scripting, SFTP/FTP protocol support on agent |
| **Security** | JWT auth, RBAC (admin/operator/viewer), API keys, TLS, audit logging | LDAP/AD integration, SSO (SAML/OIDC), mTLS between agents |
| **UI** | Dashboard, job management, agent management, transfer monitoring, audit log viewer | Visual workflow builder, dark mode, mobile-responsive |
| **Deployment** | Docker Compose (dev + production), Helm chart (basic) | HA/clustering, multi-region, automated backups |
| **Monitoring** | Prometheus metrics, pre-built Grafana dashboard, health checks | Custom alerting rules, SLA tracking, capacity planning |
| **Protocols** | WebSocket (agent-to-backend) | SFTP, FTP, S3, Azure Blob — these are v2.0 connector plugins |
| **Compliance** | GDPR-friendly (self-hosted, no data export), audit log export | SOC 2 Type II certification, ISO 27001 formal certification |

### v2.0 — "Enterprise Integration" (Target: 12 months post v1.0)

- LDAP/Active Directory integration for user authentication
- Visual drag-and-drop workflow builder
- Protocol connectors: SFTP, S3, Azure Blob, SMB
- Direct agent-to-agent transfer (bypass backend relay)
- Agent auto-update with rollback
- Multi-tenant support
- Advanced reporting with PDF/CSV export
- SOC 2 Type II readiness

---

## 5. Revenue Model & Pricing Strategy

### Pricing Philosophy

Mid-market buyers need **predictable costs** they can budget annually. Per-GB pricing creates anxiety and unpredictable bills. Per-agent pricing aligns cost with infrastructure footprint — something IT managers understand intuitively.

### Pricing Tiers

| Tier | Agents Included | Price (Annual) | Price (Monthly) | Target Customer |
|------|----------------|----------------|-----------------|-----------------|
| **Starter** | Up to 5 agents | €4,800/year (€400/mo) | €480/mo | Small departments, pilot projects |
| **Professional** | Up to 25 agents | €12,000/year (€1,000/mo) | €1,200/mo | Mid-size companies, multi-site |
| **Enterprise** | Up to 100 agents | €28,800/year (€2,400/mo) | €2,880/mo | Large mid-market, many endpoints |
| **Custom** | 100+ agents | Custom pricing | — | Large enterprises |

### What's Included in All Tiers

- Unlimited transfers (no per-GB fees)
- Unlimited users
- All compression, encryption, and integrity features
- Community support (forum + docs)
- Docker Compose + Helm deployment
- Software updates for the license period

### Paid Add-Ons

| Add-On | Price | Description |
|--------|-------|-------------|
| **Priority Support** | €2,400/year | 4h response SLA, dedicated support channel |
| **Premium Support** | €6,000/year | 1h response SLA, named account engineer, on-call |
| **Onboarding Package** | €3,000 one-time | Installation assistance, agent deployment, 2 days of training |
| **Protocol Connectors** (v2.0) | €1,200/year each | SFTP, S3, Azure Blob, SMB connectors |

### Revenue Projections (Conservative)

| Year | Customers | Avg. Revenue/Customer | ARR |
|------|-----------|----------------------|-----|
| Year 1 | 10 | €12,000 | €120,000 |
| Year 2 | 40 | €15,000 | €600,000 |
| Year 3 | 100 | €18,000 | €1,800,000 |

### Competitive Price Positioning

```
                              Annual Cost (€)
IBM Sterling    ████████████████████████████████████████████  €150,000+
Stonebranch     ██████████████████████████████████████        €100,000+
GoAnywhere MFT  ████████████████                              €15,000+
FileFlux Prof.  ████████                                      €12,000
FileFlux Start. ████                                          €4,800
SFTP Scripts    █                                             €0 (but hidden costs)
```

**Key message:** FileFlux costs 20–80% less than comparable MFT solutions, with no per-GB surprise fees.

### Free Trial Strategy

- **30-day full-featured trial**, no credit card required
- Up to 3 agents during trial
- Automatic conversion to paid if agents remain registered
- Trial generates an audit log customers can use to justify purchase internally

---

## 6. Go-to-Market Strategy (DACH Focus)

### Phase 1: Foundation (Months 1–6)

| Channel | Action | Investment | Expected Result |
|---------|--------|------------|-----------------|
| **Content Marketing** | Publish "MFT Buyer's Guide for Mid-Market" (DE/EN), comparison posts (FileFlux vs. GoAnywhere, vs. MOVEit) | €5K content budget | SEO authority, organic leads |
| **Technical Blog** | Weekly posts: "Replace your SFTP scripts in 30 minutes," "MFT compliance checklist for GDPR," "Why Java-based MFT is a liability" | Internal time | Developer trust, organic traffic |
| **Open-Source Community** | Open-source the agent (not the backend), accept contributions | Internal time | Trust signal, community-driven distribution |
| **GitHub Presence** | Active README, clear docs, quick-start guide that actually works | Internal time | Developer discovery, try-before-buy |
| **Direct Outreach** | Target 50 manufacturing and logistics companies in Bavaria and Baden-Württemberg with SFTP pain points | €3K tools (CRM, email) | 5–10 demo calls |

### Phase 2: Traction (Months 6–12)

| Channel | Action | Investment | Expected Result |
|---------|--------|------------|-----------------|
| **Partner Channel** | Partner with 2–3 DACH IT consultancies/MSPs who serve mid-market manufacturers | Revenue share (20%) | Reach customers who don't search for MFT |
| **Trade Shows** | Attend IT-SA (Nuremberg, security focus), Hannover Messe (manufacturing) | €10K per event | 20+ qualified leads per event |
| **Case Studies** | Publish 3 detailed customer case studies (manufacturing, finance, healthcare) | Customer incentive (discount) | Social proof for sales conversations |
| **Webinars** | Monthly "MFT Modernization" webinar in German | €1K/month tooling | 15–30 registrants/month, nurture pipeline |

### Phase 3: Scale (Months 12–24)

| Channel | Action |
|---------|--------|
| **EU Expansion** | Localize for Benelux, Nordics (English-first markets) |
| **AWS/Azure Marketplace** | List as a self-hosted image for cloud-hosted private deployments |
| **Integration Partners** | Pre-built connectors for SAP, ServiceNow, Jira — triggers and notifications |
| **Analyst Relations** | Brief Gartner/Forrester for MFT Magic Quadrant inclusion |

### Ideal Customer Profile (ICP)

- **Size:** 500–5,000 employees
- **Industry:** Manufacturing, logistics, finance, healthcare (data-heavy, compliance-driven)
- **Geography:** DACH (initially), then EU
- **Tech maturity:** Has IT team (3+ people), uses Linux servers, has some Docker/container experience
- **Trigger events:** ISO 27001 audit, MOVEit breach fallout, GoAnywhere renewal, legacy system modernization mandate

---

## 7. Success Metrics — First 12 Months

### Business KPIs

| Metric | Month 3 | Month 6 | Month 12 | Measurement |
|--------|---------|---------|----------|-------------|
| **Trial sign-ups** | 15 | 50 | 150 | Download/install tracking |
| **Paying customers** | 1 | 5 | 10 | CRM |
| **ARR** | €5K | €40K | €120K | Billing system |
| **Trial → Paid conversion** | — | 10% | 12% | CRM funnel |
| **Net Promoter Score (NPS)** | — | — | 40+ | Customer survey |
| **Churn rate** | — | — | <5% annual | Renewal tracking |

### Product KPIs

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Time to first transfer** | <30 minutes from download | Onboarding analytics |
| **Agent install success rate** | >95% on first attempt | Install script telemetry (opt-in) |
| **Transfer success rate** | >99.5% | Backend metrics |
| **Transfer throughput** | >100 MB/s (local network) | Performance benchmarks |
| **Dashboard load time** | <2 seconds | Frontend metrics |
| **API response time (p95)** | <200ms | Prometheus |
| **System uptime** | >99.9% | Health checks |
| **Support ticket resolution** | <24h (community), <4h (priority) | Support system |

### Engineering KPIs

| Metric | Target |
|--------|--------|
| Backend test coverage | >80% |
| Frontend test coverage | >70% |
| CI pipeline pass rate | >95% |
| Time to deploy a release | <1 hour |
| Open critical bugs | 0 (zero tolerance) |

---

## 8. Risk Analysis

### Business Risks

| # | Risk | Impact | Likelihood | Mitigation |
|---|------|--------|------------|------------|
| R1 | **Slow enterprise sales cycles** — Mid-market deals take 3–6 months to close | High | High | Offer 30-day free trial to reduce friction. Target departments with autonomous budgets (<€25K). Create ROI calculator. |
| R2 | **GoAnywhere drops pricing** — Fortra responds to competitive pressure by offering discounts | Medium | Medium | Compete on total cost of ownership (no Java runtime, simpler deployment). Focus on DX and modern architecture, not just price. |
| R3 | **Security vulnerability in FileFlux** — A breach would be devastating given MOVEit positioning | Critical | Low | Security-first development. External penetration testing before v1.0. Bug bounty program. Rapid patch process (<24h for critical CVEs). |
| R4 | **Key person dependency** — Small team, specialized Go/Lit skills | High | Medium | Document architecture decisions (ADRs). Ensure two people understand every component. Use standard, well-documented libraries. |
| R5 | **Customer requires features not in MVP** — LDAP, SFTP connectors, HA clustering | Medium | High | Clear public roadmap. Offer paid acceleration for specific features if customer commits to annual contract. |
| R6 | **Regulatory changes** — New EU regulations (NIS2, DORA) add compliance requirements | Medium | Medium | Monitor regulatory landscape. Design audit system to be extensible. Position regulatory pressure as a tailwind (more compliance = more MFT demand). |

### Technical Risks

| # | Risk | Impact | Likelihood | Mitigation |
|---|------|--------|------------|------------|
| T1 | **WebSocket binary protocol bugs** at scale | High | Medium | Contract tests, table-driven test suites, load testing with 100+ agents |
| T2 | **Transfer engine memory pressure** with many concurrent large files | High | Medium | Stream-based processing (never buffer entire file), per-agent concurrency limits |
| T3 | **Cross-platform agent issues** (Windows service management, path handling) | Medium | Medium | CI testing on Linux/macOS/Windows, platform-specific integration tests |
| T4 | **PostgreSQL performance** at 1M+ transfer records | Medium | Low | Partitioning strategy, index optimization, archival policy for old records |

---

## 9. Competitive Differentiation

### Feature Comparison Matrix

| Capability | FileFlux | GoAnywhere MFT | MOVEit | Stonebranch |
|------------|----------|---------------|--------|-------------|
| **Deployment** | Single binary + PostgreSQL | Java app server + DB | Windows Server + IIS + DB | Complex multi-component |
| **Runtime deps** | None (Go binary) | JVM 11+ | .NET Framework | JVM + proprietary runtime |
| **Install time** | <30 minutes | 2–4 hours | 4–8 hours | Days/weeks |
| **Agent footprint** | ~15 MB binary | ~200 MB + JRE | ~100 MB + .NET | ~300 MB |
| **Container-native** | Yes (Docker/K8s first-class) | Retrofit (not designed for it) | No | Partial |
| **API-first** | REST + WebSocket + SSE | REST (limited) | REST (limited) | SOAP + REST |
| **Prometheus metrics** | Built-in | No (custom monitoring) | No | Proprietary monitoring |
| **Compression** | zstd + LZ4 (modern) | ZIP (legacy) | ZIP | ZIP |
| **Resumable transfers** | Chunk-level resume | File-level restart | File-level restart | File-level restart |
| **Data sovereignty** | 100% on-premise | On-premise or cloud | Cloud option raises concerns | On-premise |
| **Entry price** | €4,800/year | ~€15,000/year | ~€12,000/year | ~€100,000/year |
| **Per-GB fees** | None | Yes (some tiers) | Yes | Volume-based |
| **Open-source agent** | Yes (planned) | No | No | No |

### Win Themes by Competitor

**vs. GoAnywhere MFT (primary competitor):**
- "No Java runtime to manage and patch. No JVM tuning. No OutOfMemoryErrors."
- "Container-native deployment in 5 minutes, not 5 hours."
- "Modern compression (zstd) achieves 60–70% reduction vs. GoAnywhere's ZIP at 40–50%."
- "Predictable pricing without per-GB transfer fees."

**vs. MOVEit:**
- "Full data sovereignty. Your data never touches a vendor's cloud."
- "Built with security-first architecture after learning from the industry's mistakes." (Subtle reference to 2023 breach without direct naming.)
- "No Windows Server or IIS dependency."

**vs. Stonebranch / IBM Sterling:**
- "90% of the capability at 10% of the cost."
- "Deploy in a day, not in a quarter."
- "Right-sized for mid-market — you don't need an aircraft carrier to cross a river."

**vs. SFTP scripts / manual processes:**
- "Central monitoring instead of hoping cron jobs don't fail silently."
- "Audit trail for your next ISO 27001 audit."
- "Automatic retries, compression, and integrity checking — no shell script can do this reliably."

---

## 10. Compliance & Regulatory Requirements

### GDPR (General Data Protection Regulation)

| Requirement | FileFlux Approach |
|-------------|-------------------|
| **Data minimization** | FileFlux transfers files but doesn't store file contents on the backend. The backend is a control plane, not a data plane. |
| **Right to erasure** | User accounts and audit logs can be purged. Transfer metadata retention period is configurable. |
| **Data processing agreement (DPA)** | FileFlux is self-hosted — the customer is both data controller and data processor. No DPA with FileFlux needed for the software itself. |
| **Data transfer outside EU** | Not applicable — software runs entirely within the customer's infrastructure. No data leaves their network. |
| **Breach notification** | Audit logs provide the forensic trail required for Article 33 breach notifications. Transfer records show exactly what was moved, when, and to where. |
| **Privacy by design** | End-to-end TLS encryption, SHA-256 integrity verification, RBAC access controls. |

### ISO 27001 Considerations

| Control Area | FileFlux Support |
|-------------|-----------------|
| **A.8 — Asset Management** | Agent inventory, agent groups, agent health monitoring |
| **A.9 — Access Control** | RBAC (admin/operator/viewer), API key management, JWT authentication |
| **A.10 — Cryptography** | TLS 1.3 for transport, AES-256 option for at-rest, SHA-256 integrity |
| **A.12 — Operations Security** | Immutable audit log, structured logging, Prometheus monitoring |
| **A.13 — Communications Security** | Encrypted WebSocket (WSS), no plaintext transfer option in production |
| **A.14 — System Acquisition** | Self-hosted deployment, customer controls all infrastructure |
| **A.16 — Incident Management** | Failed transfer alerting, webhook notifications, audit trail |
| **A.18 — Compliance** | Audit log export, transfer history reports, configurable retention |

### SOC 2 Type II Readiness (v2.0 Target)

FileFlux v1.0 will implement the foundational controls. Formal SOC 2 certification is a v2.0 objective.

| Trust Service Criteria | v1.0 Coverage | v2.0 Addition |
|----------------------|---------------|---------------|
| **Security** | TLS, RBAC, audit logging, API keys | Penetration test report, vulnerability scanning |
| **Availability** | Health checks, monitoring, retry logic | HA deployment guide, SLA commitments |
| **Processing Integrity** | SHA-256 hashing, chunk verification | End-to-end transfer certification report |
| **Confidentiality** | Encryption in transit, RBAC | Encryption at rest, data classification |
| **Privacy** | Self-hosted (customer controls data) | Privacy impact assessment template |

### NIS2 Directive (EU, effective October 2024)

Relevant for customers in critical infrastructure sectors (energy, transport, health, digital infrastructure):

- **Supply chain security:** FileFlux is self-hosted, eliminating supply chain risk from cloud vendors.
- **Incident reporting:** Audit logs provide the data needed for mandatory 24-hour incident reports.
- **Risk management:** Transfer monitoring and alerting enable proactive risk management.
- **Encryption requirements:** End-to-end TLS satisfies NIS2 encryption mandates.

### DORA (Digital Operational Resilience Act, EU financial sector)

Relevant for financial institution customers:

- **ICT risk management:** Comprehensive transfer monitoring and alerting.
- **Incident reporting:** Detailed audit trail with exportable logs.
- **Resilience testing:** Resumable transfers and retry policies ensure operational resilience.
- **Third-party risk:** Self-hosted model eliminates third-party cloud dependency risk.

---

## Appendix A: Competitive Pricing Research

| Vendor | List Price | What You Actually Pay | Hidden Costs |
|--------|-----------|----------------------|-------------|
| **GoAnywhere MFT** | Starting at ~$15K/year | $20–40K with modules and support | Per-GB fees on some tiers, Java runtime management, complex upgrades |
| **MOVEit Transfer** | Starting at ~$12K/year | $25–50K with HA and support | Windows Server licensing, IIS management, SSL certificate management |
| **Stonebranch UAC** | Custom (typically $100K+) | $100–300K/year | Implementation consulting ($50–100K), training, custom integrations |
| **IBM Sterling** | Custom (enterprise-only) | $150K–500K/year | Mandatory professional services, proprietary monitoring tools |
| **Globalscape EFT** | Starting at ~$10K/year | $15–30K with modules | Windows-only, aging technology, limited cloud integration |
| **FileFlux** | Starting at €4,800/year | €4,800–28,800/year | None — all features included, no per-GB fees |

## Appendix B: Market Size Estimation (DACH)

| Segment | Companies in DACH | MFT Addressable (est.) | FileFlux Target (3yr) |
|---------|------------------|----------------------|---------------------|
| Manufacturing (500–5K employees) | ~12,000 | ~3,000 (25% need MFT) | 40 |
| Financial services | ~4,000 | ~2,000 (50% need MFT) | 25 |
| Healthcare | ~3,000 | ~1,000 (33% need MFT) | 15 |
| Logistics & transport | ~5,000 | ~1,500 (30% need MFT) | 15 |
| Other (retail, energy, etc.) | ~8,000 | ~1,500 | 5 |
| **Total** | **~32,000** | **~9,000** | **100** |

**Serviceable Addressable Market (SAM):** ~9,000 companies × €15,000 avg. = **~€135M annual opportunity in DACH alone.**

**FileFlux 3-year target:** 100 customers × €18,000 avg. = **€1.8M ARR** = 1.3% market penetration.

---

## Appendix C: Decision Framework — "Build vs. Buy vs. FileFlux"

For sales conversations and customer-facing material:

| Criteria | Build In-House (Scripts) | Buy GoAnywhere/MOVEit | Buy FileFlux |
|----------|------------------------|--------------------|-------------|
| **Upfront cost** | €0 | €15–50K | €4.8–28.8K |
| **Ongoing cost** | €20–40K/year (engineer time) | €15–50K/year + ops | €4.8–28.8K/year |
| **Time to production** | 3–6 months | 2–4 weeks | 1–3 days |
| **Audit compliance** | ❌ Custom build | ✅ Built-in | ✅ Built-in |
| **Monitoring** | ❌ Build from scratch | ✅ Proprietary dashboard | ✅ Grafana/Prometheus |
| **Retry & resume** | ❌ Complex to build | ✅ File-level | ✅ Chunk-level |
| **Maintenance burden** | High (your responsibility) | Medium (vendor updates, Java patches) | Low (single binary, auto-migration) |
| **Data sovereignty** | ✅ Full control | ⚠️ Depends on deployment | ✅ Full control |
| **Vendor lock-in** | N/A | High (proprietary formats) | Low (standard protocols, open agent) |

---

*This document should be reviewed quarterly and updated as market conditions, competitive landscape, and product capabilities evolve.*

*Next review: May 2026*
