package models

type FileTransfer struct {
    ID   string `json:"id"`
    Name string `json:"name"`
    Size int64  `json:"size"`
    Path string `json:"path"`
}