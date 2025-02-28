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

// LongPollingUploadFile lädt eine Datei via POST hoch und sendet dabei die Job-ID und den Upload-Token mit.
func (c *ApiClient) LongPollingUploadFile(filePath, jobID, uploadToken string) error {
	file, err := os.Open(filePath)
	if err != nil {
		return err
	}
	defer file.Close()

	var buf bytes.Buffer
	writer := multipart.NewWriter(&buf)
	part, err := writer.CreateFormFile("file", filepath.Base(filePath))
	if err != nil {
		return err
	}
	if _, err := io.Copy(part, file); err != nil {
		return err
	}
	writer.Close()

	// URL mit Query-Parameter für Job und Token
	reqURL := fmt.Sprintf("%s/poll/upload?job=%s&token=%s", c.BaseURL, jobID, uploadToken)
	req, err := http.NewRequest("POST", reqURL, &buf)
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", writer.FormDataContentType())

	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("failed to upload file: %s", resp.Status)
	}
	return nil
}

// LongPollingDownloadFile lädt den Dateiinhalt via GET vom Server herunter, speichert ihn im angegebenen Download-Verzeichnis
// und sendet dabei Job-ID sowie Download-Token.
func (c *ApiClient) LongPollingDownloadFile(fileID, downloadDir, jobID, downloadToken string) error {
	filePath := filepath.Join(downloadDir, fileID)
	outFile, err := os.Create(filePath)
	if err != nil {
		return err
	}
	defer outFile.Close()

	// URL mit Query-Parameter für Job und Token
	reqURL := fmt.Sprintf("%s/poll/download?job=%s&token=%s", c.BaseURL, jobID, downloadToken)
	req, err := http.NewRequest("GET", reqURL, nil)
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

	_, err = io.Copy(outFile, resp.Body)
	return err
}
