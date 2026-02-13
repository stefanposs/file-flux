package chunker

import (
	"bytes"
	"crypto/rand"
	"fmt"
	"os"
	"path/filepath"
	"testing"
)

func TestChunkerRoundtrip(t *testing.T) {
	data := make([]byte, 25*1024*1024) // 25 MB
	if _, err := rand.Read(data); err != nil {
		t.Fatal(err)
	}

	c, err := New(8 * 1024 * 1024)
	if err != nil {
		t.Fatal(err)
	}

	if c.TotalChunks(int64(len(data))) != 4 {
		t.Fatalf("expected 4 chunks, got %d", c.TotalChunks(int64(len(data))))
	}

	chunks, errCh := c.Split(bytes.NewReader(data))

	var buf bytes.Buffer
	if err := c.Reassemble(&buf, chunks); err != nil {
		t.Fatal(err)
	}
	if err := <-errCh; err != nil {
		t.Fatal(err)
	}

	if !bytes.Equal(data, buf.Bytes()) {
		t.Fatal("roundtrip data mismatch")
	}
}

func TestChunkerExactMultiple(t *testing.T) {
	data := make([]byte, 16*1024*1024)
	if _, err := rand.Read(data); err != nil {
		t.Fatal(err)
	}

	c, err := New(8 * 1024 * 1024)
	if err != nil {
		t.Fatal(err)
	}

	chunks, errCh := c.Split(bytes.NewReader(data))
	var buf bytes.Buffer
	if err := c.Reassemble(&buf, chunks); err != nil {
		t.Fatal(err)
	}
	if err := <-errCh; err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(data, buf.Bytes()) {
		t.Fatal("roundtrip data mismatch")
	}
}

func TestChunkerSmallFile(t *testing.T) {
	data := []byte("hello world")
	c, err := New(0)
	if err != nil {
		t.Fatal(err)
	}

	chunks, errCh := c.Split(bytes.NewReader(data))
	var buf bytes.Buffer
	if err := c.Reassemble(&buf, chunks); err != nil {
		t.Fatal(err)
	}
	if err := <-errCh; err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(data, buf.Bytes()) {
		t.Fatal("roundtrip data mismatch")
	}
}

func TestChunkerInvalidSize(t *testing.T) {
	_, err := New(100)
	if err == nil {
		t.Fatal("expected error for invalid chunk size")
	}
}

func TestChunkerReassembleFromDir(t *testing.T) {
	data := make([]byte, 3*1024*1024)
	if _, err := rand.Read(data); err != nil {
		t.Fatal(err)
	}

	c, err := New(1024 * 1024)
	if err != nil {
		t.Fatal(err)
	}

	dir := t.TempDir()
	chunks, errCh := c.Split(bytes.NewReader(data))
	for chunk := range chunks {
		path := filepath.Join(dir, fmt.Sprintf("chunk-%06d.bin", chunk.Index))
		if err := os.WriteFile(path, chunk.Data, 0o644); err != nil {
			t.Fatal(err)
		}
	}
	if err := <-errCh; err != nil {
		t.Fatal(err)
	}

	destPath := filepath.Join(dir, "reassembled.bin")
	if err := c.ReassembleFromDir(dir, destPath, 3); err != nil {
		t.Fatal(err)
	}

	reassembled, err := os.ReadFile(destPath)
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(data, reassembled) {
		t.Fatal("reassembled data mismatch")
	}
}
