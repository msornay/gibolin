// https://github.com/golang/go/issues/7263
// https://talks.golang.org/2013/oscon-dl/server-compose.go

package main

import (
	"io"
	"os"
	"sort"
)

func Part(path string) SizeReaderAt {
	f, _ := os.Open(path)
	fi, _ := f.Stat()
	return io.NewSectionReader(f, 0, fi.Size())
}

// A SizeReaderAt is a ReaderAt with a Size method.
//
// An io.SectionReader implements SizeReaderAt.
type SizeReaderAt interface {
	Size() int64
	io.ReaderAt
}

// NewMultiReaderAt is like io.MultiReader but produces a ReaderAt
// (and Size), instead of just a reader.
func NewMultiReaderAt(parts ...SizeReaderAt) SizeReaderAt {
	m := &multi{
		parts: make([]offsetAndSource, 0, len(parts)),
	}
	var off int64
	for _, p := range parts {
		m.parts = append(m.parts, offsetAndSource{off, p})
		off += p.Size()
	}
	m.size = off
	return m
}

type offsetAndSource struct {
	off int64
	SizeReaderAt
}

type multi struct {
	parts []offsetAndSource
	size  int64
}

func (m *multi) Size() int64 { return m.size }

func (m *multi) ReadAt(p []byte, off int64) (n int, err error) {
	wantN := len(p)

	// Skip past the requested offset.
	skipParts := sort.Search(len(m.parts), func(i int) bool {
		// This function returns whether parts[i] will
		// contribute any bytes to our output.
		part := m.parts[i]
		return part.off+part.Size() > off
	})
	parts := m.parts[skipParts:]

	// How far to skip in the first part.
	needSkip := off
	if len(parts) > 0 {
		needSkip -= parts[0].off
	}

	for len(parts) > 0 && len(p) > 0 {
		readP := p
		partSize := parts[0].Size()
		if int64(len(readP)) > partSize-needSkip {
			readP = readP[:partSize-needSkip]
		}
		pn, err0 := parts[0].ReadAt(readP, needSkip)
		if err0 != nil {
			return n, err0
		}
		n += pn
		p = p[pn:]
		if int64(pn)+needSkip == partSize {
			parts = parts[1:]
		}
		needSkip = 0
	}

	if n != wantN {
		err = io.ErrUnexpectedEOF
	}
	return
}
