package api

import (
	"bytes"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"time"
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

func (c *ApiClient) UploadFile(filePath string) error {
	file, err := os.Open(filePath)
	if err != nil {
		return err
	}
	defer file.Close()

	var buf bytes.Buffer
	writer := multipart.NewWriter(&buf)
	part, err := writer.CreateFormFile("file", file.Name())
	if err != nil {
		return err
	}
	if _, err := io.Copy(part, file); err != nil {
		return err
	}
	writer.Close()

	req, err := http.NewRequest("POST", c.BaseURL+"/upload", &buf)
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

func (c *ApiClient) DownloadFile(fileID string) ([]byte, error) {
	resp, err := c.HTTPClient.Get(c.BaseURL + "/download/" + fileID)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("failed to download file: %s", resp.Status)
	}

	return io.ReadAll(resp.Body)
}

func (c *ApiClient) LongPollingUploadFile(filePath string) error {
	file, err := os.Open(filePath)
	if err != nil {
		return err
	}
	defer file.Close()

	for {
		var buf bytes.Buffer
		writer := multipart.NewWriter(&buf)
		part, err := writer.CreateFormFile("file", file.Name())
		if err != nil {
			return err
		}
		if _, err := io.CopyN(part, file, 1024*1024); err != nil && err != io.EOF {
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
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			return fmt.Errorf("failed to upload file chunk: %s", resp.Status)
		}

		// Simulate a delay for long polling
		time.Sleep(1 * time.Second)

		// Check if the upload is complete
		if err == io.EOF {
			break
		}
	}

	return nil
}

func (c *ApiClient) LongPollingDownloadFile(fileID, downloadDir string) error {
	filePath := downloadDir + "/" + fileID
	file, err := os.Create(filePath)
	if err != nil {
		return err
	}
	defer file.Close()

	for {
		resp, err := c.HTTPClient.Get(c.BaseURL + "/poll/download/" + fileID)
		if err != nil {
			return err
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			return fmt.Errorf("failed to download file chunk: %s", resp.Status)
		}

		chunk, err := io.ReadAll(resp.Body)
		if err != nil {
			return err
		}

		if _, err := file.Write(chunk); err != nil {
			return err
		}

		// Simulate a delay for long polling
		time.Sleep(1 * time.Second)

		// Check if the download is complete
		if len(chunk) < 1024*1024 {
			break
		}
	}

	return nil
}
