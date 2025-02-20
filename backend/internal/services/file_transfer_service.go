package services

import (
	"io"
	"mime/multipart"
	"os"
	"path/filepath"
)

// FileTransferService provides methods for handling file transfers.
type FileTransferService struct {
	StoragePath string
}

// NewFileTransferService creates a new instance of FileTransferService.
func NewFileTransferService(storagePath string) *FileTransferService {
	return &FileTransferService{StoragePath: storagePath}
}

// UploadFile handles the file upload process.
func (s *FileTransferService) UploadFile(file multipart.File, fileHeader *multipart.FileHeader) (string, error) {
	destPath := filepath.Join(s.StoragePath, fileHeader.Filename)
	out, err := os.Create(destPath)
	if err != nil {
		return "", err
	}
	defer out.Close()

	data, err := io.ReadAll(file)
	if err != nil {
		return "", err
	}

	if _, err := out.Write(data); err != nil {
		return "", err
	}

	return destPath, nil
}

// DownloadFile retrieves the file from the storage path.
func (s *FileTransferService) DownloadFile(filename string) (multipart.File, error) {
	filePath := filepath.Join(s.StoragePath, filename)
	file, err := os.Open(filePath)
	if err != nil {
		return nil, err
	}

	return file, nil
}

// LongPollingUpload handles chunked file upload using long polling.
func (s *FileTransferService) LongPollingUpload(file multipart.File, fileHeader *multipart.FileHeader) error {
	destPath := filepath.Join(s.StoragePath, fileHeader.Filename)
	out, err := os.Create(destPath)
	if err != nil {
		return err
	}
	defer out.Close()

	buffer := make([]byte, 1024*1024) // 1 MB chunks
	for {
		n, err := file.Read(buffer)
		if err != nil && err != io.EOF {
			return err
		}
		if n == 0 {
			break
		}

		if _, err := out.Write(buffer[:n]); err != nil {
			return err
		}
	}

	return nil
}

// LongPollingDownload handles chunked file download using long polling.
func (s *FileTransferService) LongPollingDownload(filename string) (multipart.File, error) {
	filePath := filepath.Join(s.StoragePath, filename)
	file, err := os.Open(filePath)
	if err != nil {
		return nil, err
	}

	return file, nil
}
