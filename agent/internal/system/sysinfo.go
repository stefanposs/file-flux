package system

import (
	"net"
	"os"
	"runtime"
)

// SystemInfo enthält Informationen über das System, auf dem der Agent läuft
type SystemInfo struct {
	Hostname   string `json:"hostname"`
	OSName     string `json:"os_name"`
	OSVersion  string `json:"os_version"`
	IPAddress  string `json:"ip_address"`
	GoVersion  string `json:"go_version"`
	NumCPUs    int    `json:"num_cpus"`
	TotalMemMB int64  `json:"total_mem_mb"`
}

// CollectSystemInfo sammelt Systeminformationen
func CollectSystemInfo() *SystemInfo {
	hostname, _ := os.Hostname()

	// IP-Adresse ermitteln
	var ipAddress string
	addrs, err := net.InterfaceAddrs()
	if err == nil {
		for _, addr := range addrs {
			if ipnet, ok := addr.(*net.IPNet); ok && !ipnet.IP.IsLoopback() {
				if ipnet.IP.To4() != nil {
					ipAddress = ipnet.IP.String()
					break
				}
			}
		}
	}

	// In einer realen Implementierung würden wir mehr Details sammeln,
	// z.B. über externe Pakete wie github.com/shirou/gopsutil

	return &SystemInfo{
		Hostname:   hostname,
		OSName:     runtime.GOOS,
		OSVersion:  "unknown", // In einer realen Implementierung zu ermitteln
		IPAddress:  ipAddress,
		GoVersion:  runtime.Version(),
		NumCPUs:    runtime.NumCPU(),
		TotalMemMB: 0, // In einer realen Implementierung zu ermitteln
	}
}
