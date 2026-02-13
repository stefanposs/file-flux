// Package hasher provides SHA-256 hashing utilities for transfer integrity.
package hasher

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
)

func Hash(data []byte) [32]byte {
	return sha256.Sum256(data)
}

func HashReader(r io.Reader) ([32]byte, error) {
	h := sha256.New()
	if _, err := io.Copy(h, r); err != nil {
		return [32]byte{}, fmt.Errorf("hashing reader: %w", err)
	}
	var result [32]byte
	copy(result[:], h.Sum(nil))
	return result, nil
}

func Verify(data []byte, expected [32]byte) bool {
	actual := sha256.Sum256(data)
	return actual == expected
}

func HexString(h [32]byte) string {
	return hex.EncodeToString(h[:])
}

func FromHexString(s string) ([32]byte, error) {
	var result [32]byte
	b, err := hex.DecodeString(s)
	if err != nil {
		return result, fmt.Errorf("invalid hex string: %w", err)
	}
	if len(b) != 32 {
		return result, fmt.Errorf("expected 32 bytes, got %d", len(b))
	}
	copy(result[:], b)
	return result, nil
}
