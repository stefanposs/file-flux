// Demo-Modus Hilfsfunktionen

// Prüft, ob der Demo-Modus aktiv ist
export function isDemoMode(): boolean {
  return window.location.search.includes('demo=true');
}

// Demo-Daten für Transfers
export function getDemoTransfers() {
  return [
    {
      id: 'transfer1',
      jobId: 'job1',
      filename: 'wichtige_daten.zip',
      size: 1024 * 1024 * 25, // 25 MB
      status: 'completed',
      startTime: '2023-10-01T10:30:00Z',
      endTime: '2023-10-01T10:35:00Z',
      speed: 5 * 1024 * 1024, // 5 MB/s
      progress: 100,
      source: 'upload-agent1:/home/user/datei.zip',
      destination: 'download-agent2:/var/data/',
    },
    // Weitere Demo-Transfers hier...
  ];
}

// Demo-Daten für Agenten
export function getDemoAgents() {
  return [
    {
      id: 'agent1',
      name: 'Produktions-Upload-Agent',
      type: 'upload',
      status: 'online',
      system: 'Linux 5.15',
      ipAddress: '192.168.1.100',
      lastSeen: new Date().toISOString(),
    },
    // Weitere Demo-Agenten hier...
  ];
}

// Demo-Daten für Jobs
export function getDemoJobs() {
  return [
    {
      id: 'job1',
      name: 'Täglicher Datenaustausch',
      description: 'Täglicher Transfer wichtiger Unternehmensdaten',
      status: 'active',
      type: 'push',
      schedule: '0 0 * * *',
      lastRun: '2023-10-01T00:00:00Z',
      nextRun: '2023-10-02T00:00:00Z',
      source: '/home/user/data/',
      destination: '/var/data/',
      uploadAgent: 'agent1',
      downloadAgent: 'agent2',
    },
    // Weitere Demo-Jobs hier...
  ];
}

// Demo-Daten für Tokens
export function getDemoTokens() {
  return [
    {
      id: 'token1',
      name: 'Produktions-Token',
      agentId: 'agent1',
      created: '2023-09-01T00:00:00Z',
      lastUsed: '2023-10-01T10:35:00Z',
      expiresAt: '2024-09-01T00:00:00Z',
      status: 'active',
    },
    // Weitere Demo-Tokens hier...
  ];
} 