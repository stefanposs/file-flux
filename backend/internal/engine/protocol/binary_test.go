package protocol

import (
	"bytes"
	"crypto/rand"
	"testing"
)

func TestFrameRoundtrip(t *testing.T) {
	payload := make([]byte, 1024)
	if _, err := rand.Read(payload); err != nil {
		t.Fatal(err)
	}

	var sha [32]byte
	copy(sha[:], []byte("12345678901234567890123456789012"))

	h := BinaryHeader{
		TransferID:       42,
		ChunkIndex:       0,
		TotalChunks:      10,
		SHA256:           sha,
		UncompressedSize: 2048,
		CompressedSize:   uint32(len(payload)),
		CompressionType:  1, // zstd
	}

	frame, err := EncodeFrame(h, payload)
	if err != nil {
		t.Fatal(err)
	}

	decoded, err := DecodeFrame(frame)
	if err != nil {
		t.Fatal(err)
	}

	if decoded.Header.TransferID != 42 {
		t.Fatalf("TransferID mismatch: %d", decoded.Header.TransferID)
	}
	if decoded.Header.ChunkIndex != 0 {
		t.Fatalf("ChunkIndex mismatch: %d", decoded.Header.ChunkIndex)
	}
	if decoded.Header.TotalChunks != 10 {
		t.Fatalf("TotalChunks mismatch: %d", decoded.Header.TotalChunks)
	}
	if decoded.Header.SHA256 != sha {
		t.Fatal("SHA256 mismatch")
	}
	if decoded.Header.UncompressedSize != 2048 {
		t.Fatalf("UncompressedSize mismatch: %d", decoded.Header.UncompressedSize)
	}
	if decoded.Header.CompressionType != 1 {
		t.Fatalf("CompressionType mismatch: %d", decoded.Header.CompressionType)
	}
	if !bytes.Equal(decoded.Payload, payload) {
		t.Fatal("payload mismatch")
	}
}

func TestDecodeFrameTooShort(t *testing.T) {
	_, err := DecodeFrame([]byte{0x00, 0x01})
	if err == nil {
		t.Fatal("expected error for short frame")
	}
}

func TestDecodeFrameBadMagic(t *testing.T) {
	data := make([]byte, HeaderSize)
	_, err := DecodeFrame(data)
	if err == nil {
		t.Fatal("expected error for bad magic")
	}
}

func TestValidateHeader(t *testing.T) {
	h := BinaryHeader{
		ChunkIndex:      5,
		TotalChunks:     10,
		CompressionType: 1,
	}
	if err := ValidateHeader(h); err != nil {
		t.Fatal(err)
	}

	// Invalid: index >= total
	h.ChunkIndex = 10
	if err := ValidateHeader(h); err == nil {
		t.Fatal("expected error for index >= total")
	}

	// Invalid: unknown compression
	h.ChunkIndex = 5
	h.CompressionType = 99
	if err := ValidateHeader(h); err == nil {
		t.Fatal("expected error for unknown compression")
	}
}
