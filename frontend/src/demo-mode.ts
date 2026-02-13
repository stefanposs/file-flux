// Aktiviere den Demo-Modus mit dem URL-Parameter ?demo=true
// z.B.: http://localhost:3000/?demo=true

// Demo-Modus Hilfsfunktionen

// Prüft, ob der Demo-Modus aktiv ist
export function isDemoMode(): boolean {
  return window.location.search.includes('demo=true') || localStorage.getItem('demoMode') === 'true';
}

// Demo-Benutzer für die Anmeldung
export function getDemoUser() {
  return {
    id: 'user1',
    name: 'Demo Benutzer',
    email: 'demo@fileflux.example',
    role: 'Administrator',
    avatar: null,
    lastLogin: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() // Gestern
  };
}

// Demo-Daten für Jobs
export function getDemoJobs() {
  const jobsFromStorage = localStorage.getItem('demoJobs');
  
  if (jobsFromStorage) {
    try {
      return JSON.parse(jobsFromStorage);
    } catch (e) {
      console.error('Fehler beim Parsen der gespeicherten Jobs:', e);
    }
  }
  
  // Standarddaten, wenn nichts im Speicher ist
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  const defaultJobs = [
    {
      id: "job1",
      name: "Täglicher Datenaustausch",
      description: "Automatische Synchronisierung der Produktionsdaten",
      status: "active",
      type: "push",
      schedule: "0 0 * * *",
      lastRun: yesterday.toISOString(),
      nextRun: tomorrow.toISOString(),
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
      nextRun: "2023-10-08T00:00:00Z",
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

  localStorage.setItem('demoJobs', JSON.stringify(defaultJobs));
  return defaultJobs;
}

// Speichert Demo-Jobs
export function saveDemoJobs(jobs) {
  localStorage.setItem('demoJobs', JSON.stringify(jobs));
}

// Demo-Daten für Transfers
export function getDemoTransfers() {
  const transfersFromStorage = localStorage.getItem('demoTransfers');
  
  if (transfersFromStorage) {
    try {
      return JSON.parse(transfersFromStorage);
    } catch (e) {
      console.error('Fehler beim Parsen der gespeicherten Transfers:', e);
    }
  }
  
  // Standarddaten, wenn nichts im Speicher ist
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  
  const defaultTransfers = [
    {
      id: "transfer1",
      jobId: "job1",
      filename: "produktion_2023-10-01.zip",
      size: 1024 * 1024 * 500, // 500 MB
      status: "completed",
      startTime: yesterday.toISOString(),
      endTime: new Date(yesterday.getTime() + 15 * 60 * 1000).toISOString(), // 15 Minuten später
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
      startTime: new Date(yesterday.getTime() - 24 * 60 * 60 * 1000).toISOString(),
      endTime: new Date(yesterday.getTime() - 24 * 60 * 60 * 1000 + 14 * 60 * 1000).toISOString(),
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
      startTime: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      endTime: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000 + 41 * 60 * 1000).toISOString(),
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
      startTime: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000 + 41 * 60 * 1000).toISOString(),
      endTime: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000 + 45 * 60 * 1000).toISOString(),
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
      startTime: new Date(now.getTime() - 30 * 60 * 1000).toISOString(),
      speed: 6 * 1024 * 1024, // 6 MB/s
      progress: 65,
      source: "agent1:/var/data/produktion/db/",
      destination: "agent2:/data/archiv/db/"
    },
    {
      id: "transfer6",
      jobId: "job1",
      filename: "produktion_updates.sql",
      size: 1024 * 1024 * 75, // 75 MB
      status: "pending",
      startTime: new Date().toISOString(),
      speed: 0,
      progress: 0,
      source: "agent1:/var/data/produktion/updates/",
      destination: "agent2:/data/archiv/updates/"
    }
  ];

  localStorage.setItem('demoTransfers', JSON.stringify(defaultTransfers));
  return defaultTransfers;
}

// Speichert Demo-Transfers
export function saveDemoTransfers(transfers) {
  localStorage.setItem('demoTransfers', JSON.stringify(transfers));
}

// Demo-Daten für Agenten
export function getDemoAgents() {
  const agentsFromStorage = localStorage.getItem('demoAgents');
  
  if (agentsFromStorage) {
    try {
      return JSON.parse(agentsFromStorage);
    } catch (e) {
      console.error('Fehler beim Parsen der gespeicherten Agenten:', e);
    }
  }
  
  // Standarddaten, wenn nichts im Speicher ist
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  
  const defaultAgents = [
    {
      id: "agent1",
      name: "Produktionsserver-Upload",
      type: "upload",
      status: "online",
      system: "Linux",
      ipAddress: "192.168.1.100",
      lastSeen: now.toISOString()
    },
    {
      id: "agent2",
      name: "Archiv-Download",
      type: "download",
      status: "online",
      system: "Linux",
      ipAddress: "192.168.1.101",
      lastSeen: now.toISOString()
    },
    {
      id: "agent3",
      name: "Dokumente-Upload",
      type: "upload",
      status: "offline",
      system: "Windows",
      ipAddress: "192.168.1.102",
      lastSeen: yesterday.toISOString()
    },
    {
      id: "agent4",
      name: "Backup-Download",
      type: "download",
      status: "online",
      system: "Linux",
      ipAddress: "192.168.1.103",
      lastSeen: now.toISOString()
    }
  ];

  localStorage.setItem('demoAgents', JSON.stringify(defaultAgents));
  return defaultAgents;
}

// Speichert Demo-Agenten
export function saveDemoAgents(agents) {
  localStorage.setItem('demoAgents', JSON.stringify(agents));
}

// Demo-Daten für Tokens
export function getDemoTokens() {
  const tokensFromStorage = localStorage.getItem('demoTokens');
  
  if (tokensFromStorage) {
    try {
      return JSON.parse(tokensFromStorage);
    } catch (e) {
      console.error('Fehler beim Parsen der gespeicherten Tokens:', e);
    }
  }
  
  // Standarddaten, wenn nichts im Speicher ist
  const now = new Date();
  const oneYearLater = new Date(now);
  oneYearLater.setFullYear(now.getFullYear() + 1);
  
  const oneMonthLater = new Date(now);
  oneMonthLater.setMonth(now.getMonth() + 1);
  
  const oneDayAgo = new Date(now);
  oneDayAgo.setDate(now.getDate() - 1);
  
  const defaultTokens = [
    {
      id: "token1",
      name: "Produktionsserver-Token",
      agentId: "agent1",
      created: "2023-09-01T10:00:00Z",
      lastUsed: now.toISOString(),
      expiresAt: oneYearLater.toISOString(),
      status: "active"
    },
    {
      id: "token2",
      name: "Archiv-Token",
      agentId: "agent2",
      created: "2023-09-01T10:15:00Z",
      lastUsed: now.toISOString(),
      expiresAt: oneYearLater.toISOString(),
      status: "active"
    },
    {
      id: "token3",
      name: "Dokumente-Token",
      agentId: "agent3",
      created: "2023-09-01T10:30:00Z",
      lastUsed: oneDayAgo.toISOString(),
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

  localStorage.setItem('demoTokens', JSON.stringify(defaultTokens));
  return defaultTokens;
}

// Speichert Demo-Tokens
export function saveDemoTokens(tokens) {
  localStorage.setItem('demoTokens', JSON.stringify(tokens));
}

// Demo-Statistiken
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

// Generiert eine zufällige ID
export function generateId(prefix = '') {
  return prefix + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

// Fügt einen neuen Demo-Job hinzu
export function addDemoJob(job) {
  const jobs = getDemoJobs();
  const newJob = {
    id: generateId('job'),
    ...job,
    transferCount: 0,
    failedCount: 0,
    transferredBytes: 0
  };
  jobs.push(newJob);
  saveDemoJobs(jobs);
  return newJob;
}

// Aktualisiert einen Demo-Job
export function updateDemoJob(jobId, updates) {
  const jobs = getDemoJobs();
  const index = jobs.findIndex(job => job.id === jobId);
  if (index !== -1) {
    jobs[index] = { ...jobs[index], ...updates };
    saveDemoJobs(jobs);
    return jobs[index];
  }
  return null;
}

// Löscht einen Demo-Job
export function deleteDemoJob(jobId) {
  const jobs = getDemoJobs();
  const filteredJobs = jobs.filter(job => job.id !== jobId);
  saveDemoJobs(filteredJobs);
}

// Fügt einen neuen Demo-Transfer hinzu
export function addDemoTransfer(transfer) {
  const transfers = getDemoTransfers();
  const newTransfer = {
    id: generateId('transfer'),
    ...transfer,
    startTime: new Date().toISOString(),
    progress: transfer.status === 'completed' ? 100 : 0
  };
  transfers.push(newTransfer);
  saveDemoTransfers(transfers);
  return newTransfer;
}

// Aktualisiert einen Demo-Transfer
export function updateDemoTransfer(transferId, updates) {
  const transfers = getDemoTransfers();
  const index = transfers.findIndex(transfer => transfer.id === transferId);
  if (index !== -1) {
    transfers[index] = { ...transfers[index], ...updates };
    
    // Wenn Status auf 'completed' gesetzt wird, setze Fortschritt auf 100%
    if (updates.status === 'completed' && transfers[index].progress !== 100) {
      transfers[index].progress = 100;
      transfers[index].endTime = new Date().toISOString();
    }
    
    saveDemoTransfers(transfers);
    return transfers[index];
  }
  return null;
}

// Löscht einen Demo-Transfer
export function deleteDemoTransfer(transferId) {
  const transfers = getDemoTransfers();
  const filteredTransfers = transfers.filter(transfer => transfer.id !== transferId);
  saveDemoTransfers(filteredTransfers);
}

// Fügt einen neuen Demo-Agenten hinzu
export function addDemoAgent(agent) {
  const agents = getDemoAgents();
  const newAgent = {
    id: generateId('agent'),
    ...agent,
    lastSeen: new Date().toISOString()
  };
  agents.push(newAgent);
  saveDemoAgents(agents);
  return newAgent;
}

// Aktualisiert einen Demo-Agenten
export function updateDemoAgent(agentId, updates) {
  const agents = getDemoAgents();
  const index = agents.findIndex(agent => agent.id === agentId);
  if (index !== -1) {
    agents[index] = { ...agents[index], ...updates };
    saveDemoAgents(agents);
    return agents[index];
  }
  return null;
}

// Löscht einen Demo-Agenten
export function deleteDemoAgent(agentId) {
  const agents = getDemoAgents();
  const filteredAgents = agents.filter(agent => agent.id !== agentId);
  saveDemoAgents(filteredAgents);
}

// Fügt ein neues Demo-Token hinzu
export function addDemoToken(token) {
  const tokens = getDemoTokens();
  const now = new Date();
  const oneYearLater = new Date(now);
  oneYearLater.setFullYear(now.getFullYear() + 1);
  
  const newToken = {
    id: generateId('token'),
    ...token,
    created: now.toISOString(),
    lastUsed: null,
    expiresAt: token.expiresAt || oneYearLater.toISOString(),
    status: "active"
  };
  tokens.push(newToken);
  saveDemoTokens(tokens);
  return newToken;
}

// Aktualisiert ein Demo-Token
export function updateDemoToken(tokenId, updates) {
  const tokens = getDemoTokens();
  const index = tokens.findIndex(token => token.id === tokenId);
  if (index !== -1) {
    tokens[index] = { ...tokens[index], ...updates };
    saveDemoTokens(tokens);
    return tokens[index];
  }
  return null;
}

// Initialisiert den Demo-Modus für die erste Nutzung
export function initDemoMode() {
  if (!localStorage.getItem('demoMode')) {
    localStorage.setItem('demoMode', 'true');
  }
  
  // Stelle sicher, dass alle Demo-Daten initialisiert sind
  getDemoJobs();
  getDemoTransfers();
  getDemoAgents();
  getDemoTokens();
}

// Beispiel für die korrigierte Version:
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export function createDemoToken(tokenData: Omit<any, 'id' | 'token' | 'createdAt'>): any {
  const now = new Date();
  const token = {
    id: generateUUID(),
    name: tokenData.name || 'Neuer Token',
    token: generateTokenString(),
    createdAt: now,
    expiresAt: tokenData.expiresAt || new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000), // 30 Tage
    lastUsed: now,
    description: tokenData.description || '',
    agentId: tokenData.agentId || null,
    status: 'active'
  };
  
  const tokens = getDemoTokens();
  tokens.push(token);
  saveDemoTokens(tokens);
  return token;
}

export function deleteDemoToken(tokenId: string): boolean {
  const tokens = getDemoTokens();
  const initialLength = tokens.length;
  const filtered = tokens.filter(token => token.id !== tokenId);
  saveDemoTokens(filtered);
  return filtered.length < initialLength;
}

// Hilfsfunktion für Token-String-Generierung hinzufügen
function generateTokenString(): string {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 40; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
} 