// Aktiviere den Demo-Modus mit dem URL-Parameter ?demo=true
// z.B.: http://localhost:3000/?demo=true

// Demo-Modus Hilfsfunktionen

// Prüft, ob der Demo-Modus aktiv ist
export function isDemoMode(): boolean {
  return window.location.search.includes('demo=true');
}

// Demo-Benutzer für die Anmeldung
export function getDemoUser() {
  return {
    id: 'user1',
    name: 'Demo Benutzer',
    email: 'demo@fileflux.example',
    role: 'Administrator'
  };
}

// Demo-Daten für Jobs
export function getDemoJobs() {
  return [
    {
      id: "job1",
      name: "Täglicher Datenaustausch",
      description: "Automatische Synchronisierung der Produktionsdaten",
      status: "active",
      type: "push",
      schedule: "0 0 * * *",
      lastRun: "2023-10-01T00:00:00Z",
      nextRun: "2023-10-02T00:00:00Z",
      source: "/var/data/produktion/",
      destination: "/data/archiv/",
      uploadAgent: "agent1",
      downloadAgent: "agent2",
      enabled: true,
      transferCount: 52,
      failedCount: 3,
      transferredBytes: 1024 * 1024 * 1024 * 15 // 15 GB
    },
    {
      id: "job2",
      name: "Wöchentliches Backup",
      description: "Sicherung aller wichtigen Dokumente",
      status: "active",
      type: "pull",
      schedule: "0 0 * * 0",
      lastRun: "2023-09-24T00:00:00Z",
      nextRun: "2023-10-01T00:00:00Z",
      source: "/home/shared/documents/",
      destination: "/backup/documents/",
      uploadAgent: "agent3",
      downloadAgent: "agent4",
      enabled: true,
      transferCount: 12,
      failedCount: 0,
      transferredBytes: 1024 * 1024 * 1024 * 5 // 5 GB
    },
    {
      id: "job3",
      name: "Log-Dateien Transfer",
      description: "Sammlung aller Logs zur Auswertung",
      status: "inactive",
      type: "push",
      schedule: "0 12 * * 1-5",
      lastRun: null,
      nextRun: null,
      source: "/var/log/",
      destination: "/data/logs/",
      uploadAgent: "agent5",
      downloadAgent: "agent6",
      enabled: false,
      transferCount: 0,
      failedCount: 0,
      transferredBytes: 0
    }
  ];
}

// Demo-Daten für Transfers
export function getDemoTransfers() {
  return [
    {
      id: "transfer1",
      jobId: "job1",
      filename: "produktion_2023-10-01.zip",
      size: 1024 * 1024 * 500, // 500 MB
      status: "completed",
      startTime: "2023-10-01T00:05:00Z",
      endTime: "2023-10-01T00:15:30Z",
      speed: 8 * 1024 * 1024, // 8 MB/s
      progress: 100,
      source: "agent1:/var/data/produktion/",
      destination: "agent2:/data/archiv/"
    },
    {
      id: "transfer2",
      jobId: "job1",
      filename: "produktion_2023-09-30.zip",
      size: 1024 * 1024 * 450, // 450 MB
      status: "completed",
      startTime: "2023-09-30T00:05:00Z",
      endTime: "2023-09-30T00:14:20Z",
      speed: 7.5 * 1024 * 1024, // 7.5 MB/s
      progress: 100,
      source: "agent1:/var/data/produktion/",
      destination: "agent2:/data/archiv/"
    },
    {
      id: "transfer3",
      jobId: "job2",
      filename: "dokumente_woche_38.tar.gz",
      size: 1024 * 1024 * 1200, // 1.2 GB
      status: "completed",
      startTime: "2023-09-24T00:01:00Z",
      endTime: "2023-09-24T00:41:15Z",
      speed: 5 * 1024 * 1024, // 5 MB/s
      progress: 100,
      source: "agent3:/home/shared/documents/",
      destination: "agent4:/backup/documents/"
    },
    {
      id: "transfer4",
      jobId: "job2",
      filename: "vertrauliche_dokumente.zip",
      size: 1024 * 1024 * 300, // 300 MB
      status: "failed",
      startTime: "2023-09-24T00:41:30Z",
      endTime: "2023-09-24T00:45:10Z",
      speed: 0,
      progress: 45,
      source: "agent3:/home/shared/documents/confidential/",
      destination: "agent4:/backup/documents/confidential/",
      error: "Verbindung unterbrochen"
    },
    {
      id: "transfer5",
      jobId: "job1",
      filename: "produktion_live.db",
      size: 1024 * 1024 * 180, // 180 MB
      status: "running",
      startTime: "2023-10-01T09:15:00Z",
      speed: 6 * 1024 * 1024, // 6 MB/s
      progress: 65,
      source: "agent1:/var/data/produktion/db/",
      destination: "agent2:/data/archiv/db/"
    }
  ];
}

// Demo-Daten für Agenten
export function getDemoAgents() {
  return [
    {
      id: "agent1",
      name: "Produktionsserver-Upload",
      type: "upload",
      status: "online",
      system: "Linux",
      ipAddress: "192.168.1.100",
      lastSeen: new Date().toISOString()
    },
    {
      id: "agent2",
      name: "Archiv-Download",
      type: "download",
      status: "online",
      system: "Linux",
      ipAddress: "192.168.1.101",
      lastSeen: new Date().toISOString()
    },
    {
      id: "agent3",
      name: "Dokumente-Upload",
      type: "upload",
      status: "offline",
      system: "Windows",
      ipAddress: "192.168.1.102",
      lastSeen: "2023-09-30T18:45:00Z"
    },
    {
      id: "agent4",
      name: "Backup-Download",
      type: "download",
      status: "online",
      system: "Linux",
      ipAddress: "192.168.1.103",
      lastSeen: new Date().toISOString()
    }
  ];
}

// Demo-Daten für Tokens
export function getDemoTokens() {
  const now = new Date();
  const oneYearLater = new Date();
  oneYearLater.setFullYear(now.getFullYear() + 1);
  
  const oneMonthLater = new Date();
  oneMonthLater.setMonth(now.getMonth() + 1);
  
  const oneDayAgo = new Date();
  oneDayAgo.setDate(now.getDate() - 1);
  
  return [
    {
      id: "token1",
      name: "Produktionsserver-Token",
      agentId: "agent1",
      created: "2023-09-01T10:00:00Z",
      lastUsed: "2023-10-01T09:15:00Z",
      expiresAt: oneYearLater.toISOString(),
      status: "active"
    },
    {
      id: "token2",
      name: "Archiv-Token",
      agentId: "agent2",
      created: "2023-09-01T10:15:00Z",
      lastUsed: "2023-10-01T09:15:00Z",
      expiresAt: oneYearLater.toISOString(),
      status: "active"
    },
    {
      id: "token3",
      name: "Dokumente-Token",
      agentId: "agent3",
      created: "2023-09-01T10:30:00Z",
      lastUsed: "2023-09-30T18:40:00Z",
      expiresAt: oneMonthLater.toISOString(),
      status: "expiring_soon"
    },
    {
      id: "token4",
      name: "Backup-Token",
      agentId: "agent4",
      created: "2023-09-01T10:45:00Z",
      lastUsed: "2023-09-24T00:41:15Z",
      expiresAt: oneDayAgo.toISOString(),
      status: "expired"
    }
  ];
}

export function getTransferStats() {
  return {
    totalToday: 24,
    totalThisWeek: 168,
    totalThisMonth: 720,
    successRate: 97.2,
    failedTransfers: 2,
    pendingTransfers: 3,
    totalDataTransferred: '245.8 GB',
    averageTransferSpeed: '12.4 MB/s',
    peakTransferSpeed: '45.7 MB/s'
  };
} 