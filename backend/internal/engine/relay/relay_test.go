package relay

import (
	"bytes"
	"os"
	"testing"
)

func TestRelayStoreAndGet(t *testing.T) {
	dir := t.TempDir()
	r, err := New(dir)
	if err != nil {
		t.Fatal(err)
	}

	data := []byte("chunk data here")
	n, err := r.StoreChunk(1, 0, data)
	if err != nil {
		t.Fatal(err)
	}
	if n != int64(len(data)) {
		t.Fatalf("expected %d bytes stored, got %d", len(data), n)
	}

	got, err := r.GetChunk(1, 0)
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(data, got) {
		t.Fatal("data mismatch")
	}
}

func TestRelayCleanup(t *testing.T) {
	dir := t.TempDir()
	r, err := New(dir)
	if err != nil {
		t.Fatal(err)
	}

	r.StoreChunk(1, 0, []byte("a"))
	r.StoreChunk(1, 1, []byte("b"))

	if err := r.CleanupTransfer(1); err != nil {
		t.Fatal(err)
	}

	_, err = r.GetChunk(1, 0)
	if err == nil {
		t.Fatal("expected error after cleanup")
	}
}

func TestRelayDiskUsage(t *testing.T) {
	dir := t.TempDir()
	r, err := New(dir)
	if err != nil {
		t.Fatal(err)
	}

	r.StoreChunk(2, 0, []byte("12345"))
	r.StoreChunk(2, 1, []byte("67890"))

	usage, err := r.DiskUsage(2)
	if err != nil {
		t.Fatal(err)
	}
	if usage != 10 {
		t.Fatalf("expected 10 bytes, got %d", usage)
	}
}

func TestRelayGetAllChunks(t *testing.T) {
	dir := t.TempDir()
	r, err := New(dir)
	if err != nil {
		t.Fatal(err)
	}

	r.StoreChunk(3, 0, []byte("a"))
	r.StoreChunk(3, 1, []byte("b"))
	r.StoreChunk(3, 2, []byte("c"))

	chunks, err := r.GetAllChunks(3)
	if err != nil {
		t.Fatal(err)
	}
	if len(chunks) != 3 {
		t.Fatalf("expected 3 chunks, got %d", len(chunks))
	}
}

func TestRelayNonExistentTransfer(t *testing.T) {
	dir := t.TempDir()
	r, _ := New(dir)

	usage, _ := r.DiskUsage(999)
	if usage != 0 {
		t.Fatalf("expected 0 for non-existent, got %d", usage)
	}

	// Cleanup of non-existent should not error
	err := r.CleanupTransfer(999)
	if err != nil {
		t.Fatal(err)
	}
	_ = os.RemoveAll(dir)
}
