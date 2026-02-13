// Package api implementiert den HTTP-Client fuer Dateitransfers zum Server.
package api

import (
	"fmt"
	"io"
	"net/http"
	"net/url"
	"time"
)

// Client kommuniziert mit dem FileFlux-Backend ueber HTTP.
type Client struct {
	baseURL    string
	token      string
	httpClient *http.Client
}

// NewClient erstellt einen neuen API-Client.
func NewClient(baseURL, token string) *Client {
	return &Client{
		baseURL: baseURL,
		token:   token,
		httpClient: &http.Client{
			Timeout: 30 * time.Minute, // Grosse Dateien brauchen Zeit
		},
	}
}

// UploadFile sendet eine Datei an den Server.
// PUT /api/files/{transferId}/upload?filename=<name>
func (c *Client) UploadFile(transferID string, filename string, body io.Reader) (int64, error) {
	u := fmt.Sprintf("%s/api/files/%s/upload?filename=%s", c.baseURL, transferID, url.QueryEscape(filename))

	req, err := http.NewRequest(http.MethodPut, u, body)
	if err != nil {
		return 0, fmt.Errorf("request erstellen: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+c.token)
	req.Header.Set("Content-Type", "application/octet-stream")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return 0, fmt.Errorf("upload fehlgeschlagen: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(io.LimitReader(resp.Body, 1024))
		return 0, fmt.Errorf("upload fehlgeschlagen (HTTP %d): %s", resp.StatusCode, string(respBody))
	}

	return 0, nil
}

// DownloadFile laedt eine Datei vom Server herunter.
// GET /api/files/{transferId}/download
func (c *Client) DownloadFile(transferID string, dst io.Writer) (int64, error) {
	u := fmt.Sprintf("%s/api/files/%s/download", c.baseURL, transferID)

	req, err := http.NewRequest(http.MethodGet, u, nil)
	if err != nil {
		return 0, fmt.Errorf("request erstellen: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+c.token)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return 0, fmt.Errorf("download fehlgeschlagen: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(io.LimitReader(resp.Body, 1024))
		return 0, fmt.Errorf("download fehlgeschlagen (HTTP %d): %s", resp.StatusCode, string(respBody))
	}

	written, err := io.Copy(dst, resp.Body)
	if err != nil {
		return written, fmt.Errorf("download schreiben: %w", err)
	}

	return written, nil
}
