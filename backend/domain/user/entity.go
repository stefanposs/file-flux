// Package user definiert die User-Domain-Entität und das Repository-Interface.
package user

import (
	"context"
	"time"
)

// Role definiert die Rolle eines Benutzers
type Role string

const (
	RoleAdmin Role = "admin"
	RoleUser  Role = "user"
)

// User ist die Domain-Entität für einen Benutzer
type User struct {
	ID           int
	Name         string
	Email        string
	PasswordHash string
	Role         Role
	CreatedAt    time.Time
	LastLogin    *time.Time
}

// Repository definiert die Schnittstelle für User-Datenzugriff
type Repository interface {
	GetByID(ctx context.Context, id int) (*User, error)
	GetByEmail(ctx context.Context, email string) (*User, error)
	Create(ctx context.Context, user *User) error
	UpdateLastLogin(ctx context.Context, id int) error
}
