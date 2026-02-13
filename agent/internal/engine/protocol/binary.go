// Package protocol defines the binary WebSocket frame format for chunk transfers.
package protocol

import (
	"encoding/binary"
	"errors"
	"fmt"
)

const (
	MagicBytes   uint32 = 0x46465846 // "FFXF"
	HeaderSize          = 57
	MinFrameSize        = HeaderSize
)

type BinaryHeader struct {
	TransferID       uint32
	ChunkIndex       uint32
	TotalChunks      uint32
	SHA256           [32]byte
	UncompressedSize uint32
	CompressedSize   uint32
	CompressionType  uint8
}

type BinaryFrame struct {
	Header  BinaryHeader
	Payload []byte
}

func EncodeHeader(h BinaryHeader) []byte {
	buf := make([]byte, HeaderSize)
	binary.BigEndian.PutUint32(buf[0:4], MagicBytes)
	binary.BigEndian.PutUint32(buf[4:8], h.TransferID)
	binary.BigEndian.PutUint32(buf[8:12], h.ChunkIndex)
	binary.BigEndian.PutUint32(buf[12:16], h.TotalChunks)
	copy(buf[16:48], h.SHA256[:])
	binary.BigEndian.PutUint32(buf[48:52], h.UncompressedSize)
	binary.BigEndian.PutUint32(buf[52:56], h.CompressedSize)
	buf[56] = h.CompressionType
	return buf
}

func DecodeHeader(data []byte) (BinaryHeader, error) {
	if len(data) < HeaderSize {
		return BinaryHeader{}, fmt.Errorf("data too short: %d < %d", len(data), HeaderSize)
	}

	magic := binary.BigEndian.Uint32(data[0:4])
	if magic != MagicBytes {
		return BinaryHeader{}, fmt.Errorf("invalid magic: 0x%08X", magic)
	}

	var h BinaryHeader
	h.TransferID = binary.BigEndian.Uint32(data[4:8])
	h.ChunkIndex = binary.BigEndian.Uint32(data[8:12])
	h.TotalChunks = binary.BigEndian.Uint32(data[12:16])
	copy(h.SHA256[:], data[16:48])
	h.UncompressedSize = binary.BigEndian.Uint32(data[48:52])
	h.CompressedSize = binary.BigEndian.Uint32(data[52:56])
	h.CompressionType = data[56]
	return h, nil
}

func EncodeFrame(h BinaryHeader, payload []byte) ([]byte, error) {
	h.CompressedSize = uint32(len(payload))
	header := EncodeHeader(h)
	frame := make([]byte, HeaderSize+len(payload))
	copy(frame[:HeaderSize], header)
	copy(frame[HeaderSize:], payload)
	return frame, nil
}

func DecodeFrame(data []byte) (*BinaryFrame, error) {
	if len(data) < MinFrameSize {
		return nil, errors.New("frame too short")
	}

	header, err := DecodeHeader(data[:HeaderSize])
	if err != nil {
		return nil, err
	}

	payload := data[HeaderSize:]
	if uint32(len(payload)) != header.CompressedSize {
		return nil, fmt.Errorf("payload size mismatch: got %d, header says %d", len(payload), header.CompressedSize)
	}

	return &BinaryFrame{
		Header:  header,
		Payload: payload,
	}, nil
}

func ValidateHeader(h BinaryHeader) error {
	if h.ChunkIndex >= h.TotalChunks {
		return fmt.Errorf("chunk index %d >= total chunks %d", h.ChunkIndex, h.TotalChunks)
	}
	if h.CompressionType > 2 {
		return fmt.Errorf("unknown compression type: %d", h.CompressionType)
	}
	return nil
}
