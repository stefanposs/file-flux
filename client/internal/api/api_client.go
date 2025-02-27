package api

import (
	"bytes"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
)

type ApiClient struct {
	BaseURL    string
	HTTPClient *http.Client
}

func NewApiClient(baseURL string) *ApiClient {
	return &ApiClient{
		BaseURL:    baseURL,
		HTTPClient: &http.Client{},
	}
}

// LongPollingUploadFile lädt eine ganze Datei via POST hoch.
func (c *ApiClient) LongPollingUploadFile(filePath string) error {
	file, err := os.Open(filePath)
	if err != nil {
		return err
	}
	defer file.Close()

	var buf bytes.Buffer
	writer := multipart.NewWriter(&buf)
	// Mit filepath.Base anstatt file.Name() wird lediglich der Dateiname genutzt.
	part, err := writer.CreateFormFile("file", filepath.Base(filePath))
	if err != nil {
		return err
	}
	if _, err := io.Copy(part, file); err != nil {
		return err
	}
	writer.Close()

	req, err := http.NewRequest("POST", c.BaseURL+"/poll/upload", &buf)
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", writer.FormDataContentType())

	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return err
	}
	// Direktes Schließen statt defer inside der Schleife
	resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("failed to upload file: %s", resp.Status)
	}
	return nil
}

// LongPollingDownloadFile lädt per GET den Dateiinhalt vom Backend herunter und speichert ihn im Download-Verzeichnis.
func (c *ApiClient) LongPollingDownloadFile(fileID, downloadDir string) error {
	// Erstelle den Ziel-Dateipfad
	filePath := filepath.Join(downloadDir, fileID)
	outFile, err := os.Create(filePath)
	if err != nil {
		return err
	}
	defer outFile.Close()

	// Erzeuge die GET-Anfrage mit dem Query-Parameter id
	req, err := http.NewRequest("GET", c.BaseURL+"/poll/download?id="+fileID, nil)
	if err != nil {
		return err
	}

	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("failed to download file: %s", resp.Status)
	}

	// Kopiere den Antwort-Body in die Zieldatei
	_, err = io.Copy(outFile, resp.Body)
	return err
}
