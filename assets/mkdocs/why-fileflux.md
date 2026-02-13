---
title: Why FileFlux
weight: 1
---

# Why FileFlux?

## The Problem

Mid-market enterprises (500–5,000 employees) need to exchange files reliably between servers, partners, and departments. Current options are:

- **Stonebranch / IBM Sterling** — Enterprise-grade but €100K+/year, months to deploy
- **GoAnywhere MFT** — Mid-market leader but Java-heavy, €15K+/year
- **MOVEit** — Suffered major security breach in 2023, trust eroded
- **DIY scripts** — Fragile, no audit trail, no monitoring, compliance nightmare

## The FileFlux Difference

### Self-Hosted & Sovereign
Your data stays on your infrastructure. No cloud dependency, no vendor lock-in. Deploy on bare metal, VMs, or Kubernetes.

### Modern Architecture
Built with Go (backend + agent) and Lit Web Components (frontend). No JVM, no .NET runtime, no heavyweight dependencies. The agent binary is ~15 MB.

### Simple Pricing
Per-agent licensing with unlimited transfers. No per-GB fees, no hidden costs. Start small, scale as needed.

### Enterprise-Ready
- **GDPR compliant** by design (self-hosted, audit trail, data sovereignty)
- **ISO 27001** aligned security controls
- **SOC 2** compatible audit logging
- **NIS2 / DORA** ready for regulated industries

### Developer-Friendly
- RESTful API for automation
- WebSocket protocol for real-time agent communication
- Docker-first deployment
- Comprehensive documentation

## Feature Comparison

| Feature | FileFlux | GoAnywhere | MOVEit | Stonebranch |
|---------|----------|------------|--------|-------------|
| Self-hosted | ✅ | ✅ | ✅ | ✅ |
| Agent size | 15 MB | 200 MB+ | 150 MB+ | 300 MB+ |
| Container-native | ✅ | ❌ | ❌ | ❌ |
| Real-time dashboard | ✅ | ✅ | ✅ | ✅ |
| Chunked transfers | ✅ | ✅ | ✅ | ✅ |
| REST API | ✅ | ✅ | ✅ | ✅ |
| Cron scheduling | ✅ | ✅ | ✅ | ✅ |
| Modern UI | ✅ | ❌ | ❌ | ❌ |
| Open protocol | ✅ | ❌ | ❌ | ❌ |
| Starting price | €4,800/yr | €15,000/yr | €12,000/yr | €100,000/yr |
